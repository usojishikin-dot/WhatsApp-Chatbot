# WhatsApp FAQ + Lead Bot

AI-assisted WhatsApp bot for SMEs. It answers FAQs, stores short conversation memory, captures sales leads, and hands users off to a human when requested.

## Requirements

- Node.js 24+
- A WhatsApp webhook provider such as Twilio or Respond.io
- One free-tier LLM key from OpenRouter, Groq, or Gemini

No npm dependencies are required. SQLite uses Node's built-in `node:sqlite`.

## Setup

1. Copy `.env.example` to `.env` on your host or set equivalent environment variables in Render/Railway.
2. Add one config file per client in `configs/`.
3. Start the service:

```bash
npm start
```

The default local URL is `http://localhost:3000`.

## Environment

```bash
PORT=3000
DB_PATH=./data/bot.sqlite
CONFIG_DIR=./configs
LOG_DIR=./logs
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
ADMIN_API_KEY=change-this-secret
GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/your-apps-script-id/exec
GOOGLE_SHEET_WEBHOOK_SECRET=optional-shared-secret
GOOGLE_SHEET_TIMEOUT_MS=3000
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
OWNER_WHATSAPP_NUMBER=whatsapp:+2348012345678
OWNER_NOTIFY_TIMEOUT_MS=3000
```

Supported `LLM_PROVIDER` values are `openrouter`, `groq`, and `gemini`. If the LLM fails or takes more than 5 seconds, the bot automatically falls back to FAQ keyword matching.

## Client Configs

Config files are keyed by the receiving WhatsApp number. For `whatsapp:+2348012345678`, create:

```text
configs/2348012345678.json
```

Example:

```json
{
  "business_name": "Ada Foods",
  "hours": "Mon-Sat, 9am-6pm",
  "address": "Ikeja, Lagos",
  "phone": "+2348012345678",
  "faq": {
    "hours": "We open Mon-Sat, 9am-6pm.",
    "delivery": "We deliver within Lagos."
  },
  "lead_keywords": ["price", "contact me", "delivery", "order", "how much"]
}
```

If no matching number config exists, `configs/default.json` is used.

## Webhooks

Use `POST /webhook`.

Twilio form payload:

```text
From=whatsapp:+2347000000000
To=whatsapp:+2348012345678
Body=How much is delivery?
```

JSON payload:

```json
{
  "from": "whatsapp:+2347000000000",
  "to": "whatsapp:+2348012345678",
  "body": "How much is delivery?"
}
```

The bot ignores media fields and only reads sender, recipient, and text body.

## Health

`GET /health` returns 200 only when SQLite is reachable and an LLM API key is configured. Without an LLM key, it returns 503 so deployment checks catch incomplete setup.

## Leads

Lead keywords are configured per client. Matching messages are stored in SQLite:

```sql
SELECT * FROM leads ORDER BY id DESC;
```

Recent leads can also be viewed through the protected admin endpoint:

```bash
curl -H "Authorization: Bearer your-admin-key" https://your-service.onrender.com/leads
```

## Google Sheets Lead Capture

Set `GOOGLE_SHEET_WEBHOOK_URL` to a Google Apps Script web app URL. Every message matching a client's `lead_keywords` is still saved in SQLite and is also posted to the sheet webhook in the background.

The webhook receives:

```json
{
  "timestamp": "2026-05-02T12:00:00.000Z",
  "sender": "+2347000000000",
  "businessNumber": "+2348012345678",
  "businessName": "Ada Foods",
  "enquiry": "How much is delivery?",
  "source": "whatsapp"
}
```

Optional: set `GOOGLE_SHEET_WEBHOOK_SECRET` when using an automation platform or webhook tool that can read the `x-webhook-secret` request header. For Google Apps Script, use a query-string secret as shown below because Apps Script does not reliably expose custom request headers in all deployments.

Minimal Apps Script example:

```js
const SHEET_NAME = "Leads";
const WEBHOOK_SECRET = ""; // Optional: match GOOGLE_SHEET_WEBHOOK_SECRET.

function doPost(e) {
  if (WEBHOOK_SECRET && e.parameter.secret !== WEBHOOK_SECRET) {
    return ContentService.createTextOutput("unauthorized").setMimeType(ContentService.MimeType.TEXT);
  }

  const data = JSON.parse(e.postData.contents);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Sender", "Business Number", "Business Name", "Enquiry", "Source"]);
  }
  sheet.appendRow([
    data.timestamp,
    data.sender,
    data.businessNumber,
    data.businessName,
    data.enquiry,
    data.source
  ]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

For the Apps Script example above, add the secret as a query string in `GOOGLE_SHEET_WEBHOOK_URL`:

```bash
GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/your-apps-script-id/exec?secret=your-secret
```

## Human Handoff

When a user types `human` or `agent`, the bot replies with the configured owner phone number and suppresses automated replies for that sender for `HANDOFF_TTL_HOURS` hours.

## Owner WhatsApp Notifications

Set the Twilio variables below to alert the business owner on WhatsApp when a lead is captured or a user asks for `human` / `agent`.

```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
OWNER_WHATSAPP_NUMBER=whatsapp:+2348012345678
OWNER_NOTIFY_TIMEOUT_MS=3000
```

For Twilio Sandbox, `TWILIO_WHATSAPP_FROM` is usually:

```text
whatsapp:+14155238886
```

The owner number in `OWNER_WHATSAPP_NUMBER` must first join the same Twilio Sandbox by sending the current `join ...` code to the Sandbox WhatsApp number. Sandbox membership expires after 72 hours.

## Tests

```bash
npm test
```

## Marketing Video

This repo includes a Remotion vertical short for advertising the bot.

```bash
npm install
npm run video:studio
npm run video:render
```

The render script outputs `out/whatsapp-bot-short.mp4`. The composition ID is `WhatsappBotShort`.
