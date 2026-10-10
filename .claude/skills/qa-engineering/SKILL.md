---
name: qa-engineering
description: >
  QA engineering for senior-staff-qa — go test, Vitest, PHPUnit, Cypress, CI triage.
  Also load ~/.cursor/skills/qa-engineering/SKILL.md when available.
evidence_level: curated
last_verified: 2026-09-28
---

# Agents QA Engineering

## Who uses it

- `senior-staff-qa` — writes and runs strategic tests (opt-in per task, see `agents/ORCHESTRATION.md`)
- CI failure log triage only — Cursor built-in `ci-investigator`

## Commands (agents)

```bash
go test ./...
cd client && bun run test
```

## Principles

- Fix product over weakening tests
- Cover critical paths: ingest, gamestate lifecycle, WebSocket reconcile
- CI red → reproduce locally → root cause → minimal fix

## Voomp repos

- PHPUnit: `seller-greenn-back`
- Cypress/Vitest: checkout Nuxt, admin Vue

## Output

Failure summary + fix recommendation in **Portuguese (pt-BR)**.
