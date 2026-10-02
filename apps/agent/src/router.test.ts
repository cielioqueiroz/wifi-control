import { describe, expect, it, vi } from "vitest";
import { HistoryStore } from "@wifi-control/database";
import { UnsupportedRouterAdapter } from "@wifi-control/router-adapters";
import { UnsupportedNetworkAdapter } from "@wifi-control/network";
import { RouterControl } from "./router.js";

describe("administrative target validation", () => {
  it("does not act on a stale or forged device association", async () => {
    const store = new HistoryStore(":memory:");
    store.recordDevices([
      {
        identity: {
          id: "test",
          mac: "AA:BB:CC:DD:EE:FF",
          ip: "192.168.3.42",
          displayName: "Teste",
          hostname: null,
          manufacturer: null,
          operatingSystem: null,
          deviceType: null,
          privateMac: true,
          status: "online",
          trustStatus: "unknown",
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        },
        evidence: []
      }
    ]);
    const router = new UnsupportedRouterAdapter();
    vi.spyOn(router, "getInfo").mockResolvedValue({
      id: "test",
      model: "test",
      vendor: "test",
      gatewayIp: "192.168.3.1",
      supportsBlocking: true
    });
    vi.spyOn(router, "listConnectedDevices").mockResolvedValue([
      { ip: "192.168.3.99", mac: "AA:BB:CC:DD:EE:FF", hostname: null }
    ]);
    const block = vi.spyOn(router, "blockDevice");
    const network = new UnsupportedNetworkAdapter();
    vi.spyOn(network, "getInterfaces").mockResolvedValue([
      {
        address: "192.168.3.10",
        gateway: "192.168.3.1",
        cidr: "192.168.3.10/24",
        family: "IPv4",
        internal: false,
        name: "test"
      }
    ]);
    const control = new RouterControl(router, network, store);
    expect((await control.act("block", "test", "BLOQUEAR")).ok).toBe(false);
    expect(block).not.toHaveBeenCalled();
    expect(store.getRouterActions()).toHaveLength(1);
    store.close();
  });
});
