import test from "node:test";
import assert from "node:assert/strict";
import { addDraft, approveDraft, hashContent } from "../src/facebook/store.js";
test("draft starts pending approval", () => {
  const draft = addDraft({ caption: "اردو ٹیسٹ پوسٹ" });
  assert.equal(draft.status, "pending_approval");
  assert.equal(draft.contentHash, hashContent("اردو ٹیسٹ پوسٹ"));
});
test("approval rejects a mismatched content hash", () => {
  const draft = addDraft({ caption: "Original caption" });
  assert.equal(approveDraft(draft.id, "0".repeat(64)), undefined);
});
test("approval succeeds only for matching hash and pending draft", () => {
  const draft = addDraft({ caption: "Approved caption" });
  const approved = approveDraft(draft.id, draft.contentHash);
  assert.equal(approved?.status, "approved");
  assert.equal(approveDraft(draft.id, draft.contentHash), undefined);
});
