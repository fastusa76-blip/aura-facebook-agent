import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash")
});
const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error("Invalid configuration: " + parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "));
}
export const config = {
  host: parsed.data.HOST,
  port: parsed.data.PORT,
  geminiApiKey: parsed.data.GEMINI_API_KEY,
  geminiModel: parsed.data.GEMINI_MODEL
};
