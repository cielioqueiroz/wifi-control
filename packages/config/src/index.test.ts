import { describe, expect, it } from "vitest";

import { isRouterConfigReady, readRouterConfig } from "./index.js";

describe("router configuration", () => {
  it("keeps the router adapter disabled by default", () => {
    const config = readRouterConfig({});

    expect(config.adapter).toBe("unsupported");
    expect(isRouterConfigReady(config)).toBe(false);
  });

  it("uses a local credential reference without reading a password", () => {
    const config = readRouterConfig({
      ROUTER_ADAPTER: "huawei-ax2",
      ROUTER_BASE_URL: "http://192.168.3.1",
      ROUTER_CREDENTIAL_REF: "wifi-control-router"
    });

    expect(isRouterConfigReady(config)).toBe(true);
    expect(config).not.toHaveProperty("password");
  });
});
