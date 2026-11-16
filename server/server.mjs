// Eluvo server: gives Ali a brain (Claude), a voice (ElevenLabs) and ears (ElevenLabs or OpenAI Whisper).
// The API keys live here, in server/.env or the host's settings, and never reach the browser.
// Run it on your own computer:  node tools/start.mjs  (or double-click start.bat / start.command)
// Run it on a host:              cd server && npm install && npm start

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");

// ---------- settings ----------
loadEnvFile(path.join(here, ".env"));
const env = process.env;
const PORT = Number(env.PORT || 8787);
const HOST = env.HOST || ""; // empty: reachable from other machines, which a host needs. tools/start.mjs sets 127.0.0.1.
const MODEL = env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = env.ANTHROPIC_EFFORT || "low"; // low keeps replies quick for a spoken chat
const EL_KEY = env.ELEVENLABS_API_KEY || "";
const EL_VOICE = env.ELEVENLABS_VOICE_ID || "";
const EL_TTS_MODEL = env.ELEVENLABS_TTS_MODEL || ""; // empty: ElevenLabs picks its default
const EL_STT_MODEL = env.ELEVENLABS_STT_MODEL || "scribe_v2";
const EL_BASE = trimSlash(env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io");
const OA_KEY = env.OPENAI_API_KEY || "";
const OA_STT_MODEL = env.OPENAI_STT_MODEL || "whisper-1";
const OA_BASE = trimSlash(env.OPENAI_BASE_URL || "https://api.openai.com");
const STT_PROVIDER = (env.STT_PROVIDER || (EL_KEY ? "elevenlabs" : OA_KEY ? "openai" : "")).toLowerCase();
const ACCESS_CODE = env.ACCESS_CODE || "";
const ORIGINS = (env.ALLOWED_ORIGINS || "https://haiderlse.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const DAILY_LIMIT = Number(env.DAILY_LIMIT || 600); // all requests, all visitors, per day
const RULES = fs.readFileSync(path.join(here, "rules.txt"), "utf8").trim();

const hasChat = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
const hasTts = Boolean(EL_KEY && EL_VOICE);
const hasStt = (STT_PROVIDER === "elevenlabs" && Boolean(EL_KEY)) || (STT_PROVIDER === "openai" && Boolean(OA_KEY));

// Models that accept a server-side fallback when a safety check declines a request.
const FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

let anthropic = null;
function claude() {
  if (!anthropic) anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return anthropic;
}

// ---------- small helpers ----------
function trimSlash(s) {
  return s.replace(/\/+$/, "");
}
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}
function send(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(data);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, "too_large", "That is too big to send."));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJson(req, limit = 200_000) {
  const raw = await readBody(req, limit);
  try {
    return JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "bad_json", "The request was not valid JSON.");
  }
}

// ---------- limits: per visitor and for the whole day ----------
const WINDOW_MS = 5 * 60 * 1000;
const PER_WINDOW = { chat: 40, tts: 40, stt: 25, unlock: 10 };
const hits = new Map();
let day = "";
let dayCount = 0;
function limit(req, kind) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (++dayCount > DAILY_LIMIT) throw new HttpError(429, "rate_limited", "The daily limit for this demo has been reached.");
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const key = kind + "|" + ip;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_WINDOW[kind]) throw new HttpError(429, "rate_limited", "Too many requests. Wait a few minutes.");
  list.push(now);
  hits.set(key, list);
}
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(key);
}, WINDOW_MS).unref();

function unlocked(req) {
  return !ACCESS_CODE || req.headers["x-eluvo-code"] === ACCESS_CODE;
}
function requireAccess(req) {
  if (!unlocked(req)) throw new HttpError(401, "need_code", "An access code is needed.");
}

// ---------- Ali's replies ----------
const STATE_KEYS = ["step", "setting", "voice", "fits", "reply", "skill", "action", "prediction", "sealed", "support"];
function cleanState(state) {
  const out = {};
  if (state && typeof state === "object") {
    for (const k of STATE_KEYS) {
      const v = state[k];
      if (typeof v === "string") out[k] = v.slice(0, 240);
      else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    }
  }
  return out;
}
function cleanTurns(turns) {
  if (!Array.isArray(turns)) throw new HttpError(400, "bad_request", "turns must be a list.");
  const out = [];
  for (const t of turns.slice(-30)) {
    if (!t || (t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string" || !t.content.trim()) continue;
    out.push({ role: t.role, content: t.content.slice(0, 2500) });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") throw new HttpError(400, "bad_request", "The last turn must be the person's message.");
  return out;
}
async function chat(body) {
  if (!hasChat) throw new HttpError(503, "not_configured", "No Claude API key is set on the server.");
  const messages = cleanTurns(body.turns);
  const params = {
    model: MODEL,
    // Replies are two or three spoken sentences. The cap is a cost guard on a public endpoint.
    max_tokens: 4000,
    system: RULES + "\n\nSTATE SO FAR, kept by the page: " + JSON.stringify(cleanState(body.state)),
    output_config: { effort: EFFORT },
    messages,
  };
  if (FALLBACK_MODELS.has(MODEL)) {
    // If a safety check declines the request, the API retries it on a fallback model in the same call.
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }
  let response;
  try {
    response = await claude().beta.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "rate_limited", "Claude is busy. Try again shortly.");
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[chat] the Claude API key was rejected:", err.message);
      throw new HttpError(503, "not_configured", "The server's Claude key is not working.");
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("[chat] Claude rejected the request:", err.message);
      throw new HttpError(502, "upstream_error", "Claude could not process that.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[chat] Claude API error", err.status, err.message);
      throw new HttpError(502, "upstream_error", "Claude had a problem. Try again.");
    }
    throw err;
  }
  if (response.stop_reason === "refusal") return { refused: true };
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new HttpError(502, "upstream_error", "Claude sent back nothing.");
  return { text, truncated: response.stop_reason === "max_tokens" };
}

// ---------- Ali's voice ----------
async function tts(body) {
  if (!hasTts) throw new HttpError(503, "not_configured", "No voice is set up on the server.");
  const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 1500);
  if (!text) throw new HttpError(400, "bad_request", "There is nothing to say.");
  const payload = { text };
  if (EL_TTS_MODEL) payload.model_id = EL_TTS_MODEL;
  const r = await fetch(`${EL_BASE}/v1/text-to-speech/${encodeURIComponent(EL_VOICE)}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": EL_KEY, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    console.error("[tts] ElevenLabs answered", r.status, (await r.text()).slice(0, 300));
    throw new HttpError(r.status === 429 ? 429 : 502, r.status === 429 ? "rate_limited" : "upstream_error", "The voice service had a problem.");
  }
  const j = await r.json();
  if (!j.audio_base64) throw new HttpError(502, "upstream_error", "The voice service sent no audio.");
  const a = j.alignment || {};
  return { audio: j.audio_base64, mime: "audio/mpeg", starts: Array.isArray(a.character_start_times_seconds) ? a.character_start_times_seconds : null };
}

// ---------- Ali's ears ----------
async function stt(req) {
  if (!hasStt) throw new HttpError(503, "not_configured", "Speech-to-text is not set up on the server.");
  const type = String(req.headers["content-type"] || "audio/webm").split(";")[0];
  if (!type.startsWith("audio/") && !type.startsWith("video/")) throw new HttpError(400, "bad_request", "Send the recording as audio.");
  const audio = await readBody(req, 6_000_000);
  if (audio.length < 800) throw new HttpError(400, "bad_request", "That recording was too short.");
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : type.includes("mpeg") ? "mp3" : "webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type }), "speech." + ext);
  let url, headers;
  if (STT_PROVIDER === "elevenlabs") {
    form.append("model_id", EL_STT_MODEL);
    url = `${EL_BASE}/v1/speech-to-text`;
    headers = { "xi-api-key": EL_KEY };
  } else {
    form.append("model", OA_STT_MODEL);
    url = `${OA_BASE}/v1/audio/transcriptions`;
    headers = { authorization: `Bearer ${OA_KEY}` };
  }
  const r = await fetch(url, { method: "POST", headers, body: form });
  if (!r.ok) {
    console.error("[stt]", STT_PROVIDER, "answered", r.status, (await r.text()).slice(0, 300));
    throw new HttpError(r.status === 429 ? 429 : 502, r.status === 429 ? "rate_limited" : "upstream_error", "The listening service had a problem.");
  }
  const j = await r.json();
  return { text: String(j.text || "").trim().slice(0, 1200) };
}

// ---------- the site's own files ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const PRIVATE = new Set(["server", "tools", "node_modules"]);
function serveFile(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, { error: "bad_request" });
  }
  if (rel.endsWith("/")) rel += "index.html";
  const parts = rel.split("/").filter(Boolean);
  // never serve dotfiles (such as .env), the server folder, or anything outside the site
  if (!parts.length || parts.some((p) => p.startsWith(".") || p === "..") || PRIVATE.has(parts[0])) return send(res, 404, { error: "not_found" });
  const file = path.join(siteRoot, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(siteRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: "not_found" });
  res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

// ---------- routing ----------
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ORIGINS.includes(origin) || ORIGINS.includes("*"))) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-headers", "content-type, x-eluvo-code");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-max-age", "600");
  }
}
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  cors(req, res);
  try {
    if (!pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method_not_allowed" });
      return serveFile(req, res, pathname);
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    if (pathname === "/api/health" && req.method === "GET") {
      return send(res, 200, { chat: hasChat, tts: hasTts, stt: hasStt, locked: Boolean(ACCESS_CODE), unlocked: unlocked(req) });
    }
    if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
    if (pathname === "/api/unlock") {
      limit(req, "unlock");
      const body = await readJson(req, 2000);
      if (ACCESS_CODE && body.code !== ACCESS_CODE) throw new HttpError(401, "need_code", "That code is not right.");
      return send(res, 200, { ok: true });
    }
    requireAccess(req);
    if (pathname === "/api/chat") {
      limit(req, "chat");
      return send(res, 200, await chat(await readJson(req)));
    }
    if (pathname === "/api/tts") {
      limit(req, "tts");
      return send(res, 200, await tts(await readJson(req, 20_000)));
    }
    if (pathname === "/api/stt") {
      limit(req, "stt");
      return send(res, 200, await stt(req));
    }
    return send(res, 404, { error: "not_found" });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.code, message: err.message });
    console.error("[server] unexpected error:", err);
    return send(res, 500, { error: "server_error", message: "Something went wrong on the server." });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`\nPort ${PORT} is already in use. Eluvo may already be running: try http://localhost:${PORT}/\nIf it is something else, add PORT=8788 to server/.env and start again.\n`);
  else console.error("\nThe server could not start:", err.message, "\n");
  process.exit(1);
});
// Resolves with the port once the server is listening. tools/start.mjs waits for this before opening the browser.
export const started = new Promise((resolve) => {
  server.listen({ port: PORT, host: HOST || undefined }, () => {
    console.log(`Eluvo server on http://localhost:${PORT}/quest.html`);
    console.log(`  Ali's brain  (Claude ${MODEL}): ${hasChat ? "ready" : "MISSING: set ANTHROPIC_API_KEY"}`);
    console.log(`  Ali's voice  (ElevenLabs):     ${hasTts ? "ready" : "off: set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID"}`);
    console.log(`  Ali's ears   (${STT_PROVIDER || "none"}):${" ".repeat(Math.max(1, 16 - (STT_PROVIDER || "none").length))}${hasStt ? "ready" : "off: set ELEVENLABS_API_KEY or OPENAI_API_KEY"}`);
    console.log(`  Access code: ${ACCESS_CODE ? "on" : "off"}   Allowed sites: ${ORIGINS.join(", ")}   Reachable from: ${HOST === "127.0.0.1" || HOST === "localhost" ? "this computer only" : "any computer that can reach this one"}`);
    resolve(PORT);
  });
});
