import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { HistoryStore } from "./history-store.js";
import { migrate } from "./migrations.js";

it("reopens migrated databases without losing settings or recreating the schema", () => {
  const directory = mkdtempSync(join(tmpdir(), "wifi-control-test-"));
  const file = join(directory, "test.sqlite");
  const store = new HistoryStore(file);
  store.updateSettings({
    ...store.getSettings(),
    theme: "dark",
    scanIntervalSeconds: 300
  });
  store.close();
  const reopened = new HistoryStore(file);
  expect(reopened.getSettings()).toMatchObject({
    theme: "dark",
    scanIntervalSeconds: 300
  });
  reopened.close();
  const db = new DatabaseSync(file);
  expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(1);
  db.exec("PRAGMA user_version = 999");
  expect(() => migrate(db)).toThrow();
  db.close();
  unlinkSync(file);
  rmdirSync(directory);
});
