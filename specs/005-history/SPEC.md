# Spec 005: History

## Objective

Track device presence over time.

## Requirements

- Persist first seen and last seen.
- Record online/offline transitions.
- Show activity timeline.

## Acceptance Criteria

- Repeated observations update `lastSeenAt`.
- Status transitions create activity events.
