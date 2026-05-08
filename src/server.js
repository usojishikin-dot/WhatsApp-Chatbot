import http from "node:http";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./env.js";
import { openDatabase, dbHealth, addHistory, getLastExchanges, saveLead, getRecentLeads, setHandoff, isInHandoff } from "./db.js";
import { loadBusinessConfig, normalizeWhatsappNumber } from "./config.js";
import { containsAnyKeyword, isHandoffRequest, keywordFallbackReply } from "./fallback.js";
import { generateAiReply, llmConfigured } from "./llm.js";
import { createLogger } from "./logger.js";
import { appendLeadToSheet } from "./sheets.js";

const DEFAULT_PORT = 3000;

loadDotEnv();

export function createApp({ db = openDatabase(), logger = createLogger(), env = process.env } = {}) {
  return async function app(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        const payload = healthPayload(db, env);
        return sendJson(res, payload, payload.ok ? 200 : 503);
      }

      if (req.method === "GET" && url.pathname === "/leads") {
        if (!isAuthorized(req, env)) return sendJson(res, { error: "unauthorized" }, 401);
        return sendJson(res, { leads: getRecentLeads(db, url.searchParams.get("limit")) });
      }

      if (req.method === "POST" && url.pathname === "/webhook") {
        return handleWebhook(req, res, { db, logger, env });
      }

      sendJson(res, { error: "not_found" }, 404);
    } catch (error) {
      logger.error({ type: "request_error", message: error.message, stack: error.stack });
      sendJson(res, { error: "internal_error" }, 500);
    }
  };
}

async function handleWebhook(req, res, { db, logger, env }) {
  const contentType = req.headers["content-type"] || "";
  const payload = await parseBody(req, contentType);
  const from = normalizeWhatsappNumber(payload.From || payload.from || payload.sender || payload.contact?.phone);
  const to = normalizeWhatsappNumber(payload.To || payload.to || payload.recipient || payload.channel?.phone);
  const body = String(payload.Body || payload.body || payload.message || payload.text || "").trim();
  const wantsXml = contentType.includes("application/x-www-form-urlencoded") || Boolean(payload.SmsMessageSid);

  if (!from || !to || !body) {
    logger.error({ type: "bad_webhook_payload", payload: redactPayload(payload) });
    return wantsXml ? sendTwiml(res, "") : sendJson(res, { error: "from_to_body_required" }, 400);
  }

  const config = await loadBusinessConfig(to, env.CONFIG_DIR || "./configs");
  logger.message({ direction: "inbound", from, to, body });

  if (isInHandoff(db, from)) {
    return wantsXml ? sendTwiml(res, "") : sendJson(res, { status: "handoff_active", reply: "" });
  }

  if (isHandoffRequest(body)) {
    setHandoff(db, from, Number(env.HANDOFF_TTL_HOURS || 24));
    const reply = `Please contact us directly on ${config.phone}. A human will assist you.`;
    addHistory(db, from, "user", body);
    addHistory(db, from, "assistant", reply);
    logger.message({ direction: "outbound", from, to, body: reply, mode: "handoff" });
    return wantsXml ? sendTwiml(res, reply) : sendJson(res, { reply, status: "handoff_started" });
  }

  if (containsAnyKeyword(body, config.lead_keywords)) {
    saveLead(db, from, body);
    logger.lead({ from, to, enquiry: body });
    appendLeadToSheet({
      lead: {
        sender: from,
        businessNumber: to,
        businessName: config.business_name,
        enquiry: body
      },
      env,
      logger
    }).catch((error) => {
      logger.error({ type: "sheet_append_failed", message: error.message });
    });
  }

  const history = getLastExchanges(db, from, 3);
  addHistory(db, from, "user", body);

  let reply;
  let mode = "llm";
  try {
    reply = await generateAiReply({ message: body, history, config, timeoutMs: 5000, env });
    if (!reply) throw new Error("LLM returned empty reply");
  } catch (error) {
    mode = "fallback";
    reply = keywordFallbackReply(body, config);
    logger.error({ type: "llm_failed", from, to, message: error.message });
  }

  addHistory(db, from, "assistant", reply);
  logger.message({ direction: "outbound", from, to, body: reply, mode });

  return wantsXml ? sendTwiml(res, reply) : sendJson(res, { reply, mode });
}

function healthPayload(db, env) {
  try {
    return {
      ok: dbHealth(db) && llmConfigured(env),
      db: "ok",
      llm_api_key: llmConfigured(env) ? "configured" : "missing"
    };
  } catch (error) {
    return { ok: false, db: "error", llm_api_key: llmConfigured(env) ? "configured" : "missing", error: error.message };
  }
}

async function parseBody(req, contentType) {
  const raw = await readRequest(req);
  if (!raw) return {};

  if (contentType.includes("application/json")) return JSON.parse(raw);
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

function readRequest(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) {
        reject(new Error("request_body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendTwiml(res, message) {
  const escaped = escapeXml(message);
  res.writeHead(200, { "content-type": "text/xml" });
  res.end(escaped ? `<Response><Message>${escaped}</Message></Response>` : "<Response></Response>");
}

function isAuthorized(req, env) {
  if (!env.ADMIN_API_KEY) return false;
  return req.headers.authorization === `Bearer ${env.ADMIN_API_KEY}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function redactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, /token|key|secret/i.test(key) ? "[redacted]" : value])
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const server = http.createServer(createApp());
  server.listen(port, () => {
    console.log(`WhatsApp bot listening on http://localhost:${port}`);
  });
}
