# Tasks — next phase (after v0.1.0)

Backlog captured from the v0.1.0 QA/UX pass. Each item is a small, independently shippable slice (commit → PR → merge when green). Screenshot names refer to the QA capture set (not committed).

| Priority | Item | Set | Spec |
|---|---|---|---|
| P1 | B1 — Ground plane with fading square grid + fog | B (stage) | [UX-REVIEW](UX-REVIEW.md) |
| P1 | B2 — Lighting balance (hub vs. sectors) | B (stage) | [UX-REVIEW](UX-REVIEW.md) |
| P1 | A1 — Holo-glass racks | A (entities/holo) | [UX-REVIEW](UX-REVIEW.md) |
| P1 | A2 — Aggregate-data props in sector rear halves | A (entities) | [UX-REVIEW](UX-REVIEW.md) |
| ✅ | B3 — Overview camera fits the free viewport | B (stage) | merged 2026-10-10 PR #25 |
| ✅ | A3 — Holo-style ProductionGate and WeekBoard | A | merged 2026-10-10 PR #26 |
| P2 | B4 — Room titles at the room edge, clamp subtitles | B (world) | [UX-REVIEW](UX-REVIEW.md) |
| P2 | A4 — Shared HoloTag | A | [UX-REVIEW](UX-REVIEW.md) |
| P2 | B5 — Plaza lane chevrons + flow legend | B | [UX-REVIEW](UX-REVIEW.md) |
| P2 | Real-time video tour (record locally with GPU; cloud container renders at < 1 fps) | docs | — |
| P2 | Connector follow-ups: mapper field validation, fetch timeout, JQL quoting, Jira search endpoint deprecation, HTTPS note in INGESTION.md | infrastructure | PR #16 |
| P3 | `THREE.Clock` deprecation warning (upstream R3F) | build | — |

Bugs from the QA triage, when present: [BUGS](BUGS.md).

Sets A and B touch disjoint files, so two implementers can work in parallel.
