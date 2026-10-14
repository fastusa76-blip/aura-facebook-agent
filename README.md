# AURA Windows Voice AI

A local-first Windows desktop assistant controlled by voice or text.

## Current capabilities
- Browser dashboard with microphone input, transcript, spoken responses, and system overview.
- Opens YouTube in Google Chrome using a fixed HTTPS URL.
- Song requests such as `Play Atif Aslam`, `Play Pasoori song`, or `YouTube par Atif Aslam chalao` open YouTube search results.
- Launches Chrome, Notepad, Calculator, and File Explorer.
- Reports basic system diagnostics and writes a local JSONL audit log to `data/audit.jsonl`.
- Server binds to `127.0.0.1` by default.

## Configure Google Gemini (Google AI Studio)
1. Create or copy a Gemini API key at https://aistudio.google.com/apikey.
2. Copy `.env.example` to `.env` in the project root.
3. Open `.env` and set `GEMINI_API_KEY=your_key_here`. Keep the key private; `.env` is ignored by Git.
4. Optional: set `GEMINI_MODEL=gemini-2.5-flash` (this is the default).
5. Start AURA and use **Verify Gemini API key** in the dashboard to test a small request.

General questions use the Google Gen AI SDK and Gemini. Supported local actions (opening approved apps, YouTube search, and system status) remain handled by AURA's allowlist rather than being executed by the model.

## Requirements and startup
- Windows 10/11
- Node.js 20 or later and npm
- A supported browser for Web Speech API microphone input

```powershell
npm install
npm run check
npm run dev
```

Open http://127.0.0.1:4317. If the microphone is unavailable, use the text command field.

## Example commands
- `Open YouTube` / `یوٹیوب کھولو`
- `Play Atif Aslam`
- `Play Pasoori song`
- `YouTube par Atif Aslam chalao`
- `Open Chrome`, `Open Notepad`, `Open Calculator`, `Open File Explorer`
- `System status` / `کمپیوٹر کی حالت`

## Important limitations
A song command opens YouTube search results. AURA does not automatically choose a video or guarantee playback because results can be ambiguous and browser autoplay policies vary. Click the correct result to start the song.

This version intentionally does not execute arbitrary spoken shell commands. Unknown requests are sent to Gemini for conversational answers; the model cannot directly execute commands. File deletion, registry edits, process termination, network resets, purchases, and other consequential actions need separate previews, explicit approval, and audit logging before implementation. Browser speech recognition may send audio to the browser provider; review your browser privacy settings.

## Safety model
Natural-language input is untrusted. The server maps supported phrases to predefined actions and launches programs with shell execution disabled where possible. Website navigation is restricted to AURA-generated YouTube URLs; song names are URL-encoded and never interpreted as commands.
