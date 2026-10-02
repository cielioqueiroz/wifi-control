import { ShieldAlert, Wifi } from "lucide-react";
import type { JSX } from "react";

import { StatusBadge } from "@wifi-control/ui";

const devices = [
  {
    name: "Galaxy-A23-5G",
    ip: "192.168.3.57",
    type: "Smartphone",
    status: "online" as const
  },
  {
    name: "Unknown",
    ip: "192.168.3.151",
    type: "Unknown",
    status: "online" as const
  },
  {
    name: "Unknown",
    ip: "192.168.3.156",
    type: "Unknown",
    status: "online" as const
  },
  {
    name: "Unknown",
    ip: "192.168.3.174",
    type: "Unknown",
    status: "online" as const
  }
];

export default function Home(): JSX.Element {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-64 shrink-0 border-r border-border pr-6 lg:block">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wifi className="h-4 w-4" />
            WiFi Control
          </div>
          <nav className="mt-8 space-y-1 text-sm">
            <a
              className="block rounded bg-zinc-100 px-3 py-2 font-medium"
              href="/"
            >
              Network
            </a>
            <span className="block px-3 py-2 text-muted-foreground">
              Devices
            </span>
            <span className="block px-3 py-2 text-muted-foreground">
              History
            </span>
            <span className="block px-3 py-2 text-muted-foreground">
              Router
            </span>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm text-muted-foreground">Network</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                192.168.3.0/24
              </h1>
            </div>
            <div className="inline-flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <ShieldAlert className="h-4 w-4" />
              Router control unavailable
            </div>
          </header>

          <section className="grid gap-4 py-6 sm:grid-cols-3">
            <Metric label="Devices" value="6" />
            <Metric label="Online" value="4" />
            <Metric label="Unknown" value="2" />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Devices</h2>
              <button
                className="rounded border border-border px-3 py-2 text-sm font-medium text-muted-foreground"
                disabled
                type="button"
              >
                Scan not configured
              </button>
            </div>

            <div className="overflow-hidden rounded border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr className="border-t border-border" key={device.ip}>
                      <td className="px-4 py-3 font-medium">{device.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {device.ip}
                      </td>
                      <td className="px-4 py-3">{device.type}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={device.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value
}: Readonly<{ label: string; value: string }>): JSX.Element {
  return (
    <div className="rounded border border-border px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
