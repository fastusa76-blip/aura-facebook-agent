# AURA Facebook Agent

A local-first Facebook Page assistant designed to integrate with AURA Windows Assistant.

## Goals
- Draft Facebook Page posts and require explicit approval before publishing.
- Publish through Meta Graph API using a Page access token supplied by the owner.
- Keep an auditable record of actions.
- Add scheduling, comment/inbox workflows, and Urdu tutorial-video creation in later phases.
- Prefer free and local tools; no paid AI API is required for the initial MVP.

## Current status
**Phase 1 scaffold / MVP foundation.** The implementation has draft, approval, audit, health, and approval-gated publish endpoints. Drafts and audit events are currently stored in memory, so they reset when the process restarts. This is not production-ready until persistent storage, OAuth/token lifecycle, authenticated AURA access, rate limiting, and automated tests are completed.

## Setup
Requirements: Node.js 20+, npm, Meta Developer app and approved Page permissions for real publishing.

1. Copy .env.example to .env.
2. Set a long random AURA_AGENT_SECRET and keep .env out of Git.
3. Set META_GRAPH_API_VERSION to a currently supported version from Meta's official docs.
4. Only when ready to test real publishing, set META_PAGE_ID and META_PAGE_ACCESS_TOKEN locally.
5. Run: npm install, npm run typecheck, npm test, npm run dev.

The service binds to 127.0.0.1 by default. API requests require an Authorization Bearer token matching AURA_AGENT_SECRET.

## API
- GET /health
- POST /api/facebook/posts/draft
- GET /api/facebook/posts
- POST /api/facebook/posts/:id/approve
- POST /api/facebook/posts/:id/publish
- GET /api/facebook/audit

Draft request JSON: { "caption": "السلام علیکم! یہ ایک ٹیسٹ پوسٹ ہے۔" }. Approval requires the contentHash returned by the draft endpoint. Publishing is disabled unless the Page ID, Page access token, and Graph API version are configured.

## Free-first design
Drafting, approval, scheduling logic, local video rendering, and audit logic can run without paid AI APIs. Meta permissions, app review, platform limits, and policy requirements still apply. Local video rendering can use FFmpeg; Urdu TTS depends on availability of a suitable local voice. No tool can guarantee 1,000,000 views; reach depends on audience response and platform distribution.

## Security notes
- Never store Facebook passwords or commit tokens.
- Use OAuth and least-privilege permissions for production.
- Keep secrets in local environment variables or a secure OS credential store.
- Approval is bound to a content hash; editing the draft invalidates approval.
- Current in-memory storage is a development scaffold, not durable production storage.

## Roadmap
1. MVP API, approval gates, and audit events.
2. Persistent SQLite storage, schema migrations, and tests.
3. Meta OAuth/page discovery and secure token handling.
4. Scheduler with idempotency and reconciliation.
5. Comment and Messenger workflows within Meta permissions/policies.
6. Urdu script, subtitles, local TTS, FFmpeg rendering, and preview.
7. AURA HUD integration, CI checks, and end-to-end verification.
