import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  isRouterConfigReady,
  readLocalApiConfig,
  readRouterConfig,
  type RouterConfig
} from "@wifi-control/config";
import { HistoryStore } from "@wifi-control/database";
import { identifyDevices } from "@wifi-control/identification";
import {
  createPlatformNetworkAdapter,
  discoverNetwork
} from "@wifi-control/network";
import {
  HuaweiAx2Adapter,
  type RouterActionRequest,
  type RouterAdapter,
  UnsupportedRouterAdapter,
  validateRouterAction
} from "@wifi-control/router-adapters";

const config = readLocalApiConfig();
const routerConfig = readRouterConfig();
const networkAdapter = createPlatformNetworkAdapter();
const routerAdapter = createRouterAdapter(routerConfig);
const historyStore = new HistoryStore();
const allowedOrigins = new Set([
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://localhost:3001",
  "http://localhost:3000"
]);

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, getCorsHeaders(request.headers.origin));
    response.end();
    return;
  }

  const route = request.url?.split("?", 1)[0];

  if (
    request.method === "POST" &&
    (route === "/router/block" || route === "/router/unblock")
  ) {
    void readJsonBody(request)
      .then((body) =>
        writeRouterAction(
          response,
          request,
          route === "/router/block" ? "block" : "unblock",
          body
        ).catch((error) => {
          console.warn("Router request failed", error);
          writeJson(response, request, 502, {
            error: "Não foi possível processar a ação do roteador."
          });
        })
      )
      .catch(() => {
        writeJson(response, request, 400, {
          error: "O corpo da requisição deve ser um JSON válido de até 8 KB."
        });
      });
    return;
  }

  if (request.method !== "GET") {
    writeJson(response, request, 405, { error: "Method not allowed" });
    return;
  }

  if (route === "/health") {
    writeJson(response, request, 200, { ok: true });
    return;
  }

  if (route === "/status") {
    void writeStatus(response, request);
    return;
  }

  if (route === "/discover") {
    void writeDiscovery(response, request);
    return;
  }

  if (route === "/devices") {
    void writeDevices(response, request);
    return;
  }

  if (route === "/history") {
    writeJson(response, request, 200, historyStore.getSnapshot());
    return;
  }

  if (route === "/router/devices") {
    void writeRouterDevices(response, request);
    return;
  }

  writeJson(response, request, 404, { error: "Not found" });
});

server.listen(config.port, config.host, () => {
  console.info(
    `WiFi Control agent listening on http://${config.host}:${config.port}`
  );
});

async function writeStatus(
  response: ServerResponse,
  request: { headers: { origin?: string } }
): Promise<void> {
  const [interfaces, router] = await Promise.all([
    networkAdapter.getInterfaces(),
    routerAdapter.getInfo()
  ]);

  writeJson(response, request, 200, {
    interfaces,
    router,
    scanner: {
      endpoint: "/discover",
      platform: process.platform,
      ready: true
    }
  });
}

async function writeDiscovery(
  response: ServerResponse,
  request: { headers: { origin?: string } }
): Promise<void> {
  const discovery = await discoverNetwork(networkAdapter, { enrich: true });

  writeJson(response, request, 200, discovery);
}

async function writeDevices(
  response: ServerResponse,
  request: { headers: { origin?: string } }
): Promise<void> {
  const discovery = await discoverNetwork(networkAdapter, { enrich: true });
  const identification = identifyDevices(discovery);

  historyStore.recordDevices(identification.devices);
  historyStore.markAbsent(
    discovery.pings.map((item) => item.ip),
    identification.devices
      .filter((item) => item.identity.status === "online")
      .map((item) => item.identity.id)
  );
  historyStore.prune();
  writeJson(response, request, 200, {
    ...identification,
    devices: historyStore.getDevices()
  });
}

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": origin,
    vary: "Origin"
  };
}

function createRouterAdapter(routerConfig: RouterConfig): RouterAdapter {
  const username = process.env.ROUTER_USERNAME;
  const password = process.env.ROUTER_PASSWORD;

  if (
    !isRouterConfigReady(routerConfig) ||
    !username ||
    !password ||
    !routerConfig.baseUrl
  ) {
    return new UnsupportedRouterAdapter();
  }

  return new HuaweiAx2Adapter({
    baseUrl: routerConfig.baseUrl,
    credentialProvider: {
      getCredentials: () => Promise.resolve({ password, username })
    },
    gatewayIp: routerConfig.gatewayIp
  });
}

async function writeRouterDevices(
  response: ServerResponse,
  request: { headers: { origin?: string } }
): Promise<void> {
  try {
    const [connected, blocked] = await Promise.all([
      routerAdapter.listConnectedDevices(),
      routerAdapter.listBlockedDevices()
    ]);
    writeJson(response, request, 200, { blocked, connected });
  } catch (error) {
    console.warn("Router device listing failed", error);
    writeJson(response, request, 502, {
      error: "Não foi possível consultar os dispositivos do roteador."
    });
  }
}

async function writeRouterAction(
  response: ServerResponse,
  request: IncomingMessage,
  action: "block" | "unblock",
  body: Record<string, unknown>
): Promise<void> {
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : null;
  const actionRequest = toRouterActionRequest(body);
  const interfaces = await networkAdapter.getInterfaces();
  const validation = validateRouterAction(action, actionRequest, {
    gatewayIp: routerConfig.gatewayIp,
    localAddresses: interfaces
      .filter((networkInterface) => networkInterface.family === "IPv4")
      .map((networkInterface) => networkInterface.address)
  });

  if (!validation.ok) {
    historyStore.recordRouterAction({
      action,
      deviceId,
      result: { ...validation },
      status: "failed"
    });
    writeJson(response, request, 422, validation);
    return;
  }

  historyStore.recordRouterAction({
    action,
    deviceId,
    result: { ok: true },
    status: "requested"
  });

  try {
    const result =
      action === "block"
        ? await routerAdapter.blockDevice(actionRequest.mac)
        : await routerAdapter.unblockDevice(actionRequest.mac);
    historyStore.recordRouterAction({
      action,
      deviceId,
      result: { ...result },
      status: result.ok ? "succeeded" : "failed"
    });
    writeJson(response, request, result.ok ? 200 : 422, result);
  } catch (error) {
    console.warn(`Router ${action} action failed`, error);
    const result = {
      ok: false,
      reason: "O roteador não concluiu a alteração solicitada."
    };
    historyStore.recordRouterAction({
      action,
      deviceId,
      result,
      status: "failed"
    });
    writeJson(response, request, 502, result);
  }
}

function toRouterActionRequest(
  body: Record<string, unknown>
): RouterActionRequest {
  return {
    confirmation:
      typeof body.confirmation === "string" ? body.confirmation : "",
    ip: typeof body.ip === "string" ? body.ip : null,
    mac: typeof body.mac === "string" ? body.mac : ""
  };
}

async function readJsonBody(
  request: IncomingMessage
): Promise<Record<string, unknown>> {
  let body = "";
  let size = 0;

  for await (const chunk of request) {
    const chunkValue: unknown = chunk;
    const part =
      typeof chunkValue === "string"
        ? chunkValue
        : chunkValue instanceof Uint8Array
          ? Buffer.from(chunkValue).toString("utf8")
          : (() => {
              throw new Error("Invalid request body chunk");
            })();
    size += Buffer.byteLength(part);
    if (size > 8192) {
      throw new Error("Request body too large");
    }
    body += part;
  }

  const rawBody = body.trim();
  const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be an object");
  }
  return parsed as Record<string, unknown>;
}

function writeJson(
  response: ServerResponse,
  request: { headers: { origin?: string } },
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    ...getCorsHeaders(request.headers.origin)
  });
  response.end(JSON.stringify(payload));
}
