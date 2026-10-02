import { describe, expect, it } from "vitest";

import { validateRouterAction } from "./index.js";

const context = {
  gatewayIp: "192.168.3.1",
  localAddresses: ["192.168.3.10"]
};

const validRequest = {
  confirmation: "BLOQUEAR",
  ip: "192.168.3.42",
  mac: "aa:bb:cc:dd:ee:ff"
};

describe("validateRouterAction", () => {
  it("requires an explicit action confirmation", () => {
    const result = validateRouterAction(
      "block",
      { ...validRequest, confirmation: "" },
      context
    );

    expect(result).toMatchObject({ code: "confirmation_required", ok: false });
  });

  it("protects the gateway, host, and broadcast addresses", () => {
    for (const ip of ["192.168.3.1", "192.168.3.10", "192.168.3.255"]) {
      const result = validateRouterAction(
        "block",
        { ...validRequest, ip },
        context
      );

      expect(result).toMatchObject({ code: "protected_target", ok: false });
    }
  });

  it("rejects multicast, broadcast, and malformed MAC addresses", () => {
    for (const mac of ["ff:ff:ff:ff:ff:ff", "01:00:5e:00:00:01", "not-a-mac"]) {
      const result = validateRouterAction(
        "block",
        { ...validRequest, mac },
        context
      );

      expect(result).toMatchObject({ code: "invalid_mac", ok: false });
    }
  });

  it("accepts a confirmed, specific unicast target", () => {
    const result = validateRouterAction(
      "unblock",
      { ...validRequest, confirmation: "DESBLOQUEAR" },
      context
    );

    expect(result).toEqual({ ok: true });
  });
});
