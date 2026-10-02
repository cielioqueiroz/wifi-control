import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { isIP } from "node:net";

import type { RouterActionResult, RouterDevice, RouterInfo } from "./index.js";

export interface RouterCredentials {
  password: string;
  username: string;
}

export interface RouterCredentialProvider {
  getCredentials(): Promise<RouterCredentials>;
}

export interface HuaweiAx2AdapterOptions {
  baseUrl: string;
  credentialProvider: RouterCredentialProvider;
  gatewayIp?: string;
  fetchImpl?: typeof fetch;
}

interface CsrfToken {
  csrf_param: string;
  csrf_token: string;
}

interface Session {
  cookie: string;
  csrf: CsrfToken;
}

interface LoginResponse {
  cookie: string;
  payload: unknown;
}

interface FilterEntry {
  HostName?: string;
  MACAddress: string;
}

interface FilterConfig {
  BMACAddresses?: FilterEntry[];
  MACAddressControlEnabled?: boolean;
  MacFilterCapacity?: number;
  WMacFilters?: FilterEntry[];
  WMACAddresses?: FilterEntry[];
  [key: string]: unknown;
}

export class HuaweiAx2Adapter {
  private readonly baseUrl: string;
  private readonly credentialProvider: RouterCredentialProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly gatewayIp: string;
  private session: Session | null = null;
  private loginPromise: Promise<Session> | null = null;
  private actionQueue: Promise<unknown> = Promise.resolve();

  constructor(options: HuaweiAx2AdapterOptions) {
    const url = new URL(options.baseUrl);
    const gateway = options.gatewayIp ?? "192.168.3.1";
    const [first, second] = gateway.split(".").map(Number);
    if (
      isIP(gateway) !== 4 ||
      !(
        first === 10 ||
        (first === 192 && second === 168) ||
        (first === 172 && second !== undefined && second >= 16 && second <= 31)
      )
    )
      throw new Error("O gateway deve ser um endereço IPv4 privado.");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname !== gateway ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "O endereço do roteador deve corresponder ao gateway local."
      );
    this.baseUrl = url.origin;
    this.credentialProvider = options.credentialProvider;
    const transport = options.fetchImpl ?? fetch;
    this.fetchImpl = (input, init) =>
      transport(input, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(8000)
      });
    this.gatewayIp = options.gatewayIp ?? "192.168.3.1";
  }

  getInfo(): Promise<RouterInfo> {
    return Promise.resolve({
      gatewayIp: this.gatewayIp,
      id: "huawei-ax2",
      model: "WiFi AX2",
      supportsBlocking: true,
      vendor: "Huawei"
    });
  }

  async listConnectedDevices(): Promise<RouterDevice[]> {
    const payload = await this.getJson("system/HostInfo");
    const records = asRecords(payload);

    return records
      .filter((record) => typeof record.MACAddress === "string")
      .map((record) => ({
        hostname: asString(record.ActualName) ?? asString(record.HostName),
        ip: asString(record.IPAddress),
        mac: String(record.MACAddress).toUpperCase()
      }));
  }

  async listBlockedDevices(): Promise<RouterDevice[]> {
    const configs = await this.getFilterConfigs();
    const blocked = configs.flatMap((config) => config.BMACAddresses ?? []);
    const unique = new Map<string, FilterEntry>();

    for (const entry of blocked) {
      unique.set(entry.MACAddress.toUpperCase(), entry);
    }

    return [...unique.values()].map((entry) => ({
      hostname: entry.HostName ?? null,
      ip: null,
      mac: entry.MACAddress.toUpperCase()
    }));
  }

  async blockDevice(mac: string): Promise<RouterActionResult> {
    return this.queueAction(mac, true);
  }

  async unblockDevice(mac: string): Promise<RouterActionResult> {
    return this.queueAction(mac, false);
  }

  private queueAction(
    mac: string,
    blocked: boolean
  ): Promise<RouterActionResult> {
    const pending = this.actionQueue.then(() =>
      this.updateBlockList(mac, blocked)
    );
    this.actionQueue = pending.catch(() => undefined);
    return pending;
  }

  private async updateBlockList(
    mac: string,
    shouldBlock: boolean
  ): Promise<RouterActionResult> {
    const normalizedMac = normalizeMac(mac);

    if (!normalizedMac) {
      return {
        code: "invalid_mac",
        ok: false,
        reason: "O endereço MAC informado é inválido."
      };
    }

    const configs = await this.getFilterConfigs();

    if (configs.some((config) => config.MACAddressControlEnabled !== true)) {
      return {
        code: "unsupported",
        ok: false,
        reason:
          "A lista de bloqueio do roteador está desativada. Ative-a no painel do AX2 antes de continuar."
      };
    }

    for (const config of configs) {
      const blocked = config.BMACAddresses ?? [];
      const allowed = config.WMACAddresses ?? [];
      const destination = shouldBlock ? blocked : allowed;
      if (
        typeof config.MacFilterCapacity === "number" &&
        destination.length >= config.MacFilterCapacity &&
        !destination.some(
          (entry) => entry.MACAddress.toUpperCase() === normalizedMac
        )
      )
        return {
          ok: false,
          reason: "A lista do roteador atingiu sua capacidade."
        };
      const entry = blocked.find(
        (candidate) => candidate.MACAddress.toUpperCase() === normalizedMac
      ) ?? { MACAddress: normalizedMac };
      config.BMACAddresses = blocked.filter(
        (candidate) => candidate.MACAddress.toUpperCase() !== normalizedMac
      );
      config.WMACAddresses = allowed.filter(
        (candidate) => candidate.MACAddress.toUpperCase() !== normalizedMac
      );

      if (shouldBlock) {
        config.BMACAddresses.push(entry);
      } else {
        config.WMACAddresses.push(entry);
      }
    }

    const payload: Record<string, FilterConfig> = {};
    configs.forEach((config, index) => {
      payload[index === 0 ? "config2g" : "config5g"] = toSubmitConfig(config);
    });
    const response = await this.postJson("ntwk/wlanfilterenhance", payload);
    const error = responseError(response);
    if (error) return error;
    const verified = await this.getFilterConfigs();
    if (
      !verified.every(
        (config) =>
          (config.BMACAddresses ?? []).some(
            (entry) => entry.MACAddress.toUpperCase() === normalizedMac
          ) === shouldBlock
      )
    )
      return {
        ok: false,
        reason:
          "O roteador não confirmou a alteração. Atualize o estado antes de tentar novamente."
      };
    return { ok: true };
  }

  private async getFilterConfigs(): Promise<FilterConfig[]> {
    const payload = await this.getJson("ntwk/wlanfilterenhance");
    const records = asRecords(payload);

    if (records.length !== 2) {
      throw new Error(
        "O roteador não retornou as configurações de 2,4 e 5 GHz."
      );
    }

    return records.slice(0, 2).map((record) => ({
      ...record,
      BMACAddresses: asFilterEntries(record.BMACAddresses),
      WMACAddresses: asFilterEntries(record.WMACAddresses)
    }));
  }

  private async getJson(path: string): Promise<unknown> {
    const session = await this.getSession();
    const response = await this.fetchImpl(`${this.baseUrl}/api/${path}`, {
      headers: this.headers(session),
      method: "GET"
    });
    this.updateCookies(response, session);

    if (!response.ok) {
      this.session = null;
      throw new Error(`O roteador respondeu com HTTP ${response.status}.`);
    }

    return response.json();
  }

  private async postJson(path: string, data: unknown): Promise<unknown> {
    const session = await this.getSession();
    const response = await this.fetchImpl(`${this.baseUrl}/api/${path}`, {
      body: JSON.stringify({ data, csrf: session.csrf }),
      headers: {
        ...this.headers(session),
        _ResponseFormat: "JSON",
        "content-type": "application/json; charset=utf-8"
      },
      method: "POST"
    });
    this.updateCookies(response, session);

    if (!response.ok) {
      this.session = null;
      throw new Error(`O roteador respondeu com HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as unknown;
    const nextCsrf = readCsrf(payload);
    if (nextCsrf) {
      session.csrf = nextCsrf;
    }
    return payload;
  }

  private async getSession(): Promise<Session> {
    if (this.session) {
      return this.session;
    }

    if (!this.loginPromise)
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = null;
      });
    return this.loginPromise;
  }

  private async login(): Promise<Session> {
    const loginPage = await this.fetchImpl(
      `${this.baseUrl}/html/index.html#/login`,
      { method: "GET" }
    );
    let cookie = readCookie(loginPage);
    if (!loginPage.ok) throw new Error("O painel do roteador não respondeu.");
    let csrf = parseCsrf(await loginPage.text());
    const credentials = await this.credentialProvider.getCredentials();
    const firstNonce = randomBytes(24).toString("hex");
    const nonceResult = await this.postLogin(
      "system/user_login_nonce",
      { username: credentials.username, firstnonce: firstNonce },
      csrf,
      cookie
    );
    cookie = nonceResult.cookie;
    csrf = readCsrf(nonceResult.payload) ?? csrf;
    const nonceResponse = nonceResult.payload;
    const nonceData = asRecord(nonceResponse);
    const salt = hexBuffer(nonceData.salt);
    const iterations = Number(nonceData.iterations);
    const finalNonce = asString(nonceData.servernonce);

    if (
      !salt ||
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      iterations > 1_000_000 ||
      !finalNonce
    ) {
      throw new Error("O roteador não retornou um desafio SCRAM válido.");
    }

    const authMessage = `${firstNonce},${finalNonce},${finalNonce}`;
    const saltedPassword = pbkdf2Sync(
      credentials.password,
      salt,
      iterations,
      32,
      "sha256"
    );
    const clientKey = hmac(saltedPassword, "Client Key");
    const storedKey = createHash("sha256").update(clientKey).digest();
    const clientSignature = hmac(storedKey, authMessage);
    const clientProof = xorBuffers(clientKey, clientSignature).toString("hex");
    const serverKey = hmac(saltedPassword, "Server Key");
    const serverSignature = hmac(serverKey, authMessage).toString("hex");
    const proofResult = await this.postLogin(
      "system/user_login_proof",
      { clientproof: clientProof, finalnonce: finalNonce },
      csrf,
      cookie
    );
    cookie = proofResult.cookie;
    const proofResponse = proofResult.payload;
    const proofData = asRecord(proofResponse);

    if (proofData.err !== 0 || proofData.serversignature !== serverSignature) {
      throw new Error("A autenticação do roteador falhou.");
    }

    const nextCsrf = readCsrf(proofData) ?? csrf;
    this.session = { cookie, csrf: nextCsrf };
    return this.session;
  }

  private async postLogin(
    path: string,
    data: Record<string, string>,
    csrf: CsrfToken,
    cookie: string
  ): Promise<LoginResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/${path}`, {
      body: JSON.stringify({ data, csrf }),
      headers: {
        ...this.headers({ cookie, csrf }),
        _ResponseFormat: "JSON",
        "content-type": "application/json; charset=utf-8"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(
        `O login do roteador respondeu com HTTP ${response.status}.`
      );
    }

    return {
      cookie: mergeCookies(cookie, readCookie(response)),
      payload: await response.json()
    };
  }

  private headers(session: Session): Record<string, string> {
    return {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Cookie: session.cookie,
      "X-Requested-With": "XMLHttpRequest"
    };
  }

  private updateCookies(response: Response, session: Session): void {
    const cookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    if (cookies.length > 0) {
      session.cookie = mergeCookies(
        session.cookie,
        cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ")
      );
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  const record = asRecord(value);
  const candidate = Array.isArray(value)
    ? value
    : Array.isArray(record.data)
      ? record.data
      : [];

  return candidate.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asFilterEntries(value: unknown): FilterEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is FilterEntry =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as FilterEntry).MACAddress === "string"
  );
}

function normalizeMac(value: string): string | null {
  const normalized = value.replaceAll("-", ":").toUpperCase();
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalized) ? normalized : null;
}

function toSubmitConfig(config: FilterConfig): FilterConfig {
  const submit: FilterConfig = {};

  for (const [key, value] of Object.entries(config)) {
    if (key.endsWith("Addresses")) {
      const submitKey = key
        .replace("Addresses", "Filters")
        .replace("MAC", "Mac");
      submit[submitKey] = value;
    } else {
      submit[key] = value;
    }
  }

  return submit;
}

function responseError(payload: unknown): RouterActionResult | null {
  const record = asRecord(payload);
  const error = Number(record.errcode ?? record.err);

  if (
    (record.errcode !== undefined || record.err !== undefined) &&
    error === 0
  ) {
    return null;
  }

  return {
    ok: false,
    reason: "O roteador recusou a alteração da lista de bloqueio."
  };
}

function parseCsrf(html: string): CsrfToken {
  const csrfParam = html.match(
    /name=["']csrf_param["']\s+content=["']([^"']+)/i
  )?.[1];
  const csrfToken = html.match(
    /name=["']csrf_token["']\s+content=["']([^"']+)/i
  )?.[1];

  if (!csrfParam || !csrfToken) {
    throw new Error("O painel do roteador não forneceu tokens CSRF.");
  }

  return { csrf_param: csrfParam, csrf_token: csrfToken };
}

function readCsrf(payload: unknown): CsrfToken | null {
  const record = asRecord(payload);
  return typeof record.csrf_param === "string" &&
    typeof record.csrf_token === "string"
    ? { csrf_param: record.csrf_param, csrf_token: record.csrf_token }
    : null;
}

function readCookie(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

function hexBuffer(value: unknown): Buffer | null {
  return typeof value === "string" && /^(?:[0-9a-f]{2})+$/i.test(value)
    ? Buffer.from(value, "hex")
    : null;
}

function mergeCookies(existing: string, incoming: string): string {
  const cookies = new Map<string, string>();
  for (const part of [...existing.split("; "), ...incoming.split("; ")]) {
    const index = part.indexOf("=");
    if (index > 0) cookies.set(part.slice(0, index), part.slice(index + 1));
  }
  return [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
}

function hmac(key: Buffer, value: string | Buffer): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function xorBuffers(left: Buffer, right: Buffer): Buffer {
  return Buffer.from(left.map((byte, index) => byte ^ (right[index] ?? 0)));
}
