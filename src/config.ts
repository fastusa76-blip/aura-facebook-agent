import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini")
});
const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error("Invalid configuration: " + parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "));
}
export const config = {
  host: parsed.data.HOST,
  port: parsed.data.PORT,
  openaiApiKey: parsed.data.OPENAI_API_KEY,
  openaiModel: parsed.data.OPENAI_MODEL
};
