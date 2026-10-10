# Voomp Forge — Architecture

Voomp Forge turns delivery data from **any Git platform** into an explorable 3D
data center. The codebase is layered so that data sources, business rules,
the 3D scene, its animations and the HUD can each grow without touching the
others.

Guiding principles: **SRP** (one reason to change per module), **KISS**,
**YAGNI** (build only what the MVP uses), clean, intention-revealing names.

## Layers

```
src/
├─ domain/                 Pure model + business rules. No dependencies.
│  ├─ entities.ts          Provider-agnostic entities (ChangeRequest, PipelineRun…)
│  └─ rules/               Evidence rules: delivery status, CR timeline, activity
├─ application/            Use cases. Depends on domain only.
│  ├─ ports/               DeliveryDataSource — the single door to the outside
│  └─ queries/             Index, filters, KPIs, summaries for squads/repos/people…
├─ infrastructure/         Implements ports. Depends on application + domain.
│  ├─ demo/                Deterministic DEMO DATA
│  └─ remote/              Forge backend client (disabled until backend exists)
├─ config/                 Declarative world config (sector themes, layout knobs)
└─ presentation/           Everything the user sees. Depends on application + domain.
   ├─ state/               Zustand stores (data, filters, selection, settings)
   ├─ world/               Entity registry: data + config → WorldModel (positions). Pure.
   ├─ animation/           Animation system: behaviour scripts + easing. Pure, no meshes.
   ├─ interaction/         Selection, hover and camera intents
   ├─ scene/
   │  ├─ kit/              Reusable 3D building blocks (materials, parts, label textures)
   │  ├─ entities/         Semantic objects: Sector, Rack, Figure, Gate, Flow
   │  └─ stage/            Environment: floor, lights, post-processing, camera rig
   └─ hud/
      ├─ kit/              Reusable UI primitives (Panel, StatusBadge, Kpi, EvidenceLink)
      ├─ panels/           Inspector panel per entity type
      └─ views/            Product View, Delivery Explorer, Table (2D) view, onboarding
```

### Dependency rule

`domain ← application ← { infrastructure, presentation }`

- `domain` imports nothing from the app.
- `application` imports only `domain`.
- `infrastructure` and `presentation` never import each other.
- Inside `presentation`, `world/` and `animation/` are pure TypeScript (no React,
  no Three.js meshes) so they are testable and reusable by any renderer.

`src/architecture.test.ts` enforces these rules on every test run.

Aliases: `@domain/*`, `@application/*`, `@infrastructure/*`, `@presentation/*`, `@config/*`.

## Git-agnostic by design

| Forge term     | GitHub              | GitLab          | Bitbucket        | Azure Repos    |
|----------------|---------------------|-----------------|------------------|----------------|
| ChangeRequest  | Pull request        | Merge request   | Pull request     | Pull request   |
| PipelineRun    | Actions run         | Pipeline        | Pipelines run    | Pipeline run   |
| Deployment     | Deployment          | Deployment      | Deployment       | Environment    |

A snapshot carries `source.provider.vocabulary`, so the HUD shows the native
words ("MR" on GitLab) while every rule and every 3D object stays the same.

The browser never calls a provider API and never holds tokens. Connected mode
will call a Forge backend that owns the provider connectors (read-only, per-user
authorisation, webhooks → PostgreSQL) and returns a `ForgeSnapshot`.
Adding a provider = adding a backend connector. The frontend does not change.

## Data flow

```
DeliveryDataSource.load() ─► ForgeSnapshot ─► buildIndex() ─► queries (filters, KPIs, summaries)
                                                   │
                                                   ├─► world/buildWorld()  ─► WorldModel ─► scene/entities
                                                   │                                     ▲
                                                   │                       animation/ (behaviours per figure/flow)
                                                   └─► hud/ panels & views
```

## Extending

- **New squad / rack:** comes from data. `world/` lays sectors and racks out
  from the snapshot. Visual theme per squad is optional config in `config/world.ts`.
- **New 3D prop:** add a part to `scene/kit`, compose it in an entity.
- **New animation:** add a behaviour in `animation/` (pure, testable), and have
  the entity read its pose.
- **New panel:** compose `hud/kit` primitives in `hud/panels`.
- **New data source:** implement `DeliveryDataSource` in `infrastructure/`.
