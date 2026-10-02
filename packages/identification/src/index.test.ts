import { describe, expect, it } from "vitest";

import { identifyDevices } from "./index.js";

describe("device identification", () => {
  it("preserves online neighbor evidence when ICMP is ignored", () => {
    const result = identifyDevices({
      neighbors: [
        {
          ip: "192.168.3.40",
          mac: "AA:BB:CC:DD:EE:FF",
          state: "Reachable",
          observedAt: new Date(),
          interfaceName: "Wi-Fi"
        }
      ],
      pings: [{ ip: "192.168.3.40", reachable: false, latencyMs: null }],
      names: [{ ip: "192.168.3.40", hostname: "TV", source: "mdns" }]
    });
    expect(result.devices[0]?.identity).toMatchObject({
      status: "online",
      hostname: "TV"
    });
    expect(result.devices[0]?.claims.displayName.source).toBe("detected");
  });
  it("correlates neighbor and ICMP evidence into one online device", () => {
    const observedAt = new Date("2026-10-02T13:00:00.000Z");
    const result = identifyDevices({
      neighbors: [
        {
          interfaceName: "Wi-Fi",
          ip: "192.168.3.44",
          mac: "AA:BB:CC:DD:EE:FF",
          observedAt,
          state: "Reachable"
        }
      ],
      observedAt,
      pings: [{ ip: "192.168.3.44", latencyMs: 4, reachable: true }]
    });

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]?.identity).toMatchObject({
      id: "mac-AABBCCDDEEFF",
      ip: "192.168.3.44",
      mac: "AA:BB:CC:DD:EE:FF",
      status: "online"
    });
    expect(result.devices[0]?.evidence).toHaveLength(2);
    expect(result.evidence).toHaveLength(2);
  });

  it("does not invent a manufacturer for a private MAC", () => {
    const result = identifyDevices({
      neighbors: [
        {
          interfaceName: "Wi-Fi",
          ip: "192.168.3.55",
          mac: "EA-57-FD-A3-38-C8",
          observedAt: new Date("2026-10-02T13:00:00.000Z"),
          state: "Reachable"
        }
      ],
      pings: []
    });

    expect(result.devices[0]?.identity.privateMac).toBe(true);
    expect(result.devices[0]?.identity.manufacturer).toBeNull();
  });

  it("lets a manual alias override display name without deleting evidence", () => {
    const result = identifyDevices({
      manualAliases: [
        { alias: "Notebook da sala", deviceId: "ip-192-168-3-21" }
      ],
      neighbors: [],
      pings: [{ ip: "192.168.3.21", latencyMs: 8, reachable: true }]
    });

    expect(result.devices[0]).toMatchObject({
      claims: {
        displayName: {
          source: "manual",
          value: "Notebook da sala"
        }
      },
      identity: {
        displayName: "Notebook da sala",
        status: "online"
      }
    });
    expect(result.devices[0]?.evidence).toHaveLength(1);
  });

  it("does not create devices for unreachable addresses without neighbor evidence", () => {
    const result = identifyDevices({
      neighbors: [],
      pings: [{ ip: "192.168.3.99", latencyMs: null, reachable: false }]
    });

    expect(result.devices).toEqual([]);
    expect(result.evidence).toEqual([]);
  });
});
