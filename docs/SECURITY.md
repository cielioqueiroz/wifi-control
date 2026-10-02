# Security

## Local API

- Bind to `127.0.0.1` by default.
- Do not expose the API to the LAN by default.
- Keep CORS restricted to the local web origins when HTTP endpoints are
  expanded.
- Validate inputs with Zod.
- Limit payload size and return safe error messages.

## Shell

Prefer Node APIs. If shell execution becomes necessary:

- use fixed commands;
- pass arguments as arrays;
- avoid `shell: true`;
- apply allowlists;
- set timeouts;
- limit output;
- never concatenate user input into commands.

## Credentials

Never save router passwords in SQLite, commit them, log them, or return them to
the frontend. Future Windows storage should use Credential Manager, DPAPI, or an
equivalent secure store.

The router configuration may contain only a non-secret credential reference,
such as a Windows Credential Manager target name. It must never contain the
router password itself. The current local adapter accepts credentials only as
process environment values for development and operations; set them at process
start and never save them in `.env`, SQLite, shell history, or source control.

## Router Control

Blocking protects the gateway, current host, broadcast addresses, invalid
addresses, and accidental bulk actions. It requires the exact confirmation
`BLOQUEAR` or `DESBLOQUEAR` and records the request and result in the audit
history.

## Privacy

MAC addresses, IPs, hostnames, and device evidence are private LAN data. Do not
send them to external services without explicit consent.
