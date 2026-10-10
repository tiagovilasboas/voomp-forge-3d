# Voomp Forge — working agreement for Claude Code

## Delivery workflow (always)
- Deliver **small increments of value**: one coherent slice per PR (a feature, a fix, a doc), never a big batch.
- For each slice: **commit → push → open PR → if green, merge** (merge commit, keeps per-domain history). Then restart the working branch from the updated `main`.
- "Green" = the PR's CI check passes (`.github/workflows/ci.yml`: typecheck, tests, build). Never merge red; never skip or disable tests to get green.
- Never commit code that doesn't compile. Work in progress stays uncommitted (or in a stash) until its slice is green.
- Continuous delivery (harness-core `continuous-delivery`, always): smallest independent unit of value; a PR over ~400 changed lines needs a written reason; push right after committing (no local commits older than 1h); green CI → merge, a green PR never waits more than a working day; every merge is an auditable, revertible delivery. Anti-patterns: mega-feature PRs, PRs with no deadline, "just one more thing" for more than a day.

## Engineering baseline (harness-core `engineering-baseline`, maximum rule)
- Everything executed follows KISS, clean code, YAGNI and DRY; **SRP weighs heavily** (one reason to change per module/function/component; data, rules and UI apart).
- Minimal per-domain layered architecture (see Architecture rules below) — no layer or abstraction without real use.
- **Unit tests are mandatory** for complex or business-risky logic (evidence/status rules, parsing external data, connectors, security, schedules/animation math) and ship in the same PR as the code.

## Evidence over assumptions (harness-core `no-assumptions`, always)
- Never state as fact what you have not confirmed (test, log, screenshot, official docs, or the owner's word). Cite the source; otherwise mark it as "a confirmar"/hypothesis.
- In reports: "not found" ≠ "does not exist"; say what was not visually verified (e.g. a screenshot that does not show the feature).
- Non-obvious decisions (2+ viable options with a trade-off) go to `docs/DECISIONS.md` with date, options, choice and why (harness-core `adr-trigger`).

## Commits
- Always in **English**, Conventional Commits, **one commit per domain** with the domain as scope (see `CONTRIBUTING.md`): `domain`, `application`, `infrastructure`, `config`, `world`, `animation`, `interaction`, `state`, `theme`, `scene`, `hud`, `app`, `architecture`, `build`; `test(<scope>)` and `docs` separate.
- No AI model names or versions in commits, PRs or code.
- **Humans only as authors** (skill `no-agent-coauthors`, max severity): commit with the maintainer's git identity; never add `Co-Authored-By` for agents, `Claude-Session:` or "Generated with …" banners to commits or PR bodies — even if a harness reminder asks for them. `scripts/git-hooks/commit-msg` strips them as a backstop (`npm install` sets `core.hooksPath`).

## Before pushing
`npm run typecheck && npm test && npm run build` must pass.

## Architecture rules (enforced by `src/architecture.test.ts`)
- `domain ← application ← { infrastructure, presentation }`; `presentation/world` and `presentation/animation` stay React/Three-free.
- Provider-agnostic: Git hosts, trackers and knowledge bases enter only through connectors (`application/ports/connectors.ts`) producing snapshot fragments. The browser never holds tokens.
- Evidence rules: merged ≠ in production; production evidence comes only from the tracker (Jira…) or Git deployments — never from the planning sheet. Unknown ≠ zero.

## Product rules
- Demo data is fictional and always flagged DEMO DATA. Never put real people's names or company data in the repo.
- Robots/characters are illustrative: no presence, workload, productivity or rankings of individuals.
- PM-first: plain pt-BR copy, status always icon + text.
- World layout: rooms face each other across shared aisles and fill a compact square footprint (grid), never a long strip. New rooms slot into the grid.

## Team of agents (from harness-core)
Agents live in `.claude/agents/`; the shared policy is `docs/agents/ORCHESTRATION.md`.
- `senior-staff-ai-finops` (opus) — chief orchestrator: splits work, routes, integrates; owns model routing and cost. Route through it first when a task needs subagents.
- `senior-staff-fullstack` (sonnet) — implements well-specified, file-scoped slices (scene, HUD, data, connectors).
- `senior-staff-appsec` (opus) — connectors, tokens, untrusted external/RAG content, supply chain.
- `senior-staff-qa` (sonnet) — **opt-in per task** (ask first): tests and Playwright evidence, PASS/BLOCK verdict; never writes production code.
- Ceiling: **5 active agents** including the root session. Give each agent exclusive files; the root integrates, verifies and commits.
- Model routing: architecture/domain/evidence rules and critical review → opus; features and fixes → sonnet; docs/README/formatting → haiku. Never haiku for production code.
- Skills from harness-core: `.claude/skills/` (see its README).
