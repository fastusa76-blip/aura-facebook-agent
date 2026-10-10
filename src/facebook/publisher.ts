import { config } from "../config.js";
import type { PostDraft } from "./store.js";
export class PublishingNotConfiguredError extends Error {
  constructor() {
    super("Publishing is not configured. Set the Meta Graph API version, Page ID, and Page access token locally.");
    this.name = "PublishingNotConfiguredError";
  }
}
export async function publishApprovedDraft(draft: PostDraft): Promise<string> {
  if (!config.graphApiVersion || !config.pageId || !config.pageAccessToken) throw new PublishingNotConfiguredError();
  const endpoint = new URL("https://graph.facebook.com/" + config.graphApiVersion + "/" + encodeURIComponent(config.pageId) + "/feed");
  const body = new URLSearchParams({ message: draft.caption, access_token: config.pageAccessToken });
  if (draft.link) body.set("link", draft.link);
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
    signal: AbortSignal.timeout(15000)
  });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Meta Graph API rejected the publish request (HTTP " + response.status + ")");
  if (typeof result !== "object" || result === null || !("id" in result) || typeof result.id !== "string") {
    throw new Error("Meta response did not contain a post ID; reconcile the Page before retrying.");
  }
  return result.id;
}
