import type { DatabaseSync } from "node:sqlite";

// Bootstrap is idempotent so databases created before migrations retain their rows.
const BOOTSTRAP = `
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    hostname TEXT,
    manufacturer TEXT,
    device_type TEXT,
    operating_system TEXT,
    status TEXT NOT NULL,
    trust_status TEXT NOT NULL,
    private_mac INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip TEXT,
    mac TEXT
  );
  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(id),
    source TEXT NOT NULL,
    observed_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS discovery_evidence (
    id TEXT PRIMARY KEY,
    device_id TEXT REFERENCES devices(id),
    source TEXT NOT NULL,
    value_json TEXT NOT NULL,
    confidence REAL NOT NULL,
    observed_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity_events (
    id TEXT PRIMARY KEY,
    device_id TEXT REFERENCES devices(id),
    type TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    metadata_json TEXT
  );
  CREATE TABLE IF NOT EXISTS router_actions (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_at INTEGER NOT NULL,
    result_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS device_snapshots (
    device_id TEXT PRIMARY KEY REFERENCES devices(id),
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS device_preferences (
    device_id TEXT PRIMARY KEY REFERENCES devices(id),
    alias TEXT,
    trust_status TEXT
  );
  CREATE INDEX IF NOT EXISTS activity_events_time ON activity_events(occurred_at);
  CREATE INDEX IF NOT EXISTS observations_time ON observations(observed_at);
  CREATE INDEX IF NOT EXISTS evidence_time ON discovery_evidence(observed_at);
  CREATE TABLE IF NOT EXISTS app_settings (id INTEGER PRIMARY KEY CHECK(id = 1), payload_json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notification_reads (event_id TEXT PRIMARY KEY REFERENCES activity_events(id) ON DELETE CASCADE);
`;
const migrations = [{ version: 1, sql: BOOTSTRAP }];

export function migrate(database: DatabaseSync): void {
  const current = (
    database.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
  if (current > migrations.length)
    throw new Error("Banco criado por uma versao mais recente do aplicativo.");
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    database.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      database.exec(migration.sql);
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
