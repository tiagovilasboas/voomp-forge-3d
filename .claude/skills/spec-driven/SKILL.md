---
name: spec-driven
description: >
  Spec-driven development for large features — requirements, design, tasks before implementation.
  Primarily for senior-staff-ai-finops on cross-cutting work. Also load ~/.cursor/skills/spec-driven/SKILL.md.
evidence_level: curated
last_verified: 2026-09-28
---

# Agents Spec-Driven

## When to use

- New feature touching >1 module
- Cross-squad architectural change
- Refactor needing explicit non-goals

**Skip for:** known VSUS hotfixes — use `voomp-investigate` instead.

## Artifacts

```
.cursor/specs/<feature>/
  requirements.md
  design.md
  tasks.md
```

## Flow

1. Requirements — user-visible behavior, constraints
2. Design — options, recommendation, risks
3. Tasks — ordered, delegatable to the Senior Staff agents
4. Execute via `senior-staff-ai-finops`, which assigns `senior-staff-fullstack`, `senior-staff-appsec`, or `senior-staff-qa`

## References

- Logseq: `pages/Cursor/Skills.md` → spec-driven
- KIRO-CURATION: incident-analysis vs spec-driven boundary

Respond in **Portuguese (pt-BR)**.
