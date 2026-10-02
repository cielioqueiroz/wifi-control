import {
  normalizeMacAddress,
  type DiscoveryEvidence,
  type NeighborEntry,
  type PingResult
} from "@wifi-control/network";
import {
  isPrivateMacAddress,
  type DeviceIdentity,
  type IdentificationClaim
} from "@wifi-control/shared";

export interface ManualDeviceAlias {
  deviceId: string;
  alias: string;
}

export interface IdentificationInput {
  names?: readonly {
    ip: string;
    hostname: string | null;
    source: "dns" | "mdns" | "ssdp";
    service?: string;
  }[];
  neighbors: readonly NeighborEntry[];
  pings: readonly PingResult[];
  observedAt?: Date;
  manualAliases?: readonly ManualDeviceAlias[];
}

export interface IdentifiedDevice {
  identity: DeviceIdentity;
  claims: {
    displayName: IdentificationClaim<string>;
  };
  evidence: DiscoveryEvidence[];
}

export interface IdentificationResult {
  devices: IdentifiedDevice[];
  evidence: DiscoveryEvidence[];
}

export function identifyDevices(
  input: IdentificationInput
): IdentificationResult {
  const observedAt = input.observedAt ?? new Date();
  const devicesById = new Map<string, IdentifiedDevice>();
  const deviceIdByIp = new Map<string, string>();

  for (const neighbor of input.neighbors) {
    const mac = normalizeMacAddress(neighbor.mac);
    const deviceId = getDeviceId(mac, neighbor.ip);
    const evidence: DiscoveryEvidence = {
      confidence: mac ? 0.95 : 0.7,
      observedAt: neighbor.observedAt,
      source: "neighbor",
      value: {
        interfaceName: neighbor.interfaceName,
        ip: neighbor.ip,
        mac,
        state: neighbor.state
      }
    };
    const device =
      devicesById.get(deviceId) ??
      createDevice(deviceId, mac, neighbor.ip, neighbor.observedAt);

    device.identity.status = getNeighborStatus(neighbor.state);
    device.identity.lastSeenAt = maxDate(
      device.identity.lastSeenAt,
      neighbor.observedAt
    );
    device.evidence.push(evidence);
    devicesById.set(deviceId, device);
    deviceIdByIp.set(neighbor.ip, deviceId);
  }

  for (const ping of input.pings) {
    const existingDeviceId = deviceIdByIp.get(ping.ip);

    if (!existingDeviceId && !ping.reachable) {
      continue;
    }

    const deviceId = existingDeviceId ?? getDeviceId(null, ping.ip);
    const device =
      devicesById.get(deviceId) ??
      createDevice(deviceId, null, ping.ip, observedAt);
    const evidence: DiscoveryEvidence = {
      confidence: ping.reachable ? 0.75 : 0.55,
      observedAt,
      source: "icmp",
      value: {
        ip: ping.ip,
        latencyMs: ping.latencyMs,
        reachable: ping.reachable
      }
    };

    device.identity.ip = ping.ip;
    if (ping.reachable) {
      device.identity.lastSeenAt = maxDate(
        device.identity.lastSeenAt,
        observedAt
      );
      device.identity.status = "online";
    }
    device.evidence.push(evidence);
    devicesById.set(deviceId, device);
    deviceIdByIp.set(ping.ip, deviceId);
  }

  for (const name of input.names ?? []) {
    const id = deviceIdByIp.get(name.ip) ?? getDeviceId(null, name.ip);
    const device =
      devicesById.get(id) ?? createDevice(id, null, name.ip, observedAt);
    if (name.hostname) {
      device.identity.hostname = name.hostname;
      device.identity.displayName = name.hostname;
      device.claims.displayName = {
        value: name.hostname,
        confidence: 0.9,
        source: "detected"
      };
    }
    if (name.source !== "dns") device.identity.status = "online";
    device.evidence.push({
      source: name.source,
      value: name,
      confidence: 0.9,
      observedAt
    });
    devicesById.set(id, device);
    deviceIdByIp.set(name.ip, id);
  }

  for (const device of devicesById.values()) {
    applyManualAlias(device, input.manualAliases ?? []);
    refreshDisplayNameClaim(device);
  }

  const devices = [...devicesById.values()];
  return {
    devices,
    evidence: devices.flatMap((device) => device.evidence)
  };
}

function createDevice(
  deviceId: string,
  mac: string | null,
  ip: string,
  observedAt: Date
): IdentifiedDevice {
  const privateMac = mac ? isPrivateMacAddress(mac) : false;
  const identity: DeviceIdentity = {
    deviceType: null,
    displayName: "Dispositivo não identificado",
    firstSeenAt: observedAt,
    hostname: null,
    id: deviceId,
    ip,
    lastSeenAt: observedAt,
    manufacturer: null,
    mac,
    operatingSystem: null,
    privateMac,
    status: "unknown",
    trustStatus: "unknown"
  };

  return {
    claims: {
      displayName: {
        confidence: 0.1,
        source: "inferred",
        value: identity.displayName
      }
    },
    evidence: [],
    identity
  };
}

function applyManualAlias(
  device: IdentifiedDevice,
  aliases: readonly ManualDeviceAlias[]
): void {
  const alias = aliases.find(
    (candidate) => candidate.deviceId === device.identity.id
  );

  if (!alias || !alias.alias.trim()) {
    return;
  }

  device.identity.displayName = alias.alias.trim();
  device.claims.displayName = {
    confidence: 1,
    source: "manual",
    value: device.identity.displayName
  };
}

function refreshDisplayNameClaim(device: IdentifiedDevice): void {
  if (device.claims.displayName.source !== "inferred") {
    return;
  }

  device.claims.displayName = {
    confidence: 0.1,
    source: "inferred",
    value: device.identity.displayName
  };
}

function getDeviceId(mac: string | null, ip: string): string {
  return mac
    ? `mac-${mac.replaceAll(":", "")}`
    : `ip-${ip.replaceAll(".", "-")}`;
}

function getNeighborStatus(state: string | null): DeviceIdentity["status"] {
  const normalizedState = state?.toLowerCase();

  return normalizedState === "reachable" || normalizedState === "5"
    ? "online"
    : "unknown";
}

function maxDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}
