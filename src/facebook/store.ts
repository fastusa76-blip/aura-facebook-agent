import { createHash, randomUUID } from "node:crypto";
export type DraftStatus = "pending_approval" | "approved" | "published" | "failed";
export interface PostDraft {
  id: string; caption: string; link?: string; contentHash: string; status: DraftStatus;
  createdAt: string; approvedAt?: string; publishedAt?: string; metaPostId?: string;
}
export interface AuditEvent {
  id: string; action: string; postId?: string; outcome: "success" | "denied" | "failure" | "info";
  timestamp: string; details?: Record<string, string>;
}
const drafts = new Map<string, PostDraft>();
const events: AuditEvent[] = [];
export function hashContent(caption: string, link?: string): string {
  return createHash("sha256").update(JSON.stringify({ caption, link: link ?? null })).digest("hex");
}
export function addDraft(input: { caption: string; link?: string }): PostDraft {
  const draft: PostDraft = {
    id: randomUUID(), caption: input.caption, ...(input.link ? { link: input.link } : {}),
    contentHash: hashContent(input.caption, input.link), status: "pending_approval", createdAt: new Date().toISOString()
  };
  drafts.set(draft.id, draft); audit("draft.created", "success", draft.id); return draft;
}
export function getDraft(id: string): PostDraft | undefined { return drafts.get(id); }
export function listDrafts(): PostDraft[] { return [...drafts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export function approveDraft(id: string, expectedHash: string): PostDraft | undefined {
  const draft = drafts.get(id);
  if (!draft || draft.status !== "pending_approval") return undefined;
  if (hashContent(draft.caption, draft.link) !== expectedHash || draft.contentHash !== expectedHash) return undefined;
  draft.status = "approved"; draft.approvedAt = new Date().toISOString(); audit("draft.approved", "success", id); return draft;
}
export function markPublished(id: string, metaPostId: string): PostDraft | undefined {
  const draft = drafts.get(id);
  if (!draft || draft.status !== "approved") return undefined;
  draft.status = "published"; draft.publishedAt = new Date().toISOString(); draft.metaPostId = metaPostId;
  audit("post.published", "success", id, { metaPostId }); return draft;
}
export function markFailed(id: string, reason: string): void {
  const draft = drafts.get(id); if (draft) draft.status = "failed";
  audit("post.publish_failed", "failure", id, { reason: reason.slice(0, 200) });
}
export function audit(action: string, outcome: AuditEvent["outcome"], postId?: string, details?: Record<string, string>): void {
  events.push({ id: randomUUID(), action, outcome, timestamp: new Date().toISOString(), ...(postId ? { postId } : {}), ...(details ? { details } : {}) });
  if (events.length > 2000) events.splice(0, events.length - 2000);
}
export function listAuditEvents(): AuditEvent[] { return [...events].reverse(); }
