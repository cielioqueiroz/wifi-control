import { afterEach, describe, expect, it } from "vitest";
import { get } from "node:http";
import { HistoryStore } from "@wifi-control/database";
import { UnsupportedRouterAdapter } from "@wifi-control/router-adapters";
import { UnsupportedNetworkAdapter } from "@wifi-control/network";
import { createAgentServer } from "./server.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
});

async function fixture() {
  const store = new HistoryStore(":memory:");
  const network = new UnsupportedNetworkAdapter();
  const app = createAgentServer({
    store,
    network,
    router: new UnsupportedRouterAdapter(),
    discover: () =>
      Promise.resolve({
        interfaces: [
          {
            name: "Wi-Fi",
            address: "192.168.3.10",
            cidr: "192.168.3.10/24",
            gateway: "192.168.3.1",
            family: "IPv4",
            internal: false
          }
        ],
        neighbors: [],
        pings: [{ ip: "192.168.3.42", reachable: true, latencyMs: 1 }]
      })
  });
  await new Promise<void>((resolve) =>
    app.server.listen(0, "127.0.0.1", resolve)
  );
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        app.server.close(() => {
          store.close();
          resolve();
        });
        app.server.closeAllConnections();
      })
  );
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const base = `http://127.0.0.1:${address.port}`;
  const session = (await fetch(`${base}/session`).then((response) =>
    response.json()
  )) as { token: string };
  const headers = {
    "content-type": "application/json",
    "x-wifi-control-token": session.token
  };
  return { base, headers, store };
}

describe("local API boundaries", () => {
  it("rejects untrusted origins, rebound hosts and missing tokens", async () => {
    const { base } = await fixture();
    expect(
      (
        await fetch(`${base}/session`, {
          headers: { origin: "http://evil.invalid" }
        })
      ).status
    ).toBe(403);
    const reboundStatus = await new Promise<number | undefined>(
      (resolve, reject) => {
        get(
          `${base}/session`,
          { headers: { host: "evil.invalid" } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          }
        ).on("error", reject);
      }
    );
    expect(reboundStatus).toBe(403);
    expect(
      (
        await fetch(`${base}/router/block`, {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" }
        })
      ).status
    ).toBe(403);
  });
  it("persists UTF-8 preferences, rejects arbitrary target input and handles malformed JSON", async () => {
    const { base, headers, store } = await fixture();
    await fetch(`${base}/devices`);
    const result = await fetch(`${base}/devices/preferences`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        deviceId: "ip-192-168-3-42",
        alias: "Televisão da sala",
        trustStatus: "trusted"
      })
    });
    expect(result.status).toBe(200);
    expect(store.getDevices()[0]?.identity.displayName).toBe(
      "Televisão da sala"
    );
    expect(
      (
        await fetch(`${base}/router/block`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            deviceId: "ip-192-168-3-42",
            confirmation: "BLOQUEAR",
            mac: "forged"
          })
        })
      ).status
    ).toBe(422);
    expect(
      (await fetch(`${base}/scan`, { method: "POST", headers, body: "{" }))
        .status
    ).toBe(400);
  });
});
