// Starts Eluvo on your own computer: installs what the server needs, asks for your keys once,
// starts the server and opens the site in your browser.
//   node tools/start.mjs            start
//   node tools/start.mjs --keys     ask for every key again (Enter keeps the one already saved)
//   node tools/start.mjs --no-open  start without opening the browser
// On Windows double-click start.bat; on a Mac double-click start.command. Both run this file.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Writable } from "node:stream";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, "server");
const envFile = path.join(serverDir, ".env");
const args = new Set(process.argv.slice(2));

function stop(message) {
  console.error("\n" + message + "\n");
  process.exit(1);
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) stop(`Eluvo needs Node.js 20 or newer. This computer has ${process.versions.node}.\nGet the LTS version from https://nodejs.org, install it, then start again.`);

console.log("\nEluvo: starting on this computer\n");

// ---------- 1. what the server needs ----------
if (!fs.existsSync(path.join(serverDir, "node_modules", "@anthropic-ai", "sdk", "package.json"))) {
  console.log("Installing what the server needs. This happens once and takes a minute.\n");
  const r = spawnSync("npm install --no-audit --no-fund", { cwd: serverDir, stdio: "inherit", shell: true });
  if (r.status !== 0) stop("The install did not finish. Check your internet connection, then start again.");
  console.log("");
}

// ---------- 2. keys, kept in server/.env on this computer ----------
function readEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}
function setEnv(text, key, value) {
  const line = new RegExp("^[ \\t]*" + key + "[ \\t]*=.*$", "m");
  if (line.test(text)) return text.replace(line, () => key + "=" + value);
  return text.replace(/\n*$/, "\n") + key + "=" + value + "\n";
}

// Asks a question in the terminal. What is typed or pasted is not shown on screen.
const out = new Writable({
  write(chunk, encoding, done) {
    if (!out.hidden) process.stdout.write(chunk, encoding);
    done();
  },
});
async function askHidden(rl, label, alreadySaved) {
  const answer = new Promise((resolve) => rl.question("  " + label + (alreadySaved ? " (Enter keeps the saved one)" : "") + ": ", resolve));
  out.hidden = true;
  const value = (await answer).trim().replace(/^(["'])(.*)\1$/, "$2");
  out.hidden = false;
  process.stdout.write(value ? "saved (ends in " + value.slice(-4) + ")\n" : alreadySaved ? "kept\n" : "skipped\n");
  return value;
}

const firstRun = !fs.existsSync(envFile);
let envText = firstRun ? fs.readFileSync(path.join(serverDir, ".env.example"), "utf8").replace(/^# Copy this file to.*\n/, "# Your keys for Eluvo. This file stays on this computer.\n") : fs.readFileSync(envFile, "utf8");
const saved = readEnv(envText);
const has = (key) => Boolean(process.env[key] || saved[key]);
const askAll = firstRun || args.has("--keys");

if (process.stdin.isTTY && (askAll || !has("ANTHROPIC_API_KEY"))) {
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
  const ask = async (key, label) => {
    const value = await askHidden(rl, label, Boolean(saved[key]));
    if (value) {
      saved[key] = value;
      envText = setEnv(envText, key, value);
    }
    return value;
  };
  console.log(askAll ? "Ali needs keys to talk. Paste each one and press Enter, or press Enter alone to skip it.\nWhat you paste stays hidden.\n" : "Ali cannot reply without an Anthropic API key. Paste it and press Enter, or press Enter alone to carry on without him.\nWhat you paste stays hidden.\n");
  const brain = await ask("ANTHROPIC_API_KEY", "Anthropic API key, for Ali's replies");
  if (brain && !brain.startsWith("sk-ant-")) console.log("    Check that one: Anthropic keys start with sk-ant-. It was saved as you gave it.");
  if (askAll) {
    await ask("ELEVENLABS_API_KEY", "ElevenLabs API key, for his voice and hearing");
    if (saved.ELEVENLABS_API_KEY) await ask("ELEVENLABS_VOICE_ID", "ElevenLabs Voice ID, the voice he speaks with");
    await ask("OPENAI_API_KEY", "OpenAI API key, only if Whisper should do the hearing");
    if (saved.OPENAI_API_KEY && !saved.ELEVENLABS_API_KEY) envText = setEnv(envText, "STT_PROVIDER", "openai");
  }
  rl.close();
  console.log("");
}
if (firstRun || envText !== fs.readFileSync(envFile, "utf8")) {
  fs.writeFileSync(envFile, envText, { mode: 0o600 });
  console.log("Keys are kept in " + envFile + "\nThat file stays on this computer. To change a key later, edit it or start with --keys.\n");
}

// ---------- 3. the server, and the browser ----------
// Only this computer can reach the server, so nobody else on the network can spend the keys.
if (!process.env.HOST) process.env.HOST = "127.0.0.1";
const { started } = await import(pathToFileURL(path.join(serverDir, "server.mjs")).href);
const port = await started;
const url = `http://localhost:${port}/`;

console.log(`\nEluvo is running. Open ${url}`);
console.log(`Talk to Ali at ${url}quest.html`);
console.log("Keep this window open while you use the site. Close it, or press Ctrl+C, to stop.\n");

if (!args.has("--no-open")) {
  const [cmd, cmdArgs] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, cmdArgs, { stdio: "ignore", detached: true });
    child.on("error", () => {}); // no browser opener on this computer: the address is printed above
    child.unref();
  } catch {}
}
