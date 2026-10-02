import { createServer } from "node:http";
import type { ServerResponse } from "node:http";

import { readLocalApiConfig } from "@wifi-control/config";
import { HistoryStore } from "@wifi-control/database";
import { identifyDevices } from "@wifi-control/identification";
import {
  createPlatformNetworkAdapter,
  discoverNetwork
} from "@wifi-control/network";
import { UnsupportedRouterAdapter } from "@wifi-control/router-adapters";

const config = readLocalApiConfig();
const networkAdapter = createPlatformNetworkAdapter();
const routerAdapter = new UnsupportedRouterAdapter();
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

  if (request.method !== "GET") {
    writeJson(response, request, 405, { error: "Method not allowed" });
    return;
  }

  if (request.url === "/health") {
    writeJson(response, request, 200, { ok: true });
    return;
  }

  if (request.url === "/status") {
    void writeStatus(response, request);
    return;
  }

  if (request.url === "/discover") {
    void writeDiscovery(response, request);
    return;
  }

  if (request.url === "/devices") {
    void writeDevices(response, request);
    return;
  }

  if (request.url === "/history") {
    writeJson(response, request, 200, historyStore.getSnapshot());
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
  const discovery = await discoverNetwork(networkAdapter);

  writeJson(response, request, 200, discovery);
}

async function writeDevices(
  response: ServerResponse,
  request: { headers: { origin?: string } }
): Promise<void> {
  const discovery = await discoverNetwork(networkAdapter);
  const identification = identifyDevices(discovery);

  historyStore.recordDevices(identification.devices);

  writeJson(response, request, 200, identification);
}

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": origin,
    vary: "Origin"
  };
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
