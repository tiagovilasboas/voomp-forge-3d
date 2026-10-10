# Contributing

## Commits

- Commit messages are **always in English**.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) and **one commit per domain**,
  with the domain as scope. Never mix domains in one commit.

```
<type>(<scope>): <imperative summary>
```

| Scope            | Path                                   |
|------------------|----------------------------------------|
| `domain`         | `src/domain/`                          |
| `application`    | `src/application/`                     |
| `infrastructure` | `src/infrastructure/`                  |
| `config`         | `src/config/`                          |
| `world`          | `src/presentation/world/`              |
| `animation`      | `src/presentation/animation/`          |
| `interaction`    | `src/presentation/interaction/`        |
| `state`          | `src/presentation/state/`              |
| `theme`          | `src/presentation/theme.ts`, `src/index.css` |
| `scene`          | `src/presentation/scene/`              |
| `hud`            | `src/presentation/hud/`                |
| `app`            | `src/App.tsx`, `src/main.tsx`          |
| `architecture`   | `src/architecture.test.ts`             |
| `build`          | tooling: Vite, TypeScript, package files |

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`.
Tests go in their own `test(<scope>)` commit. Docs use `docs` (optionally `docs(<scope>)`).

## Before pushing

```bash
npm run typecheck
npm test
npm run build
```

`src/architecture.test.ts` fails the build if a layer imports one it must not
(see `docs/ARCHITECTURE.md`).
