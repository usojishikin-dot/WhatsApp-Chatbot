import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadDotEnv } from "../src/env.js";

test("loads simple .env values without overriding existing env", () => {
  const root = mkdtempSync(path.join(tmpdir(), "wa-env-"));
  const envFile = path.join(root, ".env");
  writeFileSync(envFile, "PORT=4567\nOPENROUTER_API_KEY='abc123'\n");

  delete process.env.PORT;
  process.env.OPENROUTER_API_KEY = "already-set";
  loadDotEnv(envFile);

  assert.equal(process.env.PORT, "4567");
  assert.equal(process.env.OPENROUTER_API_KEY, "already-set");

  delete process.env.PORT;
  delete process.env.OPENROUTER_API_KEY;
});
