import { encode } from "dns-packet";
import { describe, expect, it } from "vitest";
import { parseMdns, parseSsdp } from "./enrichment.js";

describe("local protocol evidence", () => {
  it("decodes mDNS answers and ignores malformed packets", () => {
    expect(
      parseMdns(
        encode({
          type: "response",
          answers: [
            { type: "A", name: "TV.local", data: "192.168.3.40", ttl: 120 }
          ]
        })
      )
    ).toEqual([{ ip: "192.168.3.40", hostname: "TV", source: "mdns" }]);
    expect(parseMdns(Buffer.from([255, 0, 1]))).toEqual([]);
  });
  it("records SSDP services without following advertised URLs", () => {
    expect(
      parseSsdp(
        Buffer.from(
          "HTTP/1.1 200 OK\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\nLOCATION: http://external.invalid\r\n\r\n"
        ),
        "192.168.3.40"
      )[0]?.source
    ).toBe("ssdp");
    expect(
      parseSsdp(Buffer.from("HTTP/1.1 200 OK\r\nST: test"), "8.8.8.8")
    ).toEqual([]);
  });
});
