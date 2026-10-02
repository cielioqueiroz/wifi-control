import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
};

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  hostname: text("hostname"),
  manufacturer: text("manufacturer"),
  deviceType: text("device_type"),
  operatingSystem: text("operating_system"),
  status: text("status", { enum: ["online", "offline", "unknown"] })
    .notNull()
    .default("unknown"),
  trustStatus: text("trust_status", {
    enum: ["unknown", "trusted", "blocked"]
  })
    .notNull()
    .default("unknown"),
  privateMac: integer("private_mac", { mode: "boolean" })
    .notNull()
    .default(false),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  ...timestamps
});

export const deviceAddresses = sqliteTable("device_addresses", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
  ip: text("ip"),
  mac: text("mac"),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  ...timestamps
});

export const observations = sqliteTable("observations", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
  source: text("source").notNull(),
  observedAt: integer("observed_at", { mode: "timestamp" }).notNull(),
  payloadJson: text("payload_json").notNull()
});

export const deviceAliases = sqliteTable("device_aliases", {
  id: text("id").primaryKey(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
  alias: text("alias").notNull(),
  source: text("source", { enum: ["manual", "detected", "inferred"] }).notNull()
});

export const discoveryEvidence = sqliteTable("discovery_evidence", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").references(() => devices.id),
  source: text("source").notNull(),
  valueJson: text("value_json").notNull(),
  confidence: real("confidence").notNull(),
  observedAt: integer("observed_at", { mode: "timestamp" }).notNull()
});

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").references(() => devices.id),
  type: text("type").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  metadataJson: text("metadata_json")
});

export const routerActions = sqliteTable("router_actions", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").references(() => devices.id),
  action: text("action", { enum: ["block", "unblock"] }).notNull(),
  status: text("status", {
    enum: ["requested", "succeeded", "failed"]
  }).notNull(),
  requestedAt: integer("requested_at", { mode: "timestamp" }).notNull(),
  resultJson: text("result_json")
});
