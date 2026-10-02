import { describe, expect, it } from "vitest";

import {
  calculateIPv4Subnet,
  discoverNetwork,
  enumerateIPv4Hosts,
  getScanTargets,
  isPrivateIPv4,
  parseWindowsInterfaceOutput,
  parseWindowsNeighborOutput,
  type NetworkPlatformAdapter
} from "./index.js";

describe("Windows network parsers", () => {
  it("parses PowerShell interface output", () => {
    const interfaces = parseWindowsInterfaceOutput(
      JSON.stringify({
        InterfaceAlias: "Wi-Fi",
        IPv4Address: { IPAddress: "192.168.3.20", PrefixLength: 24 },
        IPv4DefaultGateway: { NextHop: "192.168.3.1" }
      })
    );

    expect(interfaces).toEqual([
      {
        address: "192.168.3.20",
        cidr: "192.168.3.20/24",
        family: "IPv4",
        gateway: "192.168.3.1",
        internal: false,
        name: "Wi-Fi"
      }
    ]);
  });

  it("parses neighbors and normalizes MAC addresses", () => {
    const neighbors = parseWindowsNeighborOutput(
      JSON.stringify([
        {
          IPAddress: "192.168.3.44",
          InterfaceAlias: "Wi-Fi",
          LinkLayerAddress: "ea-57-fd-a3-38-c8",
          State: "Reachable"
        }
      ])
    );

    expect(neighbors[0]).toMatchObject({
      interfaceName: "Wi-Fi",
      ip: "192.168.3.44",
      mac: "EA:57:FD:A3:38:C8",
      state: "Reachable"
    });
  });
});

describe("bounded network discovery", () => {
  it("calculates the network CIDR and refuses oversized sweeps", () => {
    expect(calculateIPv4Subnet("192.168.3.10", 24)).toBe("192.168.3.0/24");
    expect(enumerateIPv4Hosts("192.168.0.10/16")).toEqual([]);
  });

  it("excludes interface, gateway, network and broadcast addresses", () => {
    const networkInterface = {
      address: "192.168.3.10",
      cidr: "192.168.3.10/29",
      family: "IPv4" as const,
      gateway: "192.168.3.9",
      internal: false,
      name: "Wi-Fi"
    };

    expect(
      enumerateIPv4Hosts(networkInterface.cidr, [
        networkInterface.address,
        networkInterface.gateway
      ])
    ).toEqual(["192.168.3.11", "192.168.3.12", "192.168.3.13", "192.168.3.14"]);
    expect(getScanTargets([networkInterface])).toEqual([
      "192.168.3.11",
      "192.168.3.12",
      "192.168.3.13",
      "192.168.3.14"
    ]);
  });

  it("keeps ICMP concurrency within the configured limit", async () => {
    let active = 0;
    let peak = 0;
    const adapter: NetworkPlatformAdapter = {
      getInterfaces: () =>
        Promise.resolve([
          {
            address: "192.168.3.10",
            cidr: "192.168.3.10/29",
            family: "IPv4" as const,
            gateway: "192.168.3.9",
            internal: false,
            name: "Wi-Fi"
          }
        ]),
      getNeighbors: () => Promise.resolve([]),
      ping: async (ip) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { ip, latencyMs: 5, reachable: true };
      }
    };

    const result = await discoverNetwork(adapter, {
      maxConcurrency: 2,
      pingTimeoutMs: 100
    });

    expect(result.pings).toHaveLength(4);
    expect(peak).toBe(2);
  });

  it("identifies local IPv4 ranges", () => {
    expect(isPrivateIPv4("10.0.0.5")).toBe(true);
    expect(isPrivateIPv4("172.16.0.5")).toBe(true);
    expect(isPrivateIPv4("192.168.3.1")).toBe(true);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
  });
});
