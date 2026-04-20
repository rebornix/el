# DECISIONS.md

## 2026-04-19 — Session/tunnel UX parity is a product contract

### Context
Recent cleanup/migration work regressed startup/session UX details (loading feedback, session row metadata, and role differentiation in rendering).

### Decision
Treat the following as required behavior (not optional polish):
- loading/progress feedback for tunnel/session navigation
- visually distinct user vs assistant rendering
- session list rows include title + folder + provider

### Consequences
- Refactors must preserve these UX contracts.
- Changes to these behaviors require explicit spec updates and review.
