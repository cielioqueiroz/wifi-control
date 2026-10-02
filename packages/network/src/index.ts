export type DiscoveryEvidenceSource =
  "arp" | "neighbor" | "icmp" | "dns" | "mdns" | "ssdp" | "oui";

export interface NeighborEntry {
  ip: string;
  mac: string | null;
  interfaceName: string | null;
  state: string | null;
  observedAt: Date;
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: "IPv4" | "IPv6";
  cidr: string | null;
  gateway: string | null;
  internal: boolean;
}

export interface PingResult {
  ip: string;
  reachable: boolean;
  latencyMs: number | null;
}

export interface DiscoveryEvidence {
  source: DiscoveryEvidenceSource;
  value: unknown;
  observedAt: Date;
  confidence: number;
}

export interface NetworkPlatformAdapter {
  getInterfaces(): Promise<NetworkInterface[]>;
  getNeighbors(): Promise<NeighborEntry[]>;
  ping(ip: string): Promise<PingResult>;
}

export class UnsupportedNetworkAdapter implements NetworkPlatformAdapter {
  getInterfaces(): Promise<NetworkInterface[]> {
    return Promise.resolve([]);
  }

  getNeighbors(): Promise<NeighborEntry[]> {
    return Promise.resolve([]);
  }

  ping(ip: string): Promise<PingResult> {
    return Promise.resolve({
      ip,
      latencyMs: null,
      reachable: false
    });
  }
}
