# AURA Windows Voice AI

A local-first Windows desktop assistant controlled by voice or text.

## Current capabilities
- Browser dashboard with microphone input, transcript, spoken responses, and system overview.
- Opens YouTube in Google Chrome using a fixed HTTPS URL.
- Song requests such as `Play Atif Aslam`, `Play Pasoori song`, or `YouTube par Atif Aslam chalao` open YouTube search results.
- Launches Chrome, Notepad, Calculator, and File Explorer.
- Reports basic system diagnostics and writes a local JSONL audit log to `data/audit.jsonl`.
- Server binds to `127.0.0.1` by default.

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

This version intentionally does not execute arbitrary spoken PowerShell, CMD, or shell commands. Unknown commands are rejected rather than guessed. File deletion, registry edits, process termination, network resets, purchases, and other consequential actions need separate previews, explicit approval, and audit logging before implementation. Browser speech recognition may send audio to the browser provider; review your browser privacy settings.

## Safety model
Natural-language input is untrusted. The server maps supported phrases to predefined actions and launches programs with shell execution disabled where possible. Website navigation is restricted to AURA-generated YouTube URLs; song names are URL-encoded and never interpreted as commands.
