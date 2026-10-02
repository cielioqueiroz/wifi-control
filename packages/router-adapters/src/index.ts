import { isIP } from "node:net";

export interface RouterInfo {
  id: string;
  model: string;
  vendor: string;
  gatewayIp: string;
  supportsBlocking: boolean;
}

export interface RouterDevice {
  ip: string | null;
  mac: string;
  hostname: string | null;
}

export interface RouterActionResult {
  ok: boolean;
  code?: RouterActionCode;
  reason?: string;
}

export type RouterActionCode =
  | "confirmation_required"
  | "invalid_ip"
  | "invalid_mac"
  | "protected_target"
  | "unsupported";

export interface RouterActionRequest {
  confirmation: string;
  ip: string | null;
  mac: string;
}

export interface RouterSafetyContext {
  gatewayIp: string;
  localAddresses: readonly string[];
}

export interface RouterAdapter {
  getInfo(): Promise<RouterInfo>;
  listConnectedDevices(): Promise<RouterDevice[]>;
  listBlockedDevices(): Promise<RouterDevice[]>;
  blockDevice(mac: string): Promise<RouterActionResult>;
  unblockDevice(mac: string): Promise<RouterActionResult>;
}

export function validateRouterAction(
  action: "block" | "unblock",
  request: RouterActionRequest,
  context: RouterSafetyContext
): RouterActionResult {
  const expectedConfirmation = action === "block" ? "BLOQUEAR" : "DESBLOQUEAR";

  if (request.confirmation !== expectedConfirmation) {
    return {
      code: "confirmation_required",
      ok: false,
      reason: `Digite ${expectedConfirmation} para confirmar esta ação.`
    };
  }

  const normalizedMac = normalizeMac(request.mac);

  if (!normalizedMac) {
    return {
      code: "invalid_mac",
      ok: false,
      reason: "O endereço MAC informado é inválido ou reservado."
    };
  }

  if (!request.ip || isIP(request.ip) !== 4) {
    return {
      code: "invalid_ip",
      ok: false,
      reason: "Informe um endereço IPv4 válido para o dispositivo."
    };
  }

  if (
    request.ip === context.gatewayIp ||
    context.localAddresses.includes(request.ip) ||
    isBroadcastAddress(request.ip)
  ) {
    return {
      code: "protected_target",
      ok: false,
      reason:
        "O gateway, este computador e endereços de broadcast são protegidos."
    };
  }

  return { ok: true };
}

export class UnsupportedRouterAdapter implements RouterAdapter {
  getInfo(): Promise<RouterInfo> {
    return Promise.resolve({
      gatewayIp: "192.168.3.1",
      id: "unsupported-huawei-ax2",
      model: "WiFi AX2",
      supportsBlocking: false,
      vendor: "Huawei"
    });
  }

  listConnectedDevices(): Promise<RouterDevice[]> {
    return Promise.resolve([]);
  }

  listBlockedDevices(): Promise<RouterDevice[]> {
    return Promise.resolve([]);
  }

  blockDevice(): Promise<RouterActionResult> {
    return Promise.resolve({
      code: "unsupported",
      ok: false,
      reason:
        "A integração do roteador está indisponível até que o acesso legítimo seja configurado localmente."
    });
  }

  unblockDevice(): Promise<RouterActionResult> {
    return Promise.resolve({
      code: "unsupported",
      ok: false,
      reason:
        "A integração do roteador está indisponível até que o acesso legítimo seja configurado localmente."
    });
  }
}

export class MockRouterAdapter extends UnsupportedRouterAdapter {}

function normalizeMac(value: string): string | null {
  const normalized = value.replaceAll("-", ":").toLowerCase();

  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(normalized)) {
    return null;
  }

  const octets = normalized
    .split(":")
    .map((octet) => Number.parseInt(octet, 16));
  const firstOctet = octets[0];

  if (
    firstOctet === undefined ||
    octets.every((octet) => octet === 0) ||
    octets.every((octet) => octet === 255) ||
    (firstOctet & 1) === 1
  ) {
    return null;
  }

  return normalized;
}

function isBroadcastAddress(value: string): boolean {
  return value === "255.255.255.255" || value.endsWith(".255");
}
