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

To append leads elsewhere, set `GOOGLE_SHEET_WEBHOOK_URL` to a Google Apps Script or automation webhook that accepts:

```json
{
  "sender": "+2347000000000",
  "enquiry": "How much is delivery?",
  "timestamp": "2026-05-02T..."
}
```

## Human Handoff

When a user types `human` or `agent`, the bot replies with the configured owner phone number and suppresses automated replies for that sender for `HANDOFF_TTL_HOURS` hours.

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
