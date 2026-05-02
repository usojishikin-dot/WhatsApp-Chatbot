import { readFile } from "node:fs/promises";
import path from "node:path";

export function normalizeWhatsappNumber(value = "") {
  const stripped = String(value).replace(/^whatsapp:/i, "").trim();
  const digits = stripped.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  return digits ? `+${digits}` : "";
}

export function configFileNameForNumber(number) {
  const normalized = normalizeWhatsappNumber(number);
  return normalized.replace(/[^\d]/g, "");
}

export async function loadBusinessConfig(to, configDir = process.env.CONFIG_DIR || "./configs") {
  const fileStem = configFileNameForNumber(to);
  const candidates = [
    fileStem ? path.join(configDir, `${fileStem}.json`) : null,
    path.join(configDir, "default.json")
  ].filter(Boolean);

  let lastError;
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      validateBusinessConfig(parsed, file);
      return { ...parsed, _configFile: file };
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT") throw error;
    }
  }

  throw lastError || new Error("No business config found");
}

export function validateBusinessConfig(config, file = "config") {
  const requiredStrings = ["business_name", "hours", "address", "phone"];
  for (const key of requiredStrings) {
    if (!config[key] || typeof config[key] !== "string") {
      throw new Error(`${file}: "${key}" must be a non-empty string`);
    }
  }

  if (!config.faq || typeof config.faq !== "object" || Array.isArray(config.faq)) {
    throw new Error(`${file}: "faq" must be an object`);
  }

  if (!Array.isArray(config.lead_keywords)) {
    throw new Error(`${file}: "lead_keywords" must be an array`);
  }
}
