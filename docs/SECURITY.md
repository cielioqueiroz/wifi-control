# Security

## Local API

- Bind to `127.0.0.1` by default.
- Do not expose the API to the LAN by default.
- Reject foreign Origin/Host headers on the server. Allow only the dashboard on port 3001.
- Require a random process-session token for all POST requests, including local metadata changes.
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
the frontend. `scripts/configure-router.ps1` stores a PSCredential protected by
Windows DPAPI for the current user, outside the repository in LocalAppData.

The router configuration may contain only a non-secret credential reference,
such as a Windows Credential Manager target name. It must never contain the
router password itself. The agent reads that credential on demand through a
fixed PowerShell command. Runtime environment credentials remain supported for
development; never save them in `.env`, SQLite, shell history or source control.

## Router Control

Blocking protects the gateway, current host, broadcast addresses, invalid
addresses, and accidental bulk actions. It requires the exact confirmation
`BLOQUEAR` or `DESBLOQUEAR` and records the request and result in the audit
history.
The agent derives the target from persisted observations and verifies its
current IP/MAC association with the router. Local interface MACs and gateway
neighbors are protected. Actions are serialized and success requires read-back
from both bands. Unknown firmware responses are failures, not success.

## Privacy

MAC addresses, IPs, hostnames, and device evidence are private LAN data. Do not
send them to external services without explicit consent.
