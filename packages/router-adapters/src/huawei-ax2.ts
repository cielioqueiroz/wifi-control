import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

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

  constructor(options: HuaweiAx2AdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.credentialProvider = options.credentialProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
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
    return this.updateBlockList(mac, true);
  }

  async unblockDevice(mac: string): Promise<RouterActionResult> {
    return this.updateBlockList(mac, false);
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

    if (configs.some((config) => config.MACAddressControlEnabled === false)) {
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
    const response = await this.postJson("ntwk/wlanfilterenhance", {
      data: payload
    });

    return responseError(response) ?? { ok: true };
  }

  private async getFilterConfigs(): Promise<FilterConfig[]> {
    const payload = await this.getJson("ntwk/wlanfilterenhance");
    const records = asRecords(payload);

    if (records.length < 2) {
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

    const loginPage = await this.fetchImpl(
      `${this.baseUrl}/html/index.html#/login`,
      { method: "GET" }
    );
    let cookie = readCookie(loginPage);
    const csrf = parseCsrf(await loginPage.text());
    const credentials = await this.credentialProvider.getCredentials();
    const firstNonce = randomBytes(24).toString("hex");
    const nonceResult = await this.postLogin(
      "system/user_login_nonce",
      { username: credentials.username, firstnonce: firstNonce },
      csrf,
      cookie
    );
    cookie = nonceResult.cookie;
    const nonceResponse = nonceResult.payload;
    const nonceData = asRecord(nonceResponse);
    const salt = hexBuffer(nonceData.salt);
    const iterations = Number(nonceData.iterations);
    const finalNonce = asString(nonceData.servernonce);

    if (!salt || !Number.isInteger(iterations) || !finalNonce) {
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
      cookie: readCookie(response) || cookie,
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
      session.cookie = cookies
        .map((cookie) => cookie.split(";", 1)[0])
        .join("; ");
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

  if (Number.isNaN(error) || error === 0) {
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
  return typeof value === "string" && /^[0-9a-f]+$/i.test(value)
    ? Buffer.from(value, "hex")
    : null;
}

function hmac(key: Buffer, value: string | Buffer): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function xorBuffers(left: Buffer, right: Buffer): Buffer {
  return Buffer.from(left.map((byte, index) => byte ^ (right[index] ?? 0)));
}
