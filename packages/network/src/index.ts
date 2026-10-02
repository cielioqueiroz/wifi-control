import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { enrichNames, type NameEvidence } from "./enrichment.js";
export { enrichNames, type NameEvidence } from "./enrichment.js";

const execFile = promisify(execFileCallback);

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

export interface DiscoveryOptions {
  signal?: AbortSignal;
  enrich?: boolean;
  maxConcurrency?: number;
  pingTimeoutMs?: number;
  maxAddressesPerSubnet?: number;
}

export interface NetworkDiscoveryResult {
  names?: NameEvidence[];
  interfaces: NetworkInterface[];
  neighbors: NeighborEntry[];
  pings: PingResult[];
}

const DEFAULT_MAX_CONCURRENCY = 16;
const DEFAULT_PING_TIMEOUT_MS = 750;
const DEFAULT_MAX_ADDRESSES_PER_SUBNET = 1024;

interface PowerShellRecord {
  [key: string]: unknown;
}

export function parseWindowsInterfaceOutput(
  output: string
): NetworkInterface[] {
  return parsePowerShellRecords(output).flatMap((record) => {
    const name = readString(record, "InterfaceAlias");
    const addressRecord = firstRecord(record["IPv4Address"]);
    const address =
      readString(addressRecord, "IPAddress") ?? readString(record, "IPAddress");
    const prefixLength =
      readNumber(addressRecord, "PrefixLength") ??
      readNumber(record, "PrefixLength");
    const gatewayRecord = firstRecord(record["IPv4DefaultGateway"]);
    const gateway =
      readString(gatewayRecord, "NextHop") ??
      readString(record, "NextHop") ??
      null;

    if (!name || !address || !isValidIPv4(address)) {
      return [];
    }

    return [
      {
        address,
        cidr:
          prefixLength !== null && prefixLength >= 0 && prefixLength <= 32
            ? `${address}/${prefixLength}`
            : null,
        family: "IPv4" as const,
        gateway: gateway && isValidIPv4(gateway) ? gateway : null,
        internal: false,
        name
      }
    ];
  });
}

export function parseWindowsNeighborOutput(output: string): NeighborEntry[] {
  const observedAt = new Date();

  return parsePowerShellRecords(output).flatMap((record) => {
    const ip = readString(record, "IPAddress");

    if (!ip || !isValidIPv4(ip) || isReservedNeighborIPv4(ip)) {
      return [];
    }

    const rawMac =
      readString(record, "LinkLayerAddress") ??
      readString(record, "MacAddress");
    const mac = normalizeMacAddress(rawMac);

    if (rawMac && !mac) {
      return [];
    }

    return [
      {
        interfaceName:
          readString(record, "InterfaceAlias") ??
          readString(record, "InterfaceIndex"),
        ip,
        mac,
        observedAt,
        state: readString(record, "State")
      }
    ];
  });
}

export function normalizeMacAddress(mac: string | null): string | null {
  if (!mac || !/^([0-9a-f]{2}[-:]){5}[0-9a-f]{2}$/i.test(mac.trim())) {
    return null;
  }

  const normalized = mac.replaceAll("-", ":").toUpperCase();

  return normalized === "00:00:00:00:00:00" ||
    normalized === "FF:FF:FF:FF:FF:FF"
    ? null
    : normalized;
}

export function isPrivateIPv4(address: string): boolean {
  const octets = parseIPv4(address);

  if (!octets) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function calculateIPv4Subnet(
  address: string,
  prefixLength: number
): string {
  const value = ipv4ToNumber(address);

  if (
    value === null ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > 32
  ) {
    throw new Error("Invalid IPv4 address or prefix length");
  }

  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return `${numberToIPv4(value & mask)}/${prefixLength}`;
}

export function enumerateIPv4Hosts(
  cidr: string,
  exclusions: readonly string[] = [],
  maxAddresses = DEFAULT_MAX_ADDRESSES_PER_SUBNET
): string[] {
  const parsed = parseCIDR(cidr);

  if (!parsed || parsed.prefixLength >= 31 || maxAddresses < 1) {
    return [];
  }

  const hostCount = 2 ** (32 - parsed.prefixLength) - 2;

  if (hostCount > maxAddresses) {
    return [];
  }

  const excluded = new Set(exclusions.filter(isValidIPv4));
  const firstHost = parsed.network + 1;
  const lastHost = parsed.broadcast - 1;
  const hosts: string[] = [];

  for (let current = firstHost; current <= lastHost; current += 1) {
    const ip = numberToIPv4(current);

    if (!excluded.has(ip)) {
      hosts.push(ip);
    }
  }

  return hosts;
}

export function getScanTargets(
  interfaces: readonly NetworkInterface[],
  maxAddressesPerSubnet = DEFAULT_MAX_ADDRESSES_PER_SUBNET
): string[] {
  const targets = new Set<string>();

  for (const networkInterface of interfaces) {
    if (
      networkInterface.family !== "IPv4" ||
      networkInterface.internal ||
      !networkInterface.cidr ||
      !isPrivateIPv4(networkInterface.address)
    ) {
      continue;
    }

    const hosts = enumerateIPv4Hosts(
      networkInterface.cidr,
      [networkInterface.address, networkInterface.gateway ?? ""],
      maxAddressesPerSubnet
    );

    for (const host of hosts) {
      targets.add(host);
    }
  }

  return [...targets];
}

export async function discoverNetwork(
  adapter: NetworkPlatformAdapter,
  options: DiscoveryOptions = {}
): Promise<NetworkDiscoveryResult> {
  const maxConcurrency = clampInteger(
    options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    1,
    64
  );
  const pingTimeoutMs = clampInteger(
    options.pingTimeoutMs ?? DEFAULT_PING_TIMEOUT_MS,
    50,
    10_000
  );
  const maxAddressesPerSubnet = clampInteger(
    options.maxAddressesPerSubnet ?? DEFAULT_MAX_ADDRESSES_PER_SUBNET,
    1,
    4096
  );
  const [interfaces, neighbors] = await Promise.all([
    adapter.getInterfaces(),
    adapter.getNeighbors()
  ]);
  const targets = getScanTargets(interfaces, maxAddressesPerSubnet);
  const pings = await mapWithConcurrency(
    targets,
    maxConcurrency,
    async (ip) => {
      options.signal?.throwIfAborted();
      return withTimeout(adapter.ping(ip), pingTimeoutMs, {
        ip,
        latencyMs: null,
        reachable: false
      });
    }
  );

  options.signal?.throwIfAborted();
  const refreshed = await adapter.getNeighbors();
  const latestNeighbors = refreshed.length ? refreshed : neighbors;
  const names = options.enrich
    ? await enrichNames(
        [
          ...latestNeighbors.map((item) => item.ip),
          ...pings.filter((item) => item.reachable).map((item) => item.ip)
        ],
        interfaces,
        options.signal
      )
    : [];
  return { interfaces, neighbors: latestNeighbors, pings, names };
}

export class WindowsNetworkAdapter implements NetworkPlatformAdapter {
  public constructor(
    private readonly pingTimeoutMs = DEFAULT_PING_TIMEOUT_MS
  ) {}

  async getInterfaces(): Promise<NetworkInterface[]> {
    const output = await runPowerShell(
      "Get-NetIPConfiguration | Where-Object { $_.IPv4Address -ne $null } | ForEach-Object { $address = @($_.IPv4Address) | Select-Object -First 1; [pscustomobject]@{ InterfaceAlias = $_.InterfaceAlias; IPAddress = $address.IPAddress; PrefixLength = $address.PrefixLength; NextHop = $_.IPv4DefaultGateway.NextHop } } | ConvertTo-Json -Compress"
    );

    return parseWindowsInterfaceOutput(output);
  }

  async getNeighbors(): Promise<NeighborEntry[]> {
    const output = await runPowerShell(
      "Get-NetNeighbor -AddressFamily IPv4 | Select-Object IPAddress,LinkLayerAddress,State,InterfaceAlias,InterfaceIndex | ConvertTo-Json -Compress"
    );

    return parseWindowsNeighborOutput(output);
  }

  async ping(ip: string): Promise<PingResult> {
    if (!isValidIPv4(ip)) {
      return { ip, latencyMs: null, reachable: false };
    }

    const startedAt = Date.now();

    try {
      const { stdout } = await execFile(
        "ping.exe",
        ["-4", "-n", "1", "-w", String(this.pingTimeoutMs), ip],
        {
          maxBuffer: 64 * 1024,
          timeout: this.pingTimeoutMs + 500,
          windowsHide: true
        }
      );
      const latencyMs = parsePingLatency(stdout) ?? Date.now() - startedAt;
      const reachable = /ttl[=\s]/i.test(stdout);
      return { ip, latencyMs: reachable ? latencyMs : null, reachable };
    } catch {
      return { ip, latencyMs: null, reachable: false };
    }
  }
}

export function createPlatformNetworkAdapter(): NetworkPlatformAdapter {
  return process.platform === "win32"
    ? new WindowsNetworkAdapter()
    : new UnsupportedNetworkAdapter();
}

async function runPowerShell(command: string): Promise<string> {
  try {
    const { stdout } = await execFile(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      { maxBuffer: 256 * 1024, timeout: 15_000, windowsHide: true }
    );

    return stdout;
  } catch {
    return "";
  }
}

function parsePowerShellRecords(output: string): PowerShellRecord[] {
  const trimmed = output.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const values = Array.isArray(parsed) ? parsed : [parsed];

    return values.flatMap((value) => {
      if (!isRecord(value)) {
        return [];
      }

      return [value];
    });
  } catch {
    return [];
  }
}

function firstRecord(value: unknown): PowerShellRecord | null {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    return isRecord(first) ? first : null;
  }

  return isRecord(value) ? value : null;
}

function readString(
  record: PowerShellRecord | null,
  key: string
): string | null {
  const value = record?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : null;
}

function readNumber(
  record: PowerShellRecord | null,
  key: string
): number | null {
  const value = record?.[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return typeof value === "string" && value.trim() ? Number(value) : null;
}

function isRecord(value: unknown): value is PowerShellRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReservedNeighborIPv4(address: string): boolean {
  const octets = parseIPv4(address);

  if (!octets) {
    return true;
  }

  const [first, , , last] = octets;

  return first >= 224 || last === 255;
}

function parsePingLatency(output: string): number | null {
  const match = output.match(/(?:time|tempo)[=<]\s*(\d+)\s*ms/i);
  return match?.[1] ? Number(match[1]) : null;
}

function parseCIDR(cidr: string): {
  broadcast: number;
  network: number;
  prefixLength: number;
} | null {
  const [address, prefix] = cidr.split("/");
  const prefixLength = Number(prefix);
  const value = address ? ipv4ToNumber(address) : null;

  if (
    value === null ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > 32
  ) {
    return null;
  }

  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  const network = (value & mask) >>> 0;
  const hostBits = 32 - prefixLength;
  const broadcast = (network + 2 ** hostBits - 1) >>> 0;

  return { broadcast, network, prefixLength };
}

function ipv4ToNumber(address: string): number | null {
  const octets = parseIPv4(address);

  if (!octets) {
    return null;
  }

  return (
    (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0
  );
}

function parseIPv4(address: string): [number, number, number, number] | null {
  const parts = address.trim().split(".");

  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const octets = parts.map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return null;
  }

  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
}

function numberToIPv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join(".");
}

function isValidIPv4(address: string): boolean {
  return ipv4ToNumber(address) !== null;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

async function mapWithConcurrency<TInput, TOutput>(
  values: readonly TInput[],
  concurrency: number,
  worker: (value: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(values.length);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      results[index] = await worker(values[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      consume()
    )
  );

  return results;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(fallback), timeoutMs);

    void promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      () => {
        clearTimeout(timeout);
        resolve(fallback);
      }
    );
  });
}
