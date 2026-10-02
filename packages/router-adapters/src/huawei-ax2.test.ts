import { createHmac, pbkdf2Sync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { HuaweiAx2Adapter } from "./huawei-ax2.js";

describe("HuaweiAx2Adapter", () => {
  it("authenticates with the official SCRAM flow and manages the blocklist", async () => {
    const password = "teste-seguro";
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const serverNonce = "server-nonce";
    const iterations = 1;
    let firstNonce = "";
    const calls: Array<{ body: string; method: string; url: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      await Promise.resolve();
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : "";
      calls.push({ body, method, url });

      if (url.endsWith("/html/index.html#/login")) {
        return new Response(
          '<meta name="csrf_param" content="param"><meta name="csrf_token" content="token">',
          { headers: { "set-cookie": "sid=initial; Path=/" } }
        );
      }
      if (url.endsWith("/user_login_nonce")) {
        const request = JSON.parse(body) as { data: { firstnonce: string } };
        firstNonce = request.data.firstnonce;
        return jsonResponse({
          err: 0,
          iterations,
          salt: salt.toString("hex"),
          servernonce: serverNonce
        });
      }
      if (url.endsWith("/user_login_proof")) {
        return jsonResponse({
          err: 0,
          serversignature: createServerSignature(
            password,
            salt,
            iterations,
            `${firstNonce},${serverNonce},${serverNonce}`
          )
        });
      }
      if (url.endsWith("/HostInfo")) {
        return jsonResponse([
          {
            ActualName: "Notebook",
            IPAddress: "192.168.3.42",
            MACAddress: "AA:BB:CC:DD:EE:FF"
          }
        ]);
      }
      if (url.endsWith("/wlanfilterenhance") && method === "GET") {
        return jsonResponse([
          {
            BMACAddresses: [],
            MACAddressControlEnabled: true,
            WMACAddresses: []
          },
          {
            BMACAddresses: [],
            MACAddressControlEnabled: true,
            WMACAddresses: []
          }
        ]);
      }
      if (url.endsWith("/wlanfilterenhance") && method === "POST") {
        return jsonResponse({ err: 0 });
      }

      return new Response(null, { status: 404 });
    };
    const adapter = new HuaweiAx2Adapter({
      baseUrl: "http://192.168.3.1",
      credentialProvider: {
        getCredentials: () => Promise.resolve({ password, username: "admin" })
      },
      fetchImpl
    });

    await expect(adapter.listConnectedDevices()).resolves.toEqual([
      {
        hostname: "Notebook",
        ip: "192.168.3.42",
        mac: "AA:BB:CC:DD:EE:FF"
      }
    ]);
    await expect(adapter.blockDevice("aa-bb-cc-dd-ee-ff")).resolves.toEqual({
      ok: true
    });

    const blockCall = calls.find(
      (call) =>
        call.method === "POST" && call.url.endsWith("/wlanfilterenhance")
    );
    expect(blockCall?.body).toContain("BMacFilters");
  });
});

function createServerSignature(
  password: string,
  salt: Buffer,
  iterations: number,
  authMessage: string
): string {
  const saltedPassword = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const serverKey = createHmac("sha256", saltedPassword)
    .update("Server Key")
    .digest();
  return createHmac("sha256", serverKey).update(authMessage).digest("hex");
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" }
  });
}
