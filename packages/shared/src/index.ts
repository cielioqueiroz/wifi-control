export type DeviceStatus = "online" | "offline" | "unknown";
export type TrustStatus = "unknown" | "trusted" | "blocked";
export type IdentificationSource = "detected" | "inferred" | "manual";

export interface DeviceIdentity {
  id: string;
  ip: string | null;
  mac: string | null;
  hostname: string | null;
  displayName: string;
  manufacturer: string | null;
  deviceType: string | null;
  operatingSystem: string | null;
  status: DeviceStatus;
  trustStatus: TrustStatus;
  privateMac: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface IdentificationClaim<TValue> {
  value: TValue;
  source: IdentificationSource;
  confidence: number;
}

export function isPrivateMacAddress(mac: string): boolean {
  const firstOctet = mac.split(/[:-]/)[0];

  if (!firstOctet || !/^[0-9a-fA-F]{2}$/.test(firstOctet)) {
    return false;
  }

  return (Number.parseInt(firstOctet, 16) & 0b00000010) === 0b00000010;
}
