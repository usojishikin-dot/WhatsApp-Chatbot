const DEFAULT_TIMEOUT_MS = 3000;

export async function notifyOwnerOnWhatsapp({
  event,
  env = process.env,
  logger,
  fetchImpl = globalThis.fetch
} = {}) {
  const missing = requiredTwilioConfig(env);
  if (missing.length > 0) return { skipped: true, reason: "missing_config", missing };
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");

  const controller = new AbortController();
  const timeoutMs = Number(env.OWNER_NOTIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const apiBaseUrl = env.TWILIO_API_BASE_URL || "https://api.twilio.com";
  const url = `${apiBaseUrl}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

  const form = new URLSearchParams({
    From: whatsappAddress(env.TWILIO_WHATSAPP_FROM),
    To: whatsappAddress(env.OWNER_WHATSAPP_NUMBER),
    Body: ownerNotificationText(event)
  });

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Twilio notification failed: ${response.status}`);
    logger?.message?.({
      direction: "outbound",
      to: env.OWNER_WHATSAPP_NUMBER,
      body: form.get("Body"),
      mode: "owner_notification"
    });
    return { skipped: false, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function requiredTwilioConfig(env) {
  return ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "OWNER_WHATSAPP_NUMBER"].filter(
    (key) => !env[key]
  );
}

function whatsappAddress(number) {
  const value = String(number || "").trim();
  if (value.toLowerCase().startsWith("whatsapp:")) return value;
  return `whatsapp:${value}`;
}

function ownerNotificationText(event = {}) {
  const label = event.type === "handoff" ? "Human requested" : "New lead";
  return [
    `${label} for ${event.businessName}`,
    `Customer: ${event.sender}`,
    `Message: ${event.message}`
  ].join("\n");
}
