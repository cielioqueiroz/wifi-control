# Tests

- Missing confirmation is rejected.
- Gateway, local host, and broadcast targets are rejected.
- Multicast, broadcast, all-zero, all-ones, and malformed MACs are rejected.
- A confirmed unicast target passes pure validation.
- The default adapter still refuses router actions.
