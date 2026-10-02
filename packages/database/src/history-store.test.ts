import { describe, expect, it } from "vitest";

import { HistoryStore, type HistoryDeviceInput } from "./history-store.js";

function makeDevice(
  status: HistoryDeviceInput["identity"]["status"],
  observedAt: string
): HistoryDeviceInput {
  const date = new Date(observedAt);

  return {
    evidence: [
      {
        confidence: 0.95,
        observedAt: date,
        source: "neighbor",
        value: { ip: "192.168.3.42" }
      }
    ],
    identity: {
      deviceType: null,
      displayName: "Notebook de teste",
      firstSeenAt: date,
      hostname: "notebook",
      id: "mac-aabbccddeeff",
      ip: "192.168.3.42",
      lastSeenAt: date,
      manufacturer: null,
      mac: "aa:bb:cc:dd:ee:ff",
      operatingSystem: null,
      privateMac: false,
      status,
      trustStatus: "unknown"
    }
  };
}

describe("HistoryStore", () => {
  it("keeps manual preferences and presence timestamps across scans", () => {
    const store = new HistoryStore(":memory:");
    store.recordDevices([makeDevice("online", "2026-10-02T10:00:00.000Z")]);
    expect(
      store.updatePreferences("mac-aabbccddeeff", {
        alias: "TV da sala",
        trustStatus: "trusted"
      })
    ).toBe(true);
    store.recordDevices([makeDevice("unknown", "2026-10-02T10:10:00.000Z")]);
    expect(store.getDevices()[0]?.identity).toMatchObject({
      displayName: "TV da sala",
      trustStatus: "trusted",
      lastSeenAt: new Date("2026-10-02T10:00:00.000Z")
    });
    store.markAbsent(
      ["192.168.3.42"],
      [],
      Date.parse("2026-10-02T10:10:00.000Z")
    );
    expect(store.getDevices()[0]?.identity.status).toBe("offline");
    expect(store.updatePreferences("missing", { alias: "Teste" })).toBe(false);
    store.close();
  });
  it("persists first and last seen dates", () => {
    const store = new HistoryStore(":memory:");

    store.recordDevices([makeDevice("online", "2026-10-02T10:00:00.000Z")]);
    store.recordDevices([makeDevice("online", "2026-10-02T10:05:00.000Z")]);

    const snapshot = store.getSnapshot();
    expect(snapshot.devices).toHaveLength(1);
    expect(snapshot.devices[0]).toMatchObject({
      firstSeenAt: "2026-10-02T10:00:00.000Z",
      lastSeenAt: "2026-10-02T10:05:00.000Z"
    });
    expect(snapshot.events).toHaveLength(1);

    store.close();
  });

  it("records status transitions in the activity timeline", () => {
    const store = new HistoryStore(":memory:");

    store.recordDevices([makeDevice("online", "2026-10-02T10:00:00.000Z")]);
    store.recordDevices([makeDevice("offline", "2026-10-02T10:10:00.000Z")]);

    const snapshot = store.getSnapshot();
    expect(snapshot.events).toHaveLength(2);
    expect(snapshot.events[0]).toMatchObject({
      metadata: { from: "online", to: "offline" },
      type: "status_changed"
    });

    store.close();
  });

  it("records router actions in the audit table", () => {
    const store = new HistoryStore(":memory:");

    expect(() =>
      store.recordRouterAction({
        action: "block",
        deviceId: "mac-aabbccddeeff",
        result: { ok: false, reason: "confirmation_required" },
        status: "failed"
      })
    ).not.toThrow();

    store.close();
  });
});
