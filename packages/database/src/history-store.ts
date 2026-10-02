import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";

export type HistoryDeviceStatus = "online" | "offline" | "unknown";

export interface HistoryDeviceInput {
  claims?: {
    displayName: {
      value: string;
      source: "manual" | "detected" | "inferred";
      confidence: number;
    };
  };
  identity: {
    deviceType: string | null;
    displayName: string;
    hostname: string | null;
    id: string;
    ip: string | null;
    lastSeenAt: Date;
    manufacturer: string | null;
    mac: string | null;
    operatingSystem: string | null;
    privateMac: boolean;
    status: HistoryDeviceStatus;
    trustStatus: "unknown" | "trusted" | "blocked";
    firstSeenAt: Date;
  };
  evidence: readonly HistoryEvidenceInput[];
}

export interface HistoryEvidenceInput {
  confidence: number;
  observedAt: Date;
  source: string;
  value: unknown;
}

export interface HistoryDevice {
  displayName: string;
  firstSeenAt: string;
  id: string;
  ip: string | null;
  lastSeenAt: string;
  mac: string | null;
  status: HistoryDeviceStatus;
}

export interface HistoryEvent {
  deviceId: string | null;
  deviceName: string | null;
  id: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  type: string;
}

export interface HistorySnapshot {
  devices: HistoryDevice[];
  events: HistoryEvent[];
}

export interface RouterAuditInput {
  action: "block" | "unblock";
  deviceId: string | null;
  result: Record<string, unknown>;
  status: "requested" | "succeeded" | "failed";
}

interface StoredDeviceRow {
  display_name: string;
  first_seen_at: number;
  id: string;
  ip: string | null;
  last_seen_at: number;
  mac: string | null;
  status: HistoryDeviceStatus;
}

interface StoredEventRow {
  device_id: string | null;
  device_name: string | null;
  id: string;
  metadata_json: string | null;
  occurred_at: number;
  type: string;
}

const defaultDatabasePath = join(process.cwd(), "data", "wifi-control.sqlite");

export class HistoryStore {
  private readonly database: DatabaseSync;

  constructor(databasePath = process.env.WIFI_CONTROL_DB_PATH) {
    const resolvedPath = databasePath ?? defaultDatabasePath;

    if (resolvedPath !== ":memory:") {
      mkdirSync(dirname(resolvedPath), { recursive: true });
    }

    this.database = new DatabaseSync(resolvedPath);
    this.database.exec("PRAGMA foreign_keys = ON;");
    this.database.exec(HISTORY_SCHEMA);
  }

  recordDevices(devices: readonly HistoryDeviceInput[]): void {
    this.database.exec("BEGIN IMMEDIATE TRANSACTION;");

    try {
      for (const device of devices) {
        const stored = this.database
          .prepare(
            "SELECT payload_json FROM device_snapshots WHERE device_id = ?"
          )
          .get(device.identity.id) as { payload_json: string } | undefined;
        const previous = stored ? decodeDevice(stored.payload_json) : null;
        const preference = this.database
          .prepare(
            "SELECT alias, trust_status FROM device_preferences WHERE device_id = ?"
          )
          .get(device.identity.id) as
          { alias: string | null; trust_status: string | null } | undefined;
        const merged: HistoryDeviceInput = {
          ...device,
          identity: {
            ...device.identity,
            firstSeenAt:
              previous?.identity.firstSeenAt ?? device.identity.firstSeenAt,
            lastSeenAt:
              device.identity.status === "online"
                ? device.identity.lastSeenAt
                : (previous?.identity.lastSeenAt ?? device.identity.lastSeenAt),
            displayName: preference?.alias ?? device.identity.displayName,
            trustStatus: (preference?.trust_status ??
              device.identity
                .trustStatus) as HistoryDeviceInput["identity"]["trustStatus"]
          }
        };
        if (preference?.alias)
          merged.claims = {
            displayName: {
              value: preference.alias,
              source: "manual",
              confidence: 1
            }
          };
        this.recordDevice(merged);
        this.saveDevice(merged);
      }

      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  getSnapshot(limit = 100): HistorySnapshot {
    const normalizedLimit = Math.max(1, Math.min(Math.floor(limit), 500));
    const devices = this.database
      .prepare(
        `SELECT display_name, first_seen_at, id, ip, last_seen_at, mac, status
         FROM devices
         ORDER BY last_seen_at DESC`
      )
      .all() as unknown as StoredDeviceRow[];
    const events = this.database
      .prepare(
        `SELECT activity_events.device_id, devices.display_name AS device_name,
                activity_events.id, activity_events.metadata_json,
                activity_events.occurred_at, activity_events.type
         FROM activity_events
         LEFT JOIN devices ON devices.id = activity_events.device_id
         ORDER BY activity_events.occurred_at DESC
         LIMIT ?`
      )
      .all(normalizedLimit) as unknown as StoredEventRow[];

    return {
      devices: devices.map((device) => ({
        displayName: device.display_name,
        firstSeenAt: new Date(device.first_seen_at).toISOString(),
        id: device.id,
        ip: device.ip,
        lastSeenAt: new Date(device.last_seen_at).toISOString(),
        mac: device.mac,
        status: device.status
      })),
      events: events.map((event) => ({
        deviceId: event.device_id,
        deviceName: event.device_name,
        id: event.id,
        metadata: parseMetadata(event.metadata_json),
        occurredAt: new Date(event.occurred_at).toISOString(),
        type: event.type
      }))
    };
  }

  close(): void {
    this.database.close();
  }

  getDevices(): HistoryDeviceInput[] {
    return (
      this.database
        .prepare("SELECT payload_json FROM device_snapshots ORDER BY device_id")
        .all() as { payload_json: string }[]
    ).map((row) => decodeDevice(row.payload_json));
  }

  updatePreferences(
    id: string,
    input: { alias?: string; trustStatus?: "unknown" | "trusted" }
  ): boolean {
    const device = this.getDevices().find((item) => item.identity.id === id);
    if (!device) return false;
    this.database.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      this.database
        .prepare(
          `INSERT INTO device_preferences (device_id, alias, trust_status) VALUES (?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET alias = COALESCE(excluded.alias, alias), trust_status = COALESCE(excluded.trust_status, trust_status)`
        )
        .run(id, input.alias ?? null, input.trustStatus ?? null);
      if (input.alias !== undefined) {
        device.identity.displayName = input.alias;
        device.claims = {
          displayName: { source: "manual", confidence: 1, value: input.alias }
        };
      }
      if (input.trustStatus !== undefined)
        device.identity.trustStatus = input.trustStatus;
      this.database
        .prepare(
          "UPDATE devices SET display_name = ?, trust_status = ? WHERE id = ?"
        )
        .run(device.identity.displayName, device.identity.trustStatus, id);
      this.saveDevice(device);
      this.recordEvent(id, "device_updated", Date.now(), input);
      this.database.exec("COMMIT");
      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  markAbsent(
    scannedAddresses: readonly string[],
    onlineIds: readonly string[],
    now = Date.now()
  ): void {
    const scanned = new Set(scannedAddresses);
    for (const device of this.getDevices()) {
      if (
        !device.identity.ip ||
        !scanned.has(device.identity.ip) ||
        onlineIds.includes(device.identity.id) ||
        now - device.identity.lastSeenAt.getTime() < 120_000 ||
        device.identity.status === "offline"
      )
        continue;
      device.identity.status = "offline";
      this.database
        .prepare("UPDATE devices SET status = 'offline' WHERE id = ?")
        .run(device.identity.id);
      this.saveDevice(device);
      this.recordEvent(device.identity.id, "status_changed", now, {
        from: "online",
        to: "offline"
      });
    }
  }

  prune(retentionDays = 90): void {
    const cutoff = Date.now() - Math.max(7, retentionDays) * 86_400_000;
    for (const table of ["observations", "discovery_evidence"]) {
      this.database
        .prepare(`DELETE FROM ${table} WHERE observed_at < ?`)
        .run(cutoff);
    }
    this.database
      .prepare("DELETE FROM activity_events WHERE occurred_at < ?")
      .run(cutoff);
  }

  getRouterActions(): unknown[] {
    return this.database
      .prepare(
        "SELECT id, device_id AS deviceId, action, status, requested_at AS requestedAt, result_json AS resultJson FROM router_actions ORDER BY requested_at DESC LIMIT 100"
      )
      .all();
  }

  private saveDevice(device: HistoryDeviceInput): void {
    this.database
      .prepare(
        "INSERT INTO device_snapshots (device_id, payload_json) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET payload_json = excluded.payload_json"
      )
      .run(device.identity.id, JSON.stringify(device));
  }

  recordRouterAction(input: RouterAuditInput): void {
    this.database
      .prepare(
        `INSERT INTO router_actions
           (id, device_id, action, status, requested_at, result_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        input.deviceId,
        input.action,
        input.status,
        Date.now(),
        JSON.stringify(input.result)
      );
  }

  private recordDevice(device: HistoryDeviceInput): void {
    const existing = this.database
      .prepare(
        `SELECT display_name, first_seen_at, id, ip, last_seen_at, mac, status
         FROM devices WHERE id = ?`
      )
      .get(device.identity.id) as unknown as StoredDeviceRow | undefined;
    const firstSeenAt = device.identity.firstSeenAt.getTime();
    const lastSeenAt = device.identity.lastSeenAt.getTime();
    const now = Date.now();

    if (!existing) {
      this.database
        .prepare(
          `INSERT INTO devices (
             id, display_name, hostname, manufacturer, device_type,
             operating_system, status, trust_status, private_mac,
             first_seen_at, last_seen_at, created_at, updated_at, ip, mac
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          device.identity.id,
          device.identity.displayName,
          device.identity.hostname,
          device.identity.manufacturer,
          device.identity.deviceType,
          device.identity.operatingSystem,
          device.identity.status,
          device.identity.trustStatus,
          device.identity.privateMac ? 1 : 0,
          firstSeenAt,
          lastSeenAt,
          now,
          now,
          device.identity.ip,
          device.identity.mac
        );
      this.recordEvent(device.identity.id, "device_discovered", lastSeenAt, {
        status: device.identity.status
      });
    } else {
      const nextFirstSeenAt = Math.min(existing.first_seen_at, firstSeenAt);
      const nextLastSeenAt = Math.max(existing.last_seen_at, lastSeenAt);

      this.database
        .prepare(
          `UPDATE devices
           SET display_name = ?, hostname = ?, manufacturer = ?,
               device_type = ?, operating_system = ?, status = ?,
               trust_status = ?, private_mac = ?, first_seen_at = ?,
               last_seen_at = ?, updated_at = ?, ip = ?, mac = ?
           WHERE id = ?`
        )
        .run(
          device.identity.displayName,
          device.identity.hostname,
          device.identity.manufacturer,
          device.identity.deviceType,
          device.identity.operatingSystem,
          device.identity.status,
          device.identity.trustStatus,
          device.identity.privateMac ? 1 : 0,
          nextFirstSeenAt,
          nextLastSeenAt,
          now,
          device.identity.ip,
          device.identity.mac,
          device.identity.id
        );

      if (existing.status !== device.identity.status) {
        this.recordEvent(device.identity.id, "status_changed", lastSeenAt, {
          from: existing.status,
          to: device.identity.status
        });
      }
    }

    for (const evidence of device.evidence) {
      this.database
        .prepare(
          `INSERT INTO observations
             (id, device_id, source, observed_at, payload_json)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          device.identity.id,
          evidence.source,
          evidence.observedAt.getTime(),
          JSON.stringify(evidence.value)
        );
      this.database
        .prepare(
          `INSERT INTO discovery_evidence
             (id, device_id, source, value_json, confidence, observed_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          device.identity.id,
          evidence.source,
          JSON.stringify(evidence.value),
          evidence.confidence,
          evidence.observedAt.getTime()
        );
    }
  }

  private recordEvent(
    deviceId: string,
    type: string,
    occurredAt: number,
    metadata: Record<string, unknown>
  ): void {
    this.database
      .prepare(
        `INSERT INTO activity_events
           (id, device_id, type, occurred_at, metadata_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), deviceId, type, occurredAt, JSON.stringify(metadata));
  }
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const HISTORY_SCHEMA = `
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
`;

function decodeDevice(payload: string): HistoryDeviceInput {
  const device = JSON.parse(payload) as HistoryDeviceInput;
  device.identity.firstSeenAt = new Date(device.identity.firstSeenAt);
  device.identity.lastSeenAt = new Date(device.identity.lastSeenAt);
  device.evidence = device.evidence.map((item) => ({
    ...item,
    observedAt: new Date(item.observedAt)
  }));
  return device;
}
