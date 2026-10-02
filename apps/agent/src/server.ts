import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { z } from "zod";
import { type HistoryStore } from "@wifi-control/database";
import { type RouterAdapter } from "@wifi-control/router-adapters";
import {
  type NetworkPlatformAdapter,
  type NetworkDiscoveryResult
} from "@wifi-control/network";
import { identifyDevices } from "@wifi-control/identification";
import { RouterControl } from "./router.js";

interface Dependencies {
  store: HistoryStore;
  network: NetworkPlatformAdapter;
  router: RouterAdapter;
  discover: (signal: AbortSignal) => Promise<NetworkDiscoveryResult>;
}
const preferencesSchema = z
  .object({
    deviceId: z.string().min(1).max(100),
    alias: z.string().trim().min(1).max(80).optional(),
    trustStatus: z.enum(["unknown", "trusted"]).optional()
  })
  .strict()
  .refine(
    (input) => input.alias !== undefined || input.trustStatus !== undefined
  );
const actionSchema = z
  .object({
    deviceId: z.string().min(1).max(100),
    confirmation: z.string().max(20)
  })
  .strict();
const origins = new Set(["http://127.0.0.1:3001", "http://localhost:3001"]);

export function createAgentServer(deps: Dependencies) {
  const token = randomBytes(32).toString("hex");
  const routerControl = new RouterControl(
    deps.router,
    deps.network,
    deps.store
  );
  let pendingScan: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let lastScanAt = 0;
  let scanError: string | null = null;

  function scan(force = false): Promise<void> {
    if (pendingScan) return pendingScan;
    if (!force && Date.now() - lastScanAt < 30_000) return Promise.resolve();
    controller = new AbortController();
    scanError = null;
    pendingScan = deps
      .discover(controller.signal)
      .then((discovery) => {
        controller?.signal.throwIfAborted();
        if (!discovery.interfaces.length) throw new Error("no_interfaces");
        const identified = identifyDevices(discovery);
        deps.store.recordDevices(identified.devices);
        deps.store.markAbsent(
          discovery.pings.map((item) => item.ip),
          identified.devices
            .filter((item) => item.identity.status === "online")
            .map((item) => item.identity.id)
        );
        deps.store.prune();
        lastScanAt = Date.now();
      })
      .catch(() => {
        scanError = controller?.signal.aborted
          ? "Varredura cancelada."
          : "Não foi possível concluir a varredura. O histórico foi preservado.";
      })
      .finally(() => {
        pendingScan = null;
        controller = null;
      });
    return pendingScan;
  }

  const server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent)
        send(response, 500, {
          error: "Não foi possível concluir a solicitação."
        });
      else response.end();
    });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;

  async function handle(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    const origin = request.headers.origin;
    if (
      !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host ?? "") ||
      (origin !== undefined && !origins.has(origin))
    ) {
      send(response, 403, { error: "Origem não autorizada." });
      return;
    }
    if (origin) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      response.setHeader(
        "access-control-allow-headers",
        "content-type, x-wifi-control-token"
      );
      response.writeHead(204).end();
      return;
    }
    const path = request.url?.split("?")[0];
    if (request.method === "GET") {
      if (path === "/health") {
        send(response, 200, { ok: true });
        return;
      }
      if (path === "/session") {
        send(response, 200, { token });
        return;
      }
      if (path === "/status") {
        const [interfaces, router] = await Promise.all([
          deps.network.getInterfaces(),
          deps.router.getInfo()
        ]);
        send(response, 200, {
          interfaces,
          router: { ...router, available: router.supportsBlocking },
          scanner: {
            ready: interfaces.length > 0,
            running: Boolean(pendingScan),
            lastScanAt,
            error: scanError,
            platform: process.platform,
            endpoint: "/scan"
          }
        });
        return;
      }
      if (path === "/devices" || path === "/discover") {
        await scan();
        send(response, 200, {
          devices: deps.store.getDevices(),
          evidence: [],
          warning: scanError
        });
        return;
      }
      if (path === "/history") {
        send(response, 200, deps.store.getSnapshot());
        return;
      }
      if (path === "/router/audit") {
        send(response, 200, { actions: deps.store.getRouterActions() });
        return;
      }
      if (path === "/router/devices") {
        try {
          const connected = await deps.router.listConnectedDevices();
          const blocked = await deps.router.listBlockedDevices();
          send(response, 200, { connected, blocked });
        } catch {
          send(response, 502, {
            error: "Não foi possível autenticar ou consultar o roteador."
          });
        }
        return;
      }
      send(response, 404, { error: "Recurso não encontrado." });
      return;
    }
    if (request.method !== "POST") {
      send(response, 405, { error: "Método não permitido." });
      return;
    }
    const supplied = request.headers["x-wifi-control-token"];
    if (
      typeof supplied !== "string" ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
    ) {
      send(response, 403, { error: "Sessão expirada. Atualize a página." });
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      send(response, 415, { error: "Envie dados JSON." });
      return;
    }
    let body: unknown;
    try {
      body = await readBody(request);
    } catch {
      send(response, 400, { error: "JSON inválido ou maior que 8 KB." });
      return;
    }
    if (path === "/devices/preferences") {
      const parsed = preferencesSchema.safeParse(body);
      if (!parsed.success) {
        send(response, 422, {
          error:
            "Informe um nome de até 80 caracteres ou uma classificação válida."
        });
        return;
      }
      const { deviceId, ...preferences } = parsed.data;
      const exists = deps.store.updatePreferences(deviceId, preferences);
      send(response, exists ? 200 : 404, {
        ok: exists,
        devices: deps.store.getDevices()
      });
      return;
    }
    if (path === "/scan") {
      void scan(true);
      send(response, 202, { ok: true });
      return;
    }
    if (path === "/scan/cancel") {
      controller?.abort();
      send(response, 200, { ok: true });
      return;
    }
    if (path === "/router/block" || path === "/router/unblock") {
      const parsed = actionSchema.safeParse(body);
      if (!parsed.success) {
        send(response, 422, {
          error: "Selecione um dispositivo e confirme a ação."
        });
        return;
      }
      const result = await routerControl.act(
        path.endsWith("/block") ? "block" : "unblock",
        parsed.data.deviceId,
        parsed.data.confirmation
      );
      send(response, result.ok ? 200 : 422, result);
      return;
    }
    send(response, 404, { error: "Recurso não encontrado." });
  }
  return { server, scan, cancel: () => controller?.abort() };
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const raw of request) {
    const chunk: unknown = raw;
    if (!(chunk instanceof Uint8Array)) throw new Error("invalid_chunk");
    size += chunk.byteLength;
    if (size > 8192) throw new Error("body_limit");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
