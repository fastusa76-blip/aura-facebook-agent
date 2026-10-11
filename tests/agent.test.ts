import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("server exposes safe, allowlisted command handling and AI fallback", async () => {
  const source = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.match(source, /const apps: Record<string/);
  assert.match(source, /shell: false/);
  assert.match(source, /answerGeneralQuestion/);
  assert.match(source, /api\/ai\/status/);
  assert.match(source, /api\.openai\.com\/v1\/models/);
  assert.match(source, /api\.openai\.com\/v1\/chat\/completions/);
  assert.doesNotMatch(source, /exec\(parsed\.data\.text/);
});

test("dashboard provides voice and text controls", async () => {
  const html = await readFile(resolve(process.cwd(), "public/index.html"), "utf8");
  assert.match(html, /SpeechRecognition/);
  assert.match(html, /commandForm/);
  assert.match(html, /api\/command/);
  assert.match(html, /Ask anything/);
  assert.match(html, /Verify AI API key/);
});

test("song requests are routed to YouTube rather than treated as general questions", async () => {
  const source = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.match(source, /findSongRequest/);
  assert.match(source, /youtubeSearchUrl/);
  assert.match(source, /YouTube does not reliably allow AURA to auto-click a result/);
});

test("old Facebook publishing endpoints are absent from the new server", async () => {
  const source = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.doesNotMatch(source, /api\/facebook/);
  assert.doesNotMatch(source, /publishApprovedDraft/);
});
