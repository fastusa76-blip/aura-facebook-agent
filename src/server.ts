import express, { type NextFunction, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { ApproveDraftSchema, CreateDraftSchema } from "./facebook/schemas.js";
import { addDraft, approveDraft, audit, getDraft, listAuditEvents, listDrafts, markFailed, markPublished } from "./facebook/store.js";
import { publishApprovedDraft, PublishingNotConfiguredError } from "./facebook/publisher.js";
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function requireAgentSecret(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied || !safeEqual(supplied, config.agentSecret)) {
    audit("auth.denied", "denied"); res.status(401).json({ error: "Unauthorized" }); return;
  }
  next();
}
app.get("/health", (_req, res) => res.json({ status: "ok", service: "aura-facebook-agent", mode: "approval-gated" }));
app.use("/api", requireAgentSecret);
app.post("/api/facebook/posts/draft", (req, res) => {
  const parsed = CreateDraftSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid draft", issues: parsed.error.issues }); return; }
  const draft = addDraft(parsed.data); res.status(201).json({ draft, approvalRequired: true });
});
app.get("/api/facebook/posts", (_req, res) => res.json({ posts: listDrafts() }));
app.post("/api/facebook/posts/:id/approve", (req, res) => {
  const parsed = ApproveDraftSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid approval request", issues: parsed.error.issues }); return; }
  const id = req.params.id ?? ""; const draft = approveDraft(id, parsed.data.contentHash);
  if (!draft) { audit("draft.approval_denied", "denied", id); res.status(409).json({ error: "Draft not found, already processed, or content hash mismatch" }); return; }
  res.json({ draft, message: "Draft approved. Publishing is a separate explicit action." });
});
app.post("/api/facebook/posts/:id/publish", async (req, res) => {
  const id = req.params.id ?? ""; const draft = getDraft(id);
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
  if (draft.status !== "approved") {
    audit("post.publish_denied", "denied", draft.id, { reason: "approval_required" });
    res.status(409).json({ error: "Approval is required before publishing" }); return;
  }
  try {
    const metaPostId = await publishApprovedDraft(draft);
    const updated = markPublished(draft.id, metaPostId); res.json({ post: updated, metaPostId });
  } catch (error) {
    const message = error instanceof PublishingNotConfiguredError ? error.message :
      error instanceof Error ? error.message : "Unknown publishing error";
    markFailed(id, message);
    res.status(error instanceof PublishingNotConfiguredError ? 503 : 502).json({ error: message });
  }
});
app.get("/api/facebook/audit", (_req, res) => res.json({ events: listAuditEvents() }));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(400).json({ error: message });
});
app.listen(config.port, config.host, () => console.log("AURA Facebook Agent listening on http://" + config.host + ":" + config.port));
