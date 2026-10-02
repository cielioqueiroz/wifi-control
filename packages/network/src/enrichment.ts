import { createSocket } from "node:dgram";
import { Resolver } from "node:dns/promises";
import { decode, encode } from "dns-packet";

import { isPrivateIPv4, type NetworkInterface } from "./index.js";

export interface NameEvidence {
  ip: string;
  hostname: string | null;
  source: "dns" | "mdns" | "ssdp";
  service?: string;
}

export async function enrichNames(
  addresses: string[],
  interfaces: NetworkInterface[],
  signal?: AbortSignal
): Promise<NameEvidence[]> {
  const ips = [...new Set(addresses.filter(isPrivateIPv4))].slice(0, 128);
  const active = interfaces
    .filter((item) => !item.internal && isPrivateIPv4(item.address))
    .slice(0, 4);
  const multicast = active.flatMap((item) => [
    collectMulticast(item.address, ips, "mdns", signal),
    collectMulticast(item.address, ips, "ssdp", signal)
  ]);
  const dns: NameEvidence[] = [];
  const servers = [
    ...new Set(
      active.flatMap((item) =>
        item.gateway && isPrivateIPv4(item.gateway) ? [item.gateway] : []
      )
    )
  ];
  if (servers.length) {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, ips.length) }, async () => {
        while (next < ips.length && !signal?.aborted) {
          const ip = ips[next++]!;
          const resolver = new Resolver({ timeout: 700, tries: 1 });
          resolver.setServers(servers);
          const cancel = (): void => resolver.cancel();
          signal?.addEventListener("abort", cancel, { once: true });
          try {
            const names = await resolver.reverse(ip);
            if (names[0])
              dns.push({ ip, hostname: names[0].slice(0, 253), source: "dns" });
          } catch {
            /* Missing PTR records are normal on home networks. */
          } finally {
            signal?.removeEventListener("abort", cancel);
          }
        }
      })
    );
  }
  return [...dns, ...(await Promise.all(multicast)).flat()];
}

export function parseMdns(message: Buffer): NameEvidence[] {
  try {
    const packet = decode(message);
    if (packet.type !== "response") return [];
    return [...(packet.answers ?? []), ...(packet.additionals ?? [])].flatMap(
      (answer): NameEvidence[] => {
        if (answer.type === "A" && isPrivateIPv4(answer.data)) {
          return [
            {
              ip: answer.data,
              hostname: answer.name.replace(/\.local\.?$/i, "").slice(0, 253),
              source: "mdns"
            }
          ];
        }
        if (answer.type === "PTR" && answer.name.endsWith(".in-addr.arpa")) {
          const ip = answer.name
            .replace(/\.in-addr\.arpa$/, "")
            .split(".")
            .reverse()
            .join(".");
          if (isPrivateIPv4(ip))
            return [
              {
                ip,
                hostname: answer.data.replace(/\.local\.?$/i, "").slice(0, 253),
                source: "mdns"
              }
            ];
        }
        return [];
      }
    );
  } catch {
    return [];
  }
}

export function parseSsdp(message: Buffer, ip: string): NameEvidence[] {
  const text = message.toString("utf8");
  if (!isPrivateIPv4(ip) || !/^HTTP\/1\.1 200\b/i.test(text)) return [];
  const service = text
    .split(/\r?\n/)
    .find((line) => /^ST:/i.test(line))
    ?.slice(3)
    .trim()
    .slice(0, 256);
  return service ? [{ ip, hostname: null, source: "ssdp", service }] : [];
}

function collectMulticast(
  address: string,
  ips: string[],
  protocol: "mdns" | "ssdp",
  signal?: AbortSignal
): Promise<NameEvidence[]> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const evidence: NameEvidence[] = [];
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      try {
        socket.close();
      } catch {
        /* Binding may have failed. */
      }
      resolve(evidence);
    };
    const timer = setTimeout(finish, 1500);
    signal?.addEventListener("abort", finish, { once: true });
    if (signal?.aborted) {
      finish();
      return;
    }
    socket.on("error", finish);
    socket.on("message", (message, peer) => {
      if (
        message.length > 8192 ||
        evidence.length >= 256 ||
        !isPrivateIPv4(peer.address)
      )
        return;
      evidence.push(
        ...(protocol === "mdns"
          ? parseMdns(message)
          : parseSsdp(message, peer.address))
      );
    });
    socket.bind(0, address, () => {
      if (finished) return;
      socket.setMulticastTTL(1);
      socket.setMulticastInterface(address);
      const payload =
        protocol === "mdns"
          ? encode({
              type: "query",
              questions: [
                { name: "_services._dns-sd._udp.local", type: "PTR" },
                ...ips.map((ip) => ({
                  name: `${ip.split(".").reverse().join(".")}.in-addr.arpa`,
                  type: "PTR" as const
                }))
              ]
            })
          : Buffer.from(
              'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ssdp:all\r\n\r\n'
            );
      socket.send(
        payload,
        protocol === "mdns" ? 5353 : 1900,
        protocol === "mdns" ? "224.0.0.251" : "239.255.255.250",
        (error) => {
          if (error) finish();
        }
      );
    });
  });
}
