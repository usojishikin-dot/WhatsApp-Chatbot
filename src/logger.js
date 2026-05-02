import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";

const MAX_LOG_BYTES = 1024 * 1024;
const KEEP_FILES = 5;

export function createLogger(logDir = process.env.LOG_DIR || "./logs") {
  mkdirSync(logDir, { recursive: true });

  function write(stream, event) {
    const file = path.join(logDir, `${stream}.jsonl`);
    rotateIfNeeded(file);
    appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
  }

  return {
    message: (event) => write("messages", event),
    error: (event) => write("errors", event),
    lead: (event) => write("leads", event)
  };
}

function rotateIfNeeded(file) {
  if (!existsSync(file) || statSync(file).size < MAX_LOG_BYTES) return;

  for (let i = KEEP_FILES - 1; i >= 1; i -= 1) {
    const from = `${file}.${i}`;
    const to = `${file}.${i + 1}`;
    if (existsSync(from)) renameSync(from, to);
  }
  renameSync(file, `${file}.1`);
}
