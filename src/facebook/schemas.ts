import { z } from "zod";
export const CreateDraftSchema = z.object({
  caption: z.string().trim().min(1).max(5000),
  link: z.string().url().optional()
});
export const ApproveDraftSchema = z.object({
  contentHash: z.string().regex(/^[a-f0-9]{64}$/)
});
export type CreateDraftInput = z.infer<typeof CreateDraftSchema>;
