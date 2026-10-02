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

## Router Control

Future blocking must protect the gateway, current host, broadcast addresses,
invalid addresses, and accidental bulk actions. Require confirmation and record
auditable actions.

## Privacy

MAC addresses, IPs, hostnames, and device evidence are private LAN data. Do not
send them to external services without explicit consent.
