# Eluvo

Grow forward.

Mockups for Eluvo, a free site that helps people who feel stuck with work or study find what is really holding them back, then gives them one next step. Live at https://haiderlse.github.io/eluvo/.

## Run it on your own computer

1. **Download.** On the repository page press the green **Code** button, then **Download ZIP**, and unzip it. (Direct link: https://github.com/haiderlse/eluvo/archive/refs/heads/main.zip)
2. **Install Node.js** if the computer does not have it: get the LTS version from https://nodejs.org.
3. **Start.**
   - Windows: double-click `start.bat`. If Windows shows "Windows protected your PC", press **More info**, then **Run anyway**.
   - Mac: double-click `start.command`. If macOS refuses to open it, right-click the file and choose **Open**, or allow it under System Settings, Privacy & Security.
   - Linux, or any terminal: `node tools/start.mjs`

The first start installs what the server needs, asks for your keys, then opens the site at http://localhost:8787/. What you paste is hidden as you paste it, and is saved in `server/.env` on your computer only. Keep the window open while you use the site; close it to stop.

| Key | What it gives Ali | Needed? |
|---|---|---|
| Anthropic API key | His replies | Yes. Without it the site works but Ali cannot answer. This is separate from a Claude.ai subscription. |
| ElevenLabs API key and Voice ID | His voice, and hearing you through the microphone | No. Without it he uses the browser's built-in voice. |
| OpenAI API key | Hearing through Whisper, if there is no ElevenLabs key | No. |

To change a key later, start with `--keys` (for example `node tools/start.mjs --keys`) or edit `server/.env`.

Only this computer can reach a site started this way. To look at the pages without Ali and without installing anything, double-click `index.html`.

More detail, and how to put Ali online for other people, is in `server/README.md`.

## What is in here

- `index.html` – coach directory mockup with Kim Ali as co-founder and a Coach Kim AI chat. On GitHub Pages the chat uses scripted demo replies; the live AI version runs inside claude.ai.
- `quest.html` – "Talk to Ali": the C-Quest session on the website. Ali, an AI character, sits in his room, speaks with subtitles and listens. It needs the small server in `server/` for his replies, voice and hearing; without it the page says so and links to the Claude-hosted version and the scripted preview. Generated from `artifact/c-quest.html` by `node tools/build-site.mjs`.
- `artifact/c-quest.html` – the one source file for the session. It also runs as a Claude artifact (https://claude.ai/artifact/JZMMFAqmiBjt3LBfHMrdu1), where Claude itself provides the replies and voice.
- `server/` – the server that holds the API keys (Anthropic, ElevenLabs, optionally OpenAI Whisper). See `server/README.md`.
- `start.bat`, `start.command`, `tools/start.mjs` – start the site on your own computer (see above).
- `config.js` – where the website looks for that server.
- `quest-preview.html` – scripted C-Quest preview with no AI: voices quiz, Leader skills kit, one retail scene per voice, small real action, debrief and profile.
- `coaches.html` – pitch page for coaches: how the AI coach is trained, what coaches keep, waitlist.
- `providers.html` – pitch page for employment providers and universities, with an example cohort dashboard.
- `brand-guide.html` – brand guide v2: logo, colours, type, tagline, voice.
- `logo/` – logo SVGs (full, reversed, symbol). `kim.jpg` and `kim-avatar.jpg` are the coach photos. `og.png` is the link-preview image.

## What Eluvo does

Eluvo helps young people work out what is really holding them back, then gives them one next step. A two-minute check in the chat ends with a named blocker; guides, practice and human coaches are matched to it.

## Blockers (draft, for Kiran to correct)

The eight blockers and the questions that tell them apart are a first draft, written to make the mockup work. They live in `BLOCKERS`, `BEH` and `VOICE` in `index.html`.

| Blocker | What it looks like | What helps |
|---|---|---|
| Bracing for another no | After knock-backs, not applying feels safer than risking another no | One small, low-stakes attempt |
| Can't see what you offer | Judging yourself by job titles you haven't had yet | Naming three strengths from real moments |
| No clear direction | Can't push toward something you can't picture | A direction good enough to test |
| Too much at once | Everything feels urgent, so nothing starts | Shrinking the week to one thing |
| Nerves on the day | Fine until someone is watching | Practising out loud |
| A how-to gap | Nobody showed you how this part works | Learning the one missing piece and using it |
| Working hard, standing still | Good work, waiting to be noticed | Making the work visible and asking what comes next |
| Life outside is taking the room | Money, family, health or housing is using the energy | Lightening one thing, and bringing a person in |

The blockers sit under the four pathways from the strategic foundation:

- I want to know what I want: No clear direction, Can't see what you offer
- I want to grow my confidence: Bracing for another no, Nerves on the day
- I want to get a job ASAP: A how-to gap, Too much at once
- I want to grow my career: Working hard, standing still
- No pathway (a person first): Life outside is taking the room

The check asks: what's going on (own words), what happens when it is time to act, which voice in your head sounds most familiar, and confidence from 1 to 10. The person then says whether the result fits ("Yes, that's it" / "Not quite").

Only Kim Ali's profile is real. Every other coach is an invented example.

Hosted with GitHub Pages.
