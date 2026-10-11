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
  const normalized = parsed.data.text.toLowerCase().replace(/[.!؟?]/g, "").trim();
  try {
    let message: string;
    if (/^(system status|system diagnostics|کمپیوٹر کی حالت|سسٹم کی حالت|میرے کمپیوٹر کی حالت بتاؤ)$/.test(normalized)) {
      const memoryUsed = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
      message = `System is running. ${os.cpus().length} CPU cores detected. Memory usage is about ${memoryUsed}%.`;
    } else {
      const launchMatch = normalized.match(/^(open|launch|کھولو|چلاؤ)\s+(chrome|google chrome|notepad|calculator|calc|explorer|file explorer)$/);
      const appName = launchMatch?.[2]?.replace("google chrome", "chrome").replace("file explorer", "explorer").replace("calc", "calculator");
      if (!appName || !apps[appName]) {
        await audit("command.rejected", "denied", { command: parsed.data.text });
        res.json({ ok: false, requiresApproval: false, message: "I can open Chrome, Notepad, Calculator, or File Explorer, and report basic system status. That command is not supported yet." });
        return;
      }
      message = await launch(appName);
    }
    await audit("command.executed", "success", { command: parsed.data.text, action: message });
    res.json({ ok: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed.";
    await audit("command.failed", "error", { command: parsed.data.text, error: message });
    res.status(500).json({ ok: false, message });
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
  console.log(`AURA Voice Agent listening on http://${config.host}:${config.port}`);
});
