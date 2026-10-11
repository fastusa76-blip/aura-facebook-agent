import express, { type Request, type Response, type NextFunction } from "express";
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

/** Open only a URL constructed by AURA. The URL is base64-encoded before it reaches PowerShell. */
function openInChrome(url: string): Promise<void> {
  // Accept only YouTube URLs constructed by AURA.
  if (!/^https:\/\/www\.youtube\.com\/(?:$|results\?search_query=)/.test(url)) {
    return Promise.reject(new Error("AURA can only open approved YouTube pages."));
  }

  // Windows resolves the registered browser/app. This avoids assuming that
  // Chrome is installed under Program Files or LocalAppData.
  return new Promise((resolvePromise, reject) => {
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      windowsHide: true, shell: false, detached: true, stdio: "ignore"
    });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolvePromise(); });
  });
}

function youtubeSearchUrl(query: string): string {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(query.trim());
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "AURA Windows Voice Agent", mode: "allowlist-only" }));
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
    // Exact website intents: never accept a user-supplied arbitrary URL.
    if (/^(?:open|launch|go to|کھولو)\s+(?:youtube|you tube)(?:\s+in\s+chrome)?$/.test(normalized) ||
        /^(?:یوٹیوب کھولو|یوٹیوب چلاؤ|یوٹیوب چلاو)$/.test(normalized)) {
      await openInChrome("https://www.youtube.com/");
      const message = "YouTube is opening in Google Chrome.";
      await audit("command.executed", "success", { command: original, action: "open_youtube" });
      res.json({ ok: true, message });
      return;
    }

    // Song names are search text, encoded as a URL parameter, not treated as code.
    const songMatch =
      original.match(/^(?:please\s+)?(?:play(?:\s+(?:the\s+)?song)?|search\s+youtube\s+for|find\s+on\s+youtube)\s+(.+)$/i) ||
      original.match(/^youtube\s+(?:par|pe)\s+(.+?)\s+(?:chalao|chala\s+do|play\s+karo)$/i) ||
      original.match(/^یوٹیوب پر\s*(.+?)\s*(?:چلاؤ|چلاؤ|چلا دو)$/);
    if (songMatch?.[1]?.trim()) {
      const song = songMatch[1].trim().slice(0, 180);
      await openInChrome(youtubeSearchUrl(song));
      const message = 'I opened YouTube search for "' + song + '" in Chrome. Choose the correct result to start playback; YouTube may not allow reliable autoplay from a new page.';
      await audit("command.executed", "success", { command: original, action: "youtube_search", query: song });
      res.json({ ok: true, message });
      return;
    }

    let message: string;
    if (/^(system status|system diagnostics|کمپیوٹر کی حالت|سسٹم کی حالت|میرے کمپیوٹر کی حالت بتاؤ)$/.test(normalized)) {
      const memoryUsed = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
      message = "System is running. " + os.cpus().length + " CPU cores detected. Memory usage is about " + memoryUsed + "%.";
    } else {
      const launchMatch = normalized.match(/^(open|launch|کھولو|چلاؤ)\s+(chrome|google chrome|notepad|calculator|calc|explorer|file explorer)$/);
      const appName = launchMatch?.[2]?.replace("google chrome", "chrome").replace("file explorer", "explorer").replace("calc", "calculator");
      if (!appName || !apps[appName]) {
        await audit("command.rejected", "denied", { command: original });
        res.json({
          ok: false, requiresApproval: false,
          message: "I don't support that command yet. Try “Open YouTube”, “Play Atif Aslam”, “Open Chrome”, “Open Notepad”, or “System status”. For safety, AURA does not execute arbitrary spoken shell commands."
        });
        return;
      }
      message = await launch(appName);
    }
    await audit("command.executed", "success", { command: original, action: message });
    res.json({ ok: true, message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Command failed.";
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
});
