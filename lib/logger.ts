import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");

type Level = "info" | "warn" | "error";

function serialize(data: unknown): unknown {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack };
  }
  return data;
}

/**
 * Appends a detailed, human-readable multi-line entry to
 * logs/app-YYYY-MM-DD.log for later analysis: a header line with timestamp +
 * level + event, followed by a pretty-printed JSON detail block.
 * Never throws — logging must not break the request it is observing.
 */
export async function logEvent(level: Level, event: string, data?: unknown): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const now = new Date();
    const header = `=== ${now.toISOString()} [${level.toUpperCase()}] ${event} ===`;
    const detail = serialize(data ?? {});
    const body = JSON.stringify(detail, null, 2);
    const file = path.join(LOG_DIR, `app-${now.toISOString().slice(0, 10)}.log`);
    await appendFile(file, `${header}\n${body}\n\n`, "utf8");
  } catch {
    // Swallow — logging failures must never surface to the caller.
  }
}
