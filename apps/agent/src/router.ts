import { execFile } from "node:child_process";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { type RouterConfig } from "@wifi-control/config";
import { type HistoryStore } from "@wifi-control/database";
import { type NetworkPlatformAdapter } from "@wifi-control/network";
import {
  HuaweiAx2Adapter,
  UnsupportedRouterAdapter,
  validateRouterAction,
  type RouterAdapter,
  type RouterActionResult
} from "@wifi-control/router-adapters";

const execute = promisify(execFile);

export function createRouterAdapter(config: RouterConfig): RouterAdapter {
  if (
    config.adapter !== "huawei-ax2" ||
    !config.baseUrl ||
    !config.credentialRef
  )
    return new UnsupportedRouterAdapter();
  const password = process.env.ROUTER_PASSWORD;
  const username = process.env.ROUTER_USERNAME ?? "admin";
  const reference = config.credentialRef;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(reference))
    throw new Error("Referência de credencial inválida.");
  const file = join(
    process.env.LOCALAPPDATA ?? process.cwd(),
    "WiFiControl",
    `${reference}.credential.xml`
  );
  if (!password && (process.platform !== "win32" || !existsSync(file)))
    return new UnsupportedRouterAdapter();
  return new HuaweiAx2Adapter({
    baseUrl: config.baseUrl,
    gatewayIp: config.gatewayIp,
    credentialProvider: {
      getCredentials: async () => {
        if (password) return { password, username };
        const { stdout } = await execute(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$credential = Import-Clixml -LiteralPath $env:WIFI_CONTROL_CREDENTIAL_FILE; @{ username = $credential.UserName; password = $credential.GetNetworkCredential().Password } | ConvertTo-Json -Compress"
          ],
          {
            env: { ...process.env, WIFI_CONTROL_CREDENTIAL_FILE: file },
            windowsHide: true,
            timeout: 5000,
            maxBuffer: 16384
          }
        );
        const data: unknown = JSON.parse(stdout.trim());
        if (
          !data ||
          typeof data !== "object" ||
          !("password" in data) ||
          !("username" in data) ||
          typeof data.password !== "string" ||
          typeof data.username !== "string"
        )
          throw new Error("Credencial local inválida.");
        return { password: data.password, username: data.username };
      }
    }
  });
}

export class RouterControl {
  private busy = false;
  constructor(
    private readonly adapter: RouterAdapter,
    private readonly network: NetworkPlatformAdapter,
    private readonly store: HistoryStore
  ) {}

  async act(
    action: "block" | "unblock",
    deviceId: string,
    confirmation: string
  ): Promise<RouterActionResult> {
    if (this.busy)
      return { ok: false, reason: "Outra ação está em andamento." };
    const device = this.store
      .getDevices()
      .find((item) => item.identity.id === deviceId);
    if (!device?.identity.mac)
      return {
        ok: false,
        reason: "Dispositivo não encontrado ou sem MAC observado."
      };
    const audit = (
      status: "requested" | "succeeded" | "failed",
      result: RouterActionResult
    ): void =>
      this.store.recordRouterAction({
        action,
        deviceId,
        status,
        result: { ...result, mac: device.identity.mac }
      });
    this.busy = true;
    try {
      const info = await this.adapter.getInfo();
      const interfaces = await this.network.getInterfaces();
      const validation = validateRouterAction(
        action,
        { confirmation, ip: device.identity.ip, mac: device.identity.mac },
        {
          gatewayIp: info.gatewayIp,
          localAddresses: interfaces.map((item) => item.address)
        }
      );
      if (!validation.ok) {
        audit("failed", validation);
        return validation;
      }
      if (!info.supportsBlocking) {
        const result = {
          ok: false,
          code: "unsupported" as const,
          reason: "Configure o acesso local ao roteador."
        };
        audit("failed", result);
        return result;
      }
      if (!interfaces.some((item) => item.gateway === info.gatewayIp))
        throw new Error("gateway_unavailable");
      const neighbors = await this.network.getNeighbors();
      const protectedMacs = [
        ...Object.values(networkInterfaces()).flatMap((items) =>
          (items ?? []).map((item) => item.mac)
        ),
        ...neighbors
          .filter(
            (item) =>
              item.ip === info.gatewayIp ||
              interfaces.some((local) => local.address === item.ip)
          )
          .map((item) => item.mac ?? "")
      ].map(normalizeMac);
      const mac = normalizeMac(device.identity.mac);
      if (protectedMacs.includes(mac)) {
        const result = {
          ok: false,
          code: "protected_target" as const,
          reason: "Este dispositivo é o roteador ou o computador local."
        };
        audit("failed", result);
        return result;
      }
      const connected = await this.adapter.listConnectedDevices();
      const blocked = await this.adapter.listBlockedDevices();
      if (
        action === "block" &&
        !connected.some(
          (item) =>
            normalizeMac(item.mac) === mac && item.ip === device.identity.ip
        )
      )
        throw new Error("target_changed");
      if (
        action === "unblock" &&
        !blocked.some((item) => normalizeMac(item.mac) === mac)
      )
        return { ok: true };
      audit("requested", { ok: true });
      const result =
        action === "block"
          ? await this.adapter.blockDevice(mac)
          : await this.adapter.unblockDevice(mac);
      audit(result.ok ? "succeeded" : "failed", result);
      return result;
    } catch {
      const result = {
        ok: false,
        reason:
          "Não foi possível confirmar o dispositivo ou a alteração no roteador. Atualize o estado antes de tentar novamente."
      };
      audit("failed", result);
      return result;
    } finally {
      this.busy = false;
    }
  }
}

function normalizeMac(mac: string): string {
  return mac.replaceAll("-", ":").toUpperCase();
}
