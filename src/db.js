import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(dbPath = process.env.DB_PATH || "./data/bot.sqlite") {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_history_sender_id ON history(sender, id);

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      enquiry TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_leads_sender_id ON leads(sender, id);

    CREATE TABLE IF NOT EXISTS handoffs (
      sender TEXT PRIMARY KEY,
      until TEXT NOT NULL
    );
  `);
  return db;
}

export function dbHealth(db) {
  db.prepare("SELECT 1").get();
  return true;
}

export function addHistory(db, sender, role, message) {
  db.prepare("INSERT INTO history (sender, role, message) VALUES (?, ?, ?)").run(sender, role, message);
}

export function getLastExchanges(db, sender, exchangeCount = 3) {
  const limit = exchangeCount * 2;
  const rows = db.prepare(`
    SELECT role, message
    FROM history
    WHERE sender = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(sender, limit);
  return rows.reverse();
}

export function saveLead(db, sender, enquiry) {
  db.prepare("INSERT INTO leads (sender, enquiry) VALUES (?, ?)").run(sender, enquiry);
}

export function getRecentLeads(db, limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  return db.prepare(`
    SELECT id, sender, enquiry, timestamp
    FROM leads
    ORDER BY id DESC
    LIMIT ?
  `).all(safeLimit);
}

export function setHandoff(db, sender, ttlHours = Number(process.env.HANDOFF_TTL_HOURS || 24)) {
  const until = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO handoffs (sender, until)
    VALUES (?, ?)
    ON CONFLICT(sender) DO UPDATE SET until = excluded.until
  `).run(sender, until);
  return until;
}

export function isInHandoff(db, sender) {
  const row = db.prepare("SELECT until FROM handoffs WHERE sender = ?").get(sender);
  if (!row) return false;
  if (new Date(row.until).getTime() > Date.now()) return true;
  db.prepare("DELETE FROM handoffs WHERE sender = ?").run(sender);
  return false;
}
