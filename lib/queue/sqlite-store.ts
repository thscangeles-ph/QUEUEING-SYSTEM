import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { visitStatus } from "./format";
import { arrivalLabel } from "./reducer";
import type { Backend, HistoryQuery, HistoryResult, HistoryRow, Media, Stored } from "./server-store";
import type { QueueState, Visit } from "./types";

// The clinic server's database: one SQLite file (queue.db, beside the old queue.json) with Node.js's built-in SQLite,
// so nothing has to be installed. It keeps today's queue (with the settings), every visit of every day (visits, which
// is kept after the queue starts fresh at midnight), the TV pictures, and the Telegram links and messages.
// The first time, it imports the queue.json, media and telegram files of the file store (they are left as they were),
// and every day it saves a copy in the backups folder (the last 30 days).

const KEEP_BACKUPS = 30;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS queue_state (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, day TEXT, state TEXT NOT NULL, saved_at INTEGER);
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL, id TEXT NOT NULL, seq INTEGER, number TEXT, kind TEXT, name TEXT, mobile TEXT, birth_date TEXT, age INTEGER,
  physician TEXT, hmo TEXT, loa TEXT, appointment TEXT, services TEXT, status TEXT, created_at INTEGER, registered_at INTEGER,
  finished_at INTEGER, data TEXT, updated_at INTEGER, PRIMARY KEY (day, id));
CREATE INDEX IF NOT EXISTS visits_by_name ON visits (name);
CREATE INDEX IF NOT EXISTS visits_by_mobile ON visits (mobile);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS data (name TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

/** A visit's row in the history table: the main details as columns, and the whole visit as JSON. */
function visitRow(day: string, visit: Visit, now: number) {
  const status = visit.clearedAt ? "cleared" : visitStatus(visit);
  const finished = status === "completed" ? Math.max(0, ...visit.steps.map((step) => step.doneAt ?? 0)) || null : null;
  return [day, visit.id, visit.seq, arrivalLabel(visit), visit.kind, visit.name, visit.mobile, visit.birthDate ?? null, visit.age ?? null, visit.requestingPhysician ?? null, visit.hmo ?? null, visit.loa ?? null, visit.appointment ?? null, visit.steps.map((step) => step.station).join(" > "), status, visit.createdAt, visit.registeredAt ?? null, finished, JSON.stringify(visit), now] as const;
}

/** The SQLite store, or null when this Node.js has no built-in SQLite (older than 22.13): then the file store is used. */
export function sqliteBackend(dbFile: string, legacyQueueFile: string): Backend | null {
  // Node.js says "SQLite is an experimental feature" when it loads; that is not a problem, so the server window does not show it.
  const emitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => (String(warning).includes("SQLite") ? undefined : (emitWarning as (...args: unknown[]) => void).call(process, warning, ...rest))) as typeof process.emitWarning;
  let sqlite: typeof import("node:sqlite") | undefined;
  try {
    sqlite = process.getBuiltinModule?.("node:sqlite") as typeof import("node:sqlite") | undefined;
  } finally {
    process.emitWarning = emitWarning;
  }
  if (!sqlite?.DatabaseSync) return null;
  mkdirSync(path.dirname(dbFile), { recursive: true });
  const db: DatabaseSync = new sqlite.DatabaseSync(dbFile);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
  db.exec(SCHEMA);

  const meta = (key: string) => (db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
  const setMeta = (key: string, value: string) => db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  const upsertVisit = db.prepare(`INSERT INTO visits (day, id, seq, number, kind, name, mobile, birth_date, age, physician, hmo, loa, appointment, services, status, created_at, registered_at, finished_at, data, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, id) DO UPDATE SET seq = excluded.seq, number = excluded.number, kind = excluded.kind, name = excluded.name, mobile = excluded.mobile,
      birth_date = excluded.birth_date, age = excluded.age, physician = excluded.physician, hmo = excluded.hmo, loa = excluded.loa, appointment = excluded.appointment,
      services = excluded.services, status = excluded.status, created_at = excluded.created_at, registered_at = excluded.registered_at,
      finished_at = excluded.finished_at, data = excluded.data, updated_at = excluded.updated_at`);

  /** Keeps the day's visits in the history; one no longer in the queue (removed, or the day was cleared) stays, marked removed. */
  const saveHistory = (state: QueueState, now: number) => {
    for (const visit of state.visits) upsertVisit.run(...visitRow(state.day, visit, now));
    const kept = new Set(state.visits.map((visit) => visit.id));
    const rows = db.prepare("SELECT id FROM visits WHERE day = ? AND status != 'removed'").all(state.day) as { id: string }[];
    const mark = db.prepare("UPDATE visits SET status = 'removed', updated_at = ? WHERE day = ? AND id = ?");
    for (const row of rows) if (!kept.has(row.id)) mark.run(now, state.day, row.id);
  };

  const transaction = <T>(work: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  // The first time: bring in the file store's data (queue.json, media folder, telegram files). They are not deleted.
  if (!meta("imported_at")) {
    transaction(() => {
      const dir = path.dirname(legacyQueueFile);
      const stored = readJson<Stored>(legacyQueueFile);
      if (stored?.state && !db.prepare("SELECT 1 FROM queue_state WHERE id = 1").get()) {
        db.prepare("INSERT INTO queue_state (id, version, day, state, saved_at) VALUES (1, ?, ?, ?, ?)").run(stored.version ?? 0, stored.state.day, JSON.stringify(stored.state), Date.now());
        saveHistory(stored.state, Date.now());
      }
      const mediaDir = path.join(dir, "media");
      if (existsSync(mediaDir)) {
        for (const file of readdirSync(mediaDir).filter((name) => name.endsWith(".json"))) {
          const media = readJson<Media>(path.join(mediaDir, file));
          if (media?.type && media.data) db.prepare("INSERT OR IGNORE INTO media (id, type, data) VALUES (?, ?, ?)").run(file.slice(0, -5), media.type, media.data);
        }
      }
      for (const name of ["telegram-contacts", "telegram-messages"]) {
        const value = readJson<unknown>(path.join(dir, `${name}.json`));
        if (value !== null) db.prepare("INSERT OR IGNORE INTO data (name, value, updated_at) VALUES (?, ?, ?)").run(name, JSON.stringify(value), Date.now());
      }
      setMeta("imported_at", String(Date.now()));
      setMeta("schema", "1");
    });
  }

  /** Once a day, a copy of the whole database in the backups folder; only the last 30 are kept. */
  const backup = (day: string) => {
    if (meta("last_backup") === day) return;
    const folder = path.join(path.dirname(dbFile), "backups");
    mkdirSync(folder, { recursive: true });
    const target = path.join(folder, `queue-${day}.db`);
    if (!existsSync(target)) db.prepare("VACUUM INTO ?").run(target);
    setMeta("last_backup", day);
    const copies = readdirSync(folder).filter((name) => /^queue-\d{4}-\d{2}-\d{2}\.db$/.test(name)).sort();
    for (const old of copies.slice(0, Math.max(0, copies.length - KEEP_BACKUPS))) unlinkSync(path.join(folder, old));
  };

  return {
    name: "sqlite",
    async load() {
      const row = db.prepare("SELECT version, state FROM queue_state WHERE id = 1").get() as { version: number; state: string } | undefined;
      return row ? { state: JSON.parse(row.state) as QueueState, version: row.version } : { state: null, version: 0 };
    },
    async save(state, expectedVersion) {
      const now = Date.now();
      // Compare-and-set, as with the other stores: two computers saving at the same moment never overwrite each other.
      const saved = transaction(() => {
        const row = db.prepare("SELECT version FROM queue_state WHERE id = 1").get() as { version: number } | undefined;
        if ((row?.version ?? 0) !== expectedVersion) return false;
        db.prepare("INSERT INTO queue_state (id, version, day, state, saved_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET version = excluded.version, day = excluded.day, state = excluded.state, saved_at = excluded.saved_at")
          .run(expectedVersion + 1, state.day, JSON.stringify(state), now);
        saveHistory(state, now);
        return true;
      });
      if (saved) {
        try {
          backup(state.day);
        } catch (error) {
          console.error("THSC Queue Board: the daily database backup could not be saved:", (error as Error).message);
        }
      }
      return saved;
    },
    async saveMedia(id, media) {
      db.prepare("INSERT INTO media (id, type, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, data = excluded.data").run(id, media.type, media.data);
    },
    async loadMedia(id) {
      return (db.prepare("SELECT type, data FROM media WHERE id = ?").get(id) as Media | undefined) ?? null;
    },
    async deleteMedia(id) {
      db.prepare("DELETE FROM media WHERE id = ?").run(id);
    },
    async loadData<T>(name: string) {
      const row = db.prepare("SELECT value FROM data WHERE name = ?").get(name) as { value: string } | undefined;
      return row ? (JSON.parse(row.value) as T) : null;
    },
    async saveData(name, value) {
      db.prepare("INSERT INTO data (name, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(name, JSON.stringify(value), Date.now());
    },
    async history(query: HistoryQuery): Promise<HistoryResult> {
      const where = ["day BETWEEN ? AND ?"];
      const params: (string | number)[] = [query.from, query.to];
      const text = String(query.q ?? "").trim();
      if (text) {
        // A name, queue number, physician or HMO; a cellphone matches with or without spaces and dashes.
        const digits = text.replace(/\D/g, "");
        where.push("(name LIKE ? OR number LIKE ? OR physician LIKE ? OR hmo LIKE ?" + (digits.length >= 3 ? " OR REPLACE(REPLACE(REPLACE(mobile, ' ', ''), '-', ''), '+63', '0') LIKE ?" : "") + ")");
        params.push(`%${text}%`, `%${text}%`, `%${text}%`, `%${text}%`, ...(digits.length >= 3 ? [`%${digits.replace(/^63/, "0")}%`] : []));
      }
      if (query.kinds?.length) {
        where.push(`kind IN (${query.kinds.map(() => "?").join(", ")})`);
        params.push(...query.kinds);
      }
      const closed = "('cancelled', 'removed', 'cleared')";
      if (query.status === "completed") where.push("status = 'completed'");
      else if (query.status === "cancelled") where.push(`status IN ${closed}`);
      else if (query.status === "open") where.push(`status != 'completed' AND status NOT IN ${closed}`);
      const filter = where.join(" AND ");
      const totals = db.prepare(`SELECT count(*) AS visits, sum(status = 'completed') AS completed, sum(status IN ${closed}) AS cancelled, count(DISTINCT day) AS days FROM visits WHERE ${filter}`).get(...params) as Record<string, number | null>;
      const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 5000);
      const rows = db.prepare(`SELECT day, id, number, kind, name, mobile, birth_date AS birthDate, age, physician, hmo, loa, appointment, services, status,
        created_at AS createdAt, registered_at AS registeredAt, finished_at AS finishedAt FROM visits WHERE ${filter} ORDER BY day DESC, created_at ASC LIMIT ?`).all(...params, limit) as HistoryRow[];
      const visits = Number(totals.visits ?? 0), completed = Number(totals.completed ?? 0), cancelled = Number(totals.cancelled ?? 0);
      return { rows, summary: { visits, completed, cancelled, open: visits - completed - cancelled, days: Number(totals.days ?? 0) } };
    },
    async historyVisit(day: string, id: string) {
      const row = db.prepare("SELECT data FROM visits WHERE day = ? AND id = ?").get(day, id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
  };
}
