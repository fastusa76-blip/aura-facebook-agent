import express, { type Request, type Response, type NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";
import { spawn } from "node:child_process";
import os from "node:os";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { config } from "./config.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(resolve(process.cwd(), "public")));
const auditDir = resolve(process.cwd(), "data");
const auditPath = resolve(auditDir, "audit.jsonl");

async function audit(event: string, outcome: string, details: Record<string, unknown> = {}) {
  await mkdir(auditDir, { recursive: true });
  await appendFile(auditPath, JSON.stringify({ at: new Date().toISOString(), event, outcome, details }) + "\n", "utf8");
}

const CommandSchema = z.object({
  text: z.string().trim().min(1).max(500),
  approved: z.boolean().optional().default(false)
});

const apps: Record<string, { label: string; file: string; args: string[] }> = {
  chrome: { label: "Google Chrome", file: "cmd.exe", args: ["/c", "start", "", "chrome"] },
  notepad: { label: "Notepad", file: "notepad.exe", args: [] },
  calculator: { label: "Calculator", file: "calc.exe", args: [] },
  explorer: { label: "File Explorer", file: "explorer.exe", args: [] }
};

function launch(appKey: string): Promise<string> {
  const item = apps[appKey];
  if (!item) return Promise.reject(new Error("This application is not on AURA's allowlist."));
  return new Promise((resolvePromise, reject) => {
    const child = spawn(item.file, item.args, { windowsHide: true, shell: false, detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolvePromise(item.label + " launch requested."); });
  });
}

function openInBrowser(url: string): Promise<void> {
  // URLs must be created internally by AURA, never accepted directly from speech.
  if (!/^https:\/\/www\.youtube(?:music)?\.com\/(?:$|results\?search_query=)/.test(url)) {
    return Promise.reject(new Error("AURA can only open approved YouTube pages."));
  }
  return new Promise((resolvePromise, reject) => {
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      windowsHide: true, shell: false, detached: true, stdio: "ignore"
    });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolvePromise(); });
  });
}

function youtubeSearchUrl(query: string, music = false): string {
  return "https://www." + (music ? "youtube.com" : "youtube.com") + "/results?search_query=" + encodeURIComponent(query.trim());
}

function systemStatus(): string {
  const memoryUsed = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
  return "Your computer is running. " + os.cpus().length + " CPU cores detected, and memory usage is about " + memoryUsed + "%. ";
}

function findSongRequest(original: string): string | undefined {
  const patterns = [
    /^(?:please\s+)?(?:play|put on|listen to|start playing)(?:\s+(?:the\s+)?(?:song|music|track))?\s+(.+)$/i,
    /^(?:search|find)\s+(?:youtube\s+for\s+)?(.+?)(?:\s+on\s+youtube)?$/i,
    /^youtube\s+(?:par|pe)\s+(.+?)\s+(?:chalao|chala\s+do|play\s+karo)$/i,
    /^(?:gaana|gana|song|music)\s+(?:chalao|chala do|play karo)\s+(.+)$/i,
    /^یوٹیوب پر\s*(.+?)\s*(?:چلاؤ|چلاؤ|چلا دو)$/,
    /^(?:چلاؤ|چلا دو)\s*(.+?)$/
  ];
  for (const pattern of patterns) {
    const match = original.trim().match(pattern);
    if (match?.[1]?.trim()) return match[1].trim().slice(0, 180);
  }
  return undefined;
}

function requestedApp(normalized: string): string | undefined {
  const patterns: Array<[RegExp, string]> = [
    [/^(?:open|launch|start|run)\s+(?:google\s+)?chrome$/, "chrome"],
    [/^(?:open|launch|start|run)\s+(?:the\s+)?notepad$/, "notepad"],
    [/^(?:open|launch|start|run)\s+(?:the\s+)?(?:calculator|calc)$/, "calculator"],
    [/^(?:open|launch|start|run)\s+(?:the\s+)?(?:file\s+)?explorer$/, "explorer"],
    [/^(?:chrome|google chrome)\s+(?:khol|kholo|open karo)$/, "chrome"],
    [/^(?:notepad)\s+(?:khol|kholo|open karo)$/, "notepad"],
    [/^(?:کروم|گوگل کروم) کھولو$/, "chrome"],
    [/^نوٹ پیڈ کھولو$/, "notepad"],
    [/^(?:calculator|calc)\s+(?:open|kholo|khol)$/, "calculator"]
  ];
  return patterns.find(([pattern]) => pattern.test(normalized))?.[1];
}

async function answerGeneralQuestion(question: string): Promise<string> {
  if (!config.geminiApiKey) {
    return "I can answer general questions once Google Gemini is configured. Create a Gemini API key in Google AI Studio, add GEMINI_API_KEY to your local .env file, restart AURA, and ask again. Supported app and YouTube actions can work without an AI key. Keep the key on your computer—never paste it into GitHub or chat.";
  }
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  try {
    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: question,
      config: {
        temperature: 0.4,
        systemInstruction: "You are AURA, a helpful Windows desktop voice assistant. Answer the user's actual question directly and concisely in the same language they used (English, Urdu, or Roman Urdu). If asked to perform a computer action, do not claim you performed it unless the local app reports success. Never claim to have clicked a YouTube result or started playback if you only opened search results. Do not provide shell commands as if executed. For dangerous or high-impact actions, explain that explicit confirmation is needed."
      }
    });
    const answer = response.text?.trim();
    if (!answer) throw new Error("Gemini returned an empty answer. Please try asking again.");
    return answer.slice(0, 6000);
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    console.error("Gemini request failed:", status || "unknown", error instanceof Error ? error.message.slice(0, 200) : "");
    if (status === 401 || status === 403) {
      throw new Error("Google Gemini rejected the API key or its permissions. Check GEMINI_API_KEY and ensure the key is enabled for the Gemini API.");
    }
    if (status === 429) {
      throw new Error("Gemini rate limit or quota reached. Check Google AI Studio usage and limits.");
    }
    if (error instanceof Error && error.message.includes("Gemini returned an empty answer")) throw error;
    throw new Error("Gemini could not answer right now. Check your internet connection, model access, and Google AI Studio quota.");
  }
}

app.get("/health", (_req, res) => res.json({
  status: "ok",
  service: "AURA Windows Voice Agent",
  mode: config.geminiApiKey ? "Gemini answers + allowlisted actions" : "allowlist actions; Gemini key not configured",
  aiConfigured: Boolean(config.geminiApiKey)
}));
app.get("/api/ai/status", async (_req, res) => {
  if (!config.geminiApiKey) {
    res.json({ configured: false, valid: false, status: "missing", message: "GEMINI_API_KEY is missing from the local .env file." });
    return;
  }
  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    await ai.models.generateContent({
      model: config.geminiModel,
      contents: "Reply with OK.",
      config: { maxOutputTokens: 8, temperature: 0 }
    });
    res.json({ configured: true, valid: true, status: "valid", model: config.geminiModel, message: "Gemini API key authenticated and a small test request succeeded. Quotas and usage limits may still apply." });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 0;
    if (status === 401 || status === 403) {
      res.json({ configured: true, valid: false, status: "invalid", message: "Google Gemini rejected the API key or its permissions. Check the key in Google AI Studio." });
      return;
    }
    if (status === 429) {
      res.json({ configured: true, valid: null, status: "quota", message: "Gemini API key was supplied, but the request hit a quota or rate limit. Check AI Studio usage." });
      return;
    }
    res.status(502).json({ configured: true, valid: null, status: "unverified", message: "Could not verify Gemini right now. Check internet, model availability, and Google AI Studio quota." });
  }
});
app.get("/api/system", (_req, res) => {
  const total = os.totalmem();
  const free = os.freemem();
  res.json({
    platform: os.platform(), hostname: os.hostname(), uptimeSeconds: Math.round(os.uptime()),
    cpuModel: os.cpus()[0]?.model ?? "Unknown", cpuCores: os.cpus().length,
    memoryTotalBytes: total, memoryFreeBytes: free, memoryUsedPercent: Math.round(((total - free) / total) * 100)
  });
});

app.post("/api/command", async (req, res) => {
  const parsed = CommandSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Please send a valid voice command." }); return; }
  const original = parsed.data.text.trim();
  const normalized = original.toLowerCase().replace(/[.!؟?]/g, "").trim();
  try {
    if (/^(?:hi|hello|hey aura|hello aura|سلام|السلام علیکم|assalam o alaikum|salam)$/i.test(normalized)) {
      const message = /[\u0600-\u06FF]/.test(original) || /salam|assalam/i.test(original)
        ? "وعلیکم السلام! میں AURA ہوں۔ آپ کیا کرنا یا پوچھنا چاہتے ہیں؟"
        : "Hello! I'm AURA. What would you like to ask or do?";
      await audit("conversation.greeting", "success", { command: original });
      res.json({ ok: true, message, type: "conversation" });
      return;
    }

    if (/^(?:open|launch|go to|show)\s+(?:youtube|you tube)(?:\s+in\s+(?:chrome|browser))?$/.test(normalized) ||
        /^(?:یوٹیوب کھولو|یوٹیوب چلاؤ|یوٹیوب چلاو)$/.test(normalized)) {
      await openInBrowser("https://www.youtube.com/");
      const message = "YouTube is opening in your default browser. To open it in Chrome, set Chrome as your Windows default browser.";
      await audit("command.executed", "success", { command: original, action: "open_youtube" });
      res.json({ ok: true, message, type: "action" });
      return;
    }

    // Song/music intent is handled before general Q&A so the AI cannot merely describe the action.
    const detectedSong = findSongRequest(original);
    const song = detectedSong && /^(?:enif|enife|enifeslam|atifaslam)$/i.test(detectedSong.replace(/[ ._-]/g, "")) ? "Atif Aslam" : detectedSong;
    if (song && /^(?:play|put on|listen to|start playing|search|find|youtube|gaana|gana|song|music|چلاؤ|چلا دو|یوٹیوب پر)/i.test(original)) {
      const query = /^(?:play|put on|listen to|start playing)/i.test(original) ? song + " song" : song;
      await openInBrowser(youtubeSearchUrl(query));
      const message = 'I opened YouTube search for "' + song + '". Click the correct video to start playback; YouTube does not reliably allow AURA to auto-click a result.';
      await audit("command.executed", "success", { command: original, action: "youtube_search", query: song });
      res.json({ ok: true, message, type: "action" });
      return;
    }

    const appKey = requestedApp(normalized);
    if (appKey) {
      const message = await launch(appKey);
      await audit("command.executed", "success", { command: original, action: appKey });
      res.json({ ok: true, message, type: "action" });
      return;
    }

    if (/^(?:system status|system diagnostics|computer status|how is my computer|کمپیوٹر کی حالت|سسٹم کی حالت|میرے کمپیوٹر کی حالت بتاؤ)$/.test(normalized)) {
      const message = systemStatus();
      await audit("command.executed", "success", { command: original, action: "system_status" });
      res.json({ ok: true, message, type: "answer" });
      return;
    }

    // Unknown requests become conversational questions, not a canned "unsupported command" reply.
    const message = await answerGeneralQuestion(original);
    await audit("conversation.answered", "success", { command: original, provider: config.geminiModel });
    res.json({ ok: true, message, type: "answer" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "AURA could not complete the request.";
    await audit("command.failed", "error", { command: original, error: errorMessage });
    res.status(500).json({ ok: false, message: errorMessage });
  }
});

app.get("/api/audit", async (_req, res) => {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(auditPath, "utf8").catch(() => "");
    const events = raw.split("\n").filter(Boolean).slice(-50).reverse().map((line) => {
      try { return JSON.parse(line) as Record<string, unknown>; } catch { return { event: "invalid_audit_line" }; }
    });
    res.json({ events });
  } catch { res.json({ events: [] }); }
});
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(400).json({ error: message });
});
app.listen(config.port, config.host, () => {
  console.log("AURA Voice Agent listening on http://" + config.host + ":" + config.port);
  console.log(config.geminiApiKey ? "Gemini AI question answering is configured." : "Gemini AI question answering is not configured; add GEMINI_API_KEY to local .env.");
});
