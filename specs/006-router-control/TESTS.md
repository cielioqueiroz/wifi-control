# Tests

- Missing confirmation is rejected.
- Gateway, local host, and broadcast targets are rejected.
- Multicast, broadcast, all-zero, all-ones, and malformed MACs are rejected.
- A confirmed unicast target passes pure validation.
- The default adapter still refuses router actions.
- HTTP tests reject foreign origins, rebound hosts, absent session tokens and malformed JSON.
- Router control rejects a changed IP/MAC association before performing I/O.
- Adapter tests verify one payload envelope and read-back after a change.
- Playwright verifies confirmation is disabled until the exact word is typed.
- Actual hardware writes remain untested until local credential setup and selection of a test target.
