# WhatsApp Bot Demo Script

Use this when showing the bot to a business owner.

## Before the Demo

1. Make sure your Render service is deployed and running.
2. Make sure your Twilio Sandbox is connected.
3. Make sure the demo phone number has joined the Twilio Sandbox with the current `join ...` code.
4. Open the Google Sheet so the owner can see leads appear.
5. Keep Render logs open only if you need to troubleshoot. Do not show logs unless necessary.

## Short Pitch

Say this:

```text
This is a WhatsApp assistant for your business. It answers common customer questions automatically, captures serious enquiries, saves them into Google Sheets, and alerts the owner on WhatsApp when someone is ready to buy or wants a human.
```

## Demo Flow

### 1. Greeting

Send:

```text
hey
```

Expected bot reply:

```text
Hello, welcome to Tech Bros Agency. How can we help you today?
```

Explain:

```text
The bot can handle normal customer greetings instead of giving a robotic error message.
```

### 2. FAQ Answer

Send:

```text
Do you deliver?
```

Expected bot reply:

```text
Delivery availability depends on your location. Please share your area.
```

Explain:

```text
It answers common business questions immediately, even when the owner is busy.
```

### 3. Lead Capture

Send:

```text
How much is delivery?
```

Expected result:

- The bot replies on WhatsApp.
- A new row appears in Google Sheets.
- The owner receives a WhatsApp alert.

Explain:

```text
This message is treated as a serious enquiry because it contains buying intent. The owner does not need to check a database. The lead appears in Google Sheets automatically, and the owner also gets an alert on WhatsApp.
```

### 4. Human Handoff

Send:

```text
agent
```

Expected bot reply:

```text
Please contact us directly on +2348130254420. A human will assist you.
```

Expected owner alert:

```text
Human requested for Tech Bros Agency
Customer: +234...
Message: agent
```

Explain:

```text
When a customer wants a person, the bot stops trying to answer and alerts the owner.
```

## Closing Pitch

Say this:

```text
The main benefit is that customers get instant answers, and serious enquiries are not lost. You can start with FAQs, lead capture, Google Sheets, and owner alerts. Later, this can be connected to a real WhatsApp Business number when you are ready.
```

## Important Sandbox Note

For demos, say this only if needed:

```text
This demo uses Twilio Sandbox, so test numbers need to join first. For real business use, it would be moved to a proper WhatsApp Business sender so customers can message normally.
```

## Quick Troubleshooting

If the bot does not reply:

1. Check that the phone number joined the Twilio Sandbox.
2. Check that Render is deployed.
3. Check that Twilio webhook points to:

```text
https://your-render-service.onrender.com/webhook
```

If Google Sheets does not update:

1. Send a lead-style message like `How much is delivery?`.
2. Check `GOOGLE_SHEET_WEBHOOK_URL` in Render.
3. Check that the Google Apps Script deployment is current.

If owner alerts do not arrive:

1. Make sure the owner number joined the Twilio Sandbox.
2. Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in Render.
3. Check:

```text
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
OWNER_WHATSAPP_NUMBER=whatsapp:+2348130254420
```
