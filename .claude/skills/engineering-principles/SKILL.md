---
name: engineering-principles
description: >
  KISS, YAGNI, SRP, clean boundaries, and guard rails for the Senior Staff agents.
  Harness engineer topics: also load skill harness-engineering (#harness Fowler guia/sensor).
  Also load ~/.cursor/skills/engineering-principles/SKILL.md when available.
evidence_level: curated
last_verified: 2026-09-28
---

# Agents Engineering Principles

Transversal guard rails for the orchestrator (`senior-staff-ai-finops`) and reviewers (`senior-staff-appsec`, `senior-staff-qa`).

## Core

- **KISS** — simplest correct solution; inline until pattern repeats twice
- **YAGNI** — no code for hypothetical futures
- **SRP** — one reason to change per module; split UI from data fetching
- **Reversibility** — can we roll back or split this PR?
- **Boundaries** — domain → API → UI; validate at edges; idempotent webhooks

## Decision checklist

- [ ] Can this be simpler?
- [ ] Solving a real problem today?
- [ ] Each file has one clear responsibility?
- [ ] Can we roll back or split?

If any **no** → REVISE before SHIP.

## Harness engineer (Fowler)

When the change is skills, steerings, agents, or enablement — not product code — load skill **`harness-engineering`** first. Every harness concern needs **guia + sensor**; classify computacional vs inferencial. Do not ship chat-only instructions without a sensor (test, lint, validate, CI).

## VSUS sustentação

- **Minimal change** — fix root cause, smallest diff (Confluence onboarding N3)
- **Payment/webhook** — never skip idempotency review
- **No assumptions** — label hypotheses; cite stacktrace, test, or doc

## References

- Logseq: `pages/Cursor/Skills.md` → engineering-principles
- Confluence: Onboarding Squad Sustentação N3 — minimal-change culture
