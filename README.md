# AURA Windows Voice AI

A local-first starter for a professional Windows desktop assistant controlled by voice or text. This repository is no longer a Facebook publishing agent.

## Current MVP
- Browser dashboard with microphone button, transcript, spoken responses, and system overview.
- Basic read-only system diagnostics.
- Explicit allowlist for launching Chrome, Notepad, Calculator, and File Explorer.
- Local JSONL audit log in `data/audit.jsonl`.
- Server binds to `127.0.0.1` by default.
- No arbitrary PowerShell, CMD, or shell execution from voice input.

## Requirements
- Windows 10/11
- Node.js 20 or later and npm
- A supported browser for Web Speech API microphone input (support and language accuracy vary by browser/provider)

## Run locally
```powershell
npm install
npm run typecheck
npm test
npm run dev
```
Open http://127.0.0.1:4317. If the microphone is unavailable, use the text command field.

## Supported starter commands
- `Open Chrome`
- `Open Notepad`
- `Open Calculator`
- `Open File Explorer`
- `System status`
- Urdu diagnostics aliases: `کمپیوٹر کی حالت`, `سسٹم کی حالت`

The first version deliberately uses a fixed allowlist. It does not yet include a cloud/local LLM, wake-word detection, unrestricted file operations, or general-purpose automation. Browser speech recognition may send audio to the browser vendor's recognition service; check your browser's privacy settings.

## Safety model
Natural-language input is treated as untrusted. The server maps only exact supported patterns to predefined actions and launches allowlisted applications without a shell. Unknown commands are rejected. Never add an endpoint that runs arbitrary user-supplied shell strings. Before adding file deletion, registry edits, network resets, or process termination, implement dry-run previews, explicit confirmation, capability checks, and audit records.

## Roadmap
1. Starter dashboard, voice/text commands, basic diagnostics, allowlisted app launching.
2. Local speech recognition option and Urdu/Roman Urdu intent normalization.
3. Typed action plans, risk labels, dry-run previews, explicit approval, and verification.
4. Secure local memory, settings, tests, and persistent audit review.
5. Optional LLM provider behind a policy engine; AI proposes plans but never executes shell commands directly.
6. Windows packaging and installer after integration tests pass.

This is an early development scaffold, not a production-ready autonomous agent.