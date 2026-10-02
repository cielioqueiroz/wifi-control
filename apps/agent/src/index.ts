import { readLocalApiConfig, readRouterConfig } from "@wifi-control/config";
import { HistoryStore } from "@wifi-control/database";
import {
  createPlatformNetworkAdapter,
  discoverNetwork
} from "@wifi-control/network";
import { createRouterAdapter } from "./router.js";
import { createAgentServer } from "./server.js";

const config = readLocalApiConfig();
if (!["127.0.0.1", "localhost"].includes(config.host))
  throw new Error("O agente deve escutar somente no computador local.");
const network = createPlatformNetworkAdapter();
const store = new HistoryStore();
const router = createRouterAdapter(readRouterConfig());
const app = createAgentServer({
  store,
  network,
  router,
  discover: (signal) => discoverNetwork(network, { enrich: true, signal })
});
app.server.listen(config.port, config.host, () =>
  console.info(
    JSON.stringify({
      level: "info",
      event: "agent_started",
      address: `http://${config.host}:${config.port}`
    })
  )
);
const interval = setInterval(() => {
  void app.scan();
}, 15_000);
interval.unref();
function shutdown(): void {
  clearInterval(interval);
  app.cancel();
  app.server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
