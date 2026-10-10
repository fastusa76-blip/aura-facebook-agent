import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  AURA_AGENT_SECRET: z.string().min(24, "AURA_AGENT_SECRET must be at least 24 characters"),
  META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/, "Set a supported Graph API version").optional().or(z.literal("")),
  META_PAGE_ID: z.string().optional().or(z.literal("")),
  META_PAGE_ACCESS_TOKEN: z.string().optional().or(z.literal(""))
});
const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message);
  throw new Error("Invalid configuration:\n" + messages.join("\n"));
}
export const config = {
  host: parsed.data.HOST,
  port: parsed.data.PORT,
  agentSecret: parsed.data.AURA_AGENT_SECRET,
  graphApiVersion: parsed.data.META_GRAPH_API_VERSION || "",
  pageId: parsed.data.META_PAGE_ID || "",
  pageAccessToken: parsed.data.META_PAGE_ACCESS_TOKEN || ""
};
