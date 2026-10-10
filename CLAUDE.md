# Voomp Forge — working agreement for Claude Code

## Delivery workflow (always)
- Deliver **small increments of value**: one coherent slice per PR (a feature, a fix, a doc), never a big batch.
- For each slice: **commit → push → open PR → if green, merge** (merge commit, keeps per-domain history). Then restart the working branch from the updated `main`.
- "Green" = the PR's CI check passes (`.github/workflows/ci.yml`: typecheck, tests, build). Never merge red; never skip or disable tests to get green.
- Never commit code that doesn't compile. Work in progress stays uncommitted (or in a stash) until its slice is green.

## Commits
- Always in **English**, Conventional Commits, **one commit per domain** with the domain as scope (see `CONTRIBUTING.md`): `domain`, `application`, `infrastructure`, `config`, `world`, `animation`, `interaction`, `state`, `theme`, `scene`, `hud`, `app`, `architecture`, `build`; `test(<scope>)` and `docs` separate.
- No AI model names or versions in commits, PRs or code.

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

## Team of agents
- The main session (strongest model) owns architecture, domain/evidence rules and review.
- Delegate well-specified, file-scoped implementation to faster subagents (e.g. Sonnet for features, Haiku for docs/README); give each agent exclusive files to avoid conflicts and verify their work before committing.
