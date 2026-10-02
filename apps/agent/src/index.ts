import { createServer } from "node:http";
import type { ServerResponse } from "node:http";

import { readLocalApiConfig } from "@wifi-control/config";
import { UnsupportedNetworkAdapter } from "@wifi-control/network";
import { UnsupportedRouterAdapter } from "@wifi-control/router-adapters";

const config = readLocalApiConfig();
const networkAdapter = new UnsupportedNetworkAdapter();
const routerAdapter = new UnsupportedRouterAdapter();

const server = createServer((request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/status") {
    void writeStatus(response);
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(config.port, config.host, () => {
  console.info(
    `WiFi Control agent listening on http://${config.host}:${config.port}`
  );
});

async function writeStatus(response: ServerResponse): Promise<void> {
  const [interfaces, router] = await Promise.all([
    networkAdapter.getInterfaces(),
    routerAdapter.getInfo()
  ]);

  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      interfaces,
      router,
      scanner: "not-configured"
    })
  );
}
