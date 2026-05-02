import { existsSync, readFileSync } from "node:fs";

export function loadDotEnv(file = ".env") {
  if (!existsSync(file)) return;

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    if (equalsAt === -1) continue;

    const key = trimmed.slice(0, equalsAt).trim();
    const value = stripQuotes(trimmed.slice(equalsAt + 1).trim());
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
