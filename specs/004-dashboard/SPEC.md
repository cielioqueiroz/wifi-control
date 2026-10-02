# Spec 004: Dashboard

## Objective

Provide the first operational UI for network and device visibility.

## Requirements

- Overview metrics.
- Device table.
- Device details drawer.
- Rename and trust actions.
- Disabled router block control with clear explanation.

## Acceptance Criteria

- UI handles loading, empty, degraded, error, and offline states.
- Layout remains usable on desktop and smaller screens.

## Phase 3 implementation boundary

The Dashboard consumes the local agent directly and keeps rename/trust changes
in the current browser session. SQLite persistence, history, and router actions
remain separate phases so the UI never implies that unavailable control exists.
