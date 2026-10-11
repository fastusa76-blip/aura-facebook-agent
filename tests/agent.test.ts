import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("server exposes safe, allowlisted command handling", async () => {
  const source = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.match(source, /const apps: Record<string/);
  assert.match(source, /shell: false/);
  assert.match(source, /command\.rejected/);
  assert.doesNotMatch(source, /exec\(parsed\.data\.text/);
});

test("dashboard provides voice and text controls", async () => {
  const html = await readFile(resolve(process.cwd(), "public/index.html"), "utf8");
  assert.match(html, /SpeechRecognition/);
  assert.match(html, /commandForm/);
  assert.match(html, /api\/command/);
});

test("old Facebook publishing endpoints are absent from the new server", async () => {
  const source = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.doesNotMatch(source, /api\/facebook/);
  assert.doesNotMatch(source, /publishApprovedDraft/);
});
