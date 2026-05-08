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

async function withSheetReceiver(fn) {
  let resolveRequest;
  const received = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const server = http.createServer(async (req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      resolveRequest({ headers: req.headers, body: JSON.parse(body) });
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}/sheet`;
  try {
    await fn(url, received);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function timeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("timed out waiting for sheet webhook")), ms);
  });
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

test("lead capture posts matching enquiries to Google Sheets webhook", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "2348000000000.json"), JSON.stringify(config));

  await withSheetReceiver(async (sheetUrl, received) => {
    const env = {
      CONFIG_DIR: configDir,
      DB_PATH: path.join(root, "bot.sqlite"),
      LOG_DIR: path.join(root, "logs"),
      GOOGLE_SHEET_WEBHOOK_URL: sheetUrl,
      GOOGLE_SHEET_WEBHOOK_SECRET: "sheet-secret"
    };

    await withServer({ ...env, root }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: "whatsapp:+2347000000003",
          to: "whatsapp:+2348000000000",
          body: "How much is delivery?"
        })
      });

      assert.equal(response.status, 200);
      const request = await Promise.race([received, timeout(1000)]);
      assert.equal(request.headers["x-webhook-secret"], "sheet-secret");
      assert.equal(request.body.sender, "+2347000000003");
      assert.equal(request.body.businessNumber, "+2348000000000");
      assert.equal(request.body.businessName, "Ada Foods");
      assert.equal(request.body.enquiry, "How much is delivery?");
      assert.equal(request.body.source, "whatsapp");
      assert.match(request.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    });
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

test("leads endpoint requires admin API key", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "default.json"), JSON.stringify(config));

  await withServer({ root, CONFIG_DIR: configDir, ADMIN_API_KEY: "secret-key" }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/leads`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });
});

test("authorized leads endpoint returns recent leads", async () => {
  const { root, configDir, config } = tempEnv();
  writeFileSync(path.join(configDir, "default.json"), JSON.stringify(config));

  await withServer({ root, CONFIG_DIR: configDir, ADMIN_API_KEY: "secret-key" }, async (baseUrl) => {
    await fetch(`${baseUrl}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "whatsapp:+2347000000000",
        to: "whatsapp:+2348000000000",
        body: "How much is delivery?"
      })
    });

    const response = await fetch(`${baseUrl}/leads`, {
      headers: { authorization: "Bearer secret-key" }
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.leads.length, 1);
    assert.equal(data.leads[0].enquiry, "How much is delivery?");
  });
});
