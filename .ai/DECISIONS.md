# Decisions

- Use `127.0.0.1` as the default local API bind address.
- Keep router control represented by unsupported/mock adapters until legitimate
  Huawei AX2 admin access is available.
- Keep Drizzle schema local and SQLite-oriented; do not add Neon in the MVP.
- Keep Phase 1 discovery Windows-first and read-only: PowerShell neighbor data
  is collected before a bounded ICMP sweep, with private-subnet and concurrency
  guardrails enforced in the platform-independent scanner.
