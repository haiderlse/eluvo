# Eluvo server

A small program that lets Ali work on the website. It holds the API keys, so they never appear in the site's public code.

| Part of Ali | Service | Key needed |
|---|---|---|
| Brain (his replies) | Claude, through the Anthropic API | `ANTHROPIC_API_KEY` (required) |
| Voice (he speaks, mouth and subtitles follow the sound) | ElevenLabs | `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` |
| Ears (people can speak their reply) | ElevenLabs, or OpenAI Whisper | the ElevenLabs key, or `OPENAI_API_KEY` |

An Anthropic API key is separate from a Claude.ai subscription. Create one at https://console.anthropic.com.

Without the voice key the page falls back to the browser's built-in voice. Without a listening key the microphone button is hidden. Without the Claude key Ali cannot reply at all.

## Run it on your own computer

You need Node.js 20 or newer (the LTS version from https://nodejs.org).

- Windows: double-click `start.bat` in the top folder.
- Mac: double-click `start.command` in the top folder.
- Any terminal, from the top folder:

```bash
node tools/start.mjs
```

The first start installs what the server needs, asks for your keys and saves them in `server/.env`, starts the server and opens http://localhost:8787/. The start-up message says which of the three parts are ready. What you paste at the prompts is hidden.

- `node tools/start.mjs --keys` asks for every key again. Pressing Enter keeps the one already saved.
- `node tools/start.mjs --no-open` starts without opening the browser.
- Started this way, the server answers only this computer (`HOST=127.0.0.1`), so nobody else on the network can spend your keys.
- If port 8787 is taken, add `PORT=8788` to `server/.env`.

`server/.env` is listed in `.gitignore`, so git will not upload it. Never paste keys into any other file.

To do the same by hand: `cd server`, `npm install`, copy `.env.example` to `.env`, fill it in, `npm start`.

## Put it online

The site on GitHub Pages cannot run this program, so it needs a host that runs Node.js (Render, Railway, Fly.io and similar all work).

1. Create a web service from this repository with the root directory set to `server`, build command `npm install`, start command `npm start`.
2. Add the same settings as in `.env` using the host's environment-variable screen. Do not upload the `.env` file.
3. Set `ACCESS_CODE` to something only your testers know.
4. Set `ALLOWED_ORIGINS` to the address of the website, for example `https://haiderlse.github.io`.
5. Put the service's address in `config.js` at the top of the repository:
   `window.ELUVO_API = "https://your-service.example.com";`
6. Commit and push `config.js`. The website's "Talk to Ali" page will now use the server.

## Keeping costs under control

Anyone who can reach the server can spend your credits, so it has three guards:

- `ACCESS_CODE`: visitors must enter this code before Ali will talk.
- `ALLOWED_ORIGINS`: only the listed websites may call the server from a browser.
- `DAILY_LIMIT`: the total number of requests per day across all visitors (default 600), plus a per-visitor limit every five minutes.

Ali's instructions live on the server (`rules.txt`), so the endpoint cannot be used as a general-purpose chatbot.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | The Claude model. A smaller model such as `claude-haiku-5-5` is cheaper and faster. |
| `ANTHROPIC_EFFORT` | `low` | How long Claude thinks before replying. `low` keeps a spoken chat quick. |
| `ELEVENLABS_TTS_MODEL` | ElevenLabs' default | The voice model. |
| `ELEVENLABS_STT_MODEL` | `scribe_v2` | The ElevenLabs speech-to-text model. |
| `STT_PROVIDER` | `elevenlabs` if that key is set, otherwise `openai` | Which service listens. |
| `OPENAI_STT_MODEL` | `whisper-1` | The OpenAI speech-to-text model. OpenAI has announced that `whisper-1` shuts down on 26 February 2027. |
| `PORT` | `8787` | The port to listen on. |
| `HOST` | all addresses | Which address to listen on. `tools/start.mjs` sets `127.0.0.1` (this computer only); a host needs the default. |

If a safety check declines a request, the Anthropic API retries it once on a fallback model (the `fallbacks: "default"` option). This applies to the default model and is skipped for models that do not support it.

## Changing what Ali says

Ali's instructions and the page itself live in one file, `artifact/c-quest.html`. After editing it, rebuild the website copy and the server's copy of the instructions:

```bash
node tools/build-site.mjs
```

## What has and has not been tested

The server and page were tested end to end against stand-in services that imitate Anthropic, ElevenLabs and OpenAI. They have not yet been run with real keys, so the first run with yours is the real test. The start program was tested on Linux; `start.bat` has not been run on Windows, nor `start.command` on a Mac. The request formats for ElevenLabs and OpenAI were taken from their public documentation as of November 2026.
