import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/server.js";
import { openDatabase } from "../src/db.js";
import { createLogger } from "../src/logger.js";

function tempEnv() {
  const root = mkdtempSync(path.join(tmpdir(), "wa-bot-"));
  const configDir = path.join(root, "configs");
  mkdirSync(configDir);
  const config = {
    business_name: "Ada Foods",
    hours: "Mon-Sat, 9am-6pm",
    address: "Ikeja, Lagos",
    phone: "+2348012345678",
    faq: {
      hours: "We open Mon-Sat, 9am-6pm.",
      delivery: "We deliver within Lagos."
    },
    lead_keywords: ["price", "delivery", "order", "how much"]
  };
  return { root, configDir, config };
}

async function withServer(env, fn) {
  const db = openDatabase(path.join(env.root, "bot.sqlite"));
  const logger = createLogger(path.join(env.root, "logs"));
  const server = http.createServer(createApp({ db, logger, env }));
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`, db, env.root);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("JSON webhook falls back, stores history, and captures lead", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "2348000000000.json"), JSON.stringify(config));

  const env = {
    CONFIG_DIR: configDir,
    DB_PATH: path.join(root, "bot.sqlite"),
    LOG_DIR: path.join(root, "logs")
  };

  await withServer({ ...env, root }, async (baseUrl, db) => {
    const response = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "whatsapp:+2347000000000",
        to: "whatsapp:+2348000000000",
        body: "Do you do delivery?"
      })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.reply, "We deliver within Lagos.");
    assert.equal(data.mode, "fallback");

    const lead = db.prepare("SELECT sender, enquiry FROM leads").get();
    assert.equal(lead.sender, "+2347000000000");
    assert.equal(lead.enquiry, "Do you do delivery?");

    const history = db.prepare("SELECT role, message FROM history ORDER BY id").all();
    assert.deepEqual(history.map((row) => row.role), ["user", "assistant"]);
  });
});

test("fallback matches delivery FAQ for deliver wording", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "2348000000000.json"), JSON.stringify(config));

  const env = {
    CONFIG_DIR: configDir,
    DB_PATH: path.join(root, "bot.sqlite"),
    LOG_DIR: path.join(root, "logs")
  };

  await withServer({ ...env, root }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "whatsapp:+2347000000001",
        to: "whatsapp:+2348000000000",
        body: "Do you deliver?"
      })
    });

    const data = await response.json();
    assert.equal(data.reply, "We deliver within Lagos.");
  });
});

test("fallback handles greetings as small conversation", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "2348000000000.json"), JSON.stringify(config));

  const env = {
    CONFIG_DIR: configDir,
    DB_PATH: path.join(root, "bot.sqlite"),
    LOG_DIR: path.join(root, "logs")
  };

  await withServer({ ...env, root }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "whatsapp:+2347000000002",
        to: "whatsapp:+2348000000000",
        body: "hey"
      })
    });

    const data = await response.json();
    assert.equal(data.reply, "Hello, welcome to Ada Foods. How can we help you today?");
  });
});


test("Twilio handoff starts a session and later returns empty TwiML", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "2348000000000.json"), JSON.stringify(config));

  const env = {
    CONFIG_DIR: configDir,
    DB_PATH: path.join(root, "bot.sqlite"),
    LOG_DIR: path.join(root, "logs"),
    HANDOFF_TTL_HOURS: "24"
  };

  await withServer({ ...env, root }, async (baseUrl) => {
    const form = new URLSearchParams({
      From: "whatsapp:+2347000000000",
      To: "whatsapp:+2348000000000",
      Body: "agent"
    });
    const first = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form
    });
    assert.equal(await first.text(), "<Response><Message>Please contact us directly on +2348012345678. A human will assist you.</Message></Response>");

    const second = await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        From: "whatsapp:+2347000000000",
        To: "whatsapp:+2348000000000",
        Body: "hello"
      })
    });
    assert.equal(await second.text(), "<Response></Response>");
  });
});

test("health reports missing LLM key as unavailable", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "default.json"), JSON.stringify(config));

  await withServer({ root, CONFIG_DIR: configDir }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.db, "ok");
    assert.equal(data.llm_api_key, "missing");
  });
});
