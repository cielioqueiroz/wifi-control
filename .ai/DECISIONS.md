# Decisions

- Use `127.0.0.1` as the default local API bind address.
- Keep router control represented by unsupported/mock adapters until legitimate
  Huawei AX2 admin access is available.
- Keep Drizzle schema local and SQLite-oriented; do not add Neon in the MVP.
- Keep Phase 1 discovery Windows-first and read-only: PowerShell neighbor data
  is collected before a bounded ICMP sweep, with private-subnet and concurrency
  guardrails enforced in the platform-independent scanner.
- Keep Phase 2 correlation deterministic and evidence-preserving: MAC is a
  correlation key when available, IP is the fallback, and manual aliases only
  replace the display claim.
- Keep the Dashboard local-first: it reads the agent over loopback-only CORS,
  makes session-only rename/trust changes until persistence is implemented, and
  keeps router blocking visibly unavailable.
- Persist network history in a local SQLite file through the native Node
  SQLite API. Discovery writes device snapshots, evidence, and activity events
  in one transaction; `/history` exposes only the local timeline.
