const DEFAULT_TIMEOUT_MS = 3000;

export async function appendLeadToSheet({
  lead,
  env = process.env,
  logger,
  fetchImpl = globalThis.fetch,
  now = () => new Date()
} = {}) {
  const webhookUrl = env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) return { skipped: true, reason: "missing_webhook_url" };
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");

  const controller = new AbortController();
  const timeoutMs = Number(env.GOOGLE_SHEET_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    timestamp: lead.timestamp || now().toISOString(),
    sender: lead.sender,
    businessNumber: lead.businessNumber,
    businessName: lead.businessName,
    enquiry: lead.enquiry,
    source: "whatsapp"
  };

  const headers = { "content-type": "application/json" };
  if (env.GOOGLE_SHEET_WEBHOOK_SECRET) {
    headers["x-webhook-secret"] = env.GOOGLE_SHEET_WEBHOOK_SECRET;
  }

  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Sheet webhook failed: ${response.status}`);
    logger?.lead?.({ type: "sheet_append", sender: lead.sender, sheet: "appended" });
    return { skipped: false, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}
