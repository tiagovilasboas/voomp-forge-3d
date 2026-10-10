# Voomp Forge — Architecture

Voomp Forge turns delivery data from any Git platform, trackers and planning
sheets into an explorable 3D data center. The app is a static PWA: it never
calls a provider API and never holds tokens. Data arrives as a validated
snapshot (`ForgeSnapshot`), produced ahead of time by connectors.

Guiding principles: **SRP** (one reason to change per module), **KISS**,
**YAGNI** (build only what the current release uses), intention-revealing names.

## 1. Layers

```
src/
├─ domain/                  Pure model and evidence rules. No dependencies.
│  ├─ entities.ts           Provider-agnostic entities and snapshot shape
│  └─ rules/                changeRequestProgress.ts, workstreamProgress.ts
├─ application/             Use cases. Depends on domain only.
│  ├─ ports/                DeliveryDataSource, connectors (Connector, SnapshotFragment),
│  │                        KnowledgeRetriever
│  ├─ contracts/            mergeFragments (fragments → snapshot), parseSnapshot (validation)
│  └─ queries/              Index, filters, KPIs, summaries, calendar, fronts, events
├─ infrastructure/          Implements ports. Depends on application and domain.
│  ├─ connectors/           git-local, jira, plan-csv, confluence + registry + config
│  ├─ git/                  Pure ingestion rules (commit messages, tags, work items)
│  ├─ demo/                 Deterministic, fictional DEMO DATA
│  ├─ file/                 Imported snapshot (?snapshot=<url>)
│  └─ remote/               Connected mode stub (disabled until a backend exists)
├─ config/                  Declarative world config (sector themes, layout constants)
└─ presentation/            What the user sees. Depends on application, domain, config.
   ├─ world/                Pure: squads/repos/people → WorldModel (grid, frames, focus)
   ├─ animation/            Pure: behaviour scripts, rig poses, quirks, expressions, NPC
   ├─ interaction/          Pointer wiring, live positions registry
   ├─ state/                Zustand stores (data, UI, notes) and selectors
   ├─ scene/                React Three Fiber
   │  ├─ kit/               Materials, parts, canvas textures, orientation (SIGN_YAW)
   │  ├─ entities/          Sector, Rack, Robot, Hub IA, Gate, Walls, Desk, Flow…
   │  ├─ holo/              Holographic panels and repository holograms
   │  └─ stage/             Environment, camera rig, post-processing
   ├─ hud/                  React HUD
   │  ├─ layouts/           PhoneHud, TabletHud, DesktopHud (chosen by breakpoint)
   │  ├─ panels/            Top bar, KPIs, left column, inspector, tracking
   │  ├─ views/             Delivery Explorer, table view, welcome, tour
   │  ├─ objects/           Object Screens (hub, terminal, pinball, automation, boards…)
   │  ├─ fronts/            Mural de Frentes (board, roadmap, allocation) and calendar
   │  ├─ mobile/            Bottom navigation, sheets, search, "more" menu
   │  └─ kit/               Primitives, icons, focus helpers, media queries
   └─ theme.ts              Palette, status and signal looks, icon names
tools/ingest/cli.ts         `npm run ingest`: composition root of the snapshot pipeline
src/App.tsx, src/main.tsx   Composition root of the app: source selection, WebGL check
```

### Dependency rule

`domain ← application ← { infrastructure, presentation }`, and `config` may be
imported by `presentation` (and by `config` itself).

| Layer | May import |
|-------|------------|
| `domain` | `domain` |
| `application` | `application`, `domain` |
| `infrastructure` | `infrastructure`, `application`, `domain` |
| `config` | `config`, `domain` |
| `presentation` | `presentation`, `application`, `domain`, `config` |

- `infrastructure` and `presentation` never import each other.
- `presentation/world` and `presentation/animation` import neither React nor Three.js,
  so they are testable and reusable by any renderer.
- `src/architecture.test.ts` enforces both rules on every test run.

Aliases: `@domain/*`, `@application/*`, `@infrastructure/*`, `@presentation/*`, `@config/*`.

## 2. Data flow

Two sources feed the same pipeline. The demo runs in the browser; a snapshot is
built ahead of time from connectors.

```
  Git repos ──┐                                   (run where the credentials live:
  Jira ───────┤  connectors                        CLI job, n8n, or a backend)
  plan CSV ───┤  collect(ctx) → SnapshotFragment
  Confluence ─┘        │
                       ▼
            mergeFragments()  →  parseSnapshot()  →  snapshot.json (static hosting)
                                                          │
  DemoDataSource ─────────────┐                           │  ?snapshot=<url>
                              ▼                           ▼
                  DeliveryDataSource.load()  ◄── SnapshotFileDataSource
                              │  ForgeSnapshot
                              ▼
                  dataStore: buildIndex() + buildWorld()
                       │                         │
                       ▼                         ▼
          application queries              presentation/world
          (KPIs, deliveries, fronts,       (WorldModel: rooms, racks,
           repository health, summaries)    figures, plaza, bounds)
                       │                         │
                       ▼                         ▼
               hud/ panels and views      scene/ entities ◄── animation/
                                          (scripts sampled per frame)
```

- The app never queries Git, Jira or Confluence at runtime. Freshness equals the
  snapshot cadence (daily by default; see [INGESTION.md](INGESTION.md)).
- `RemoteDataSource` ("Conectado") is a stub: `availability()` reports the reason,
  `load()` throws. A future backend will return the same `ForgeSnapshot`.

## 3. Ports and connectors

`application/ports/connectors.ts` defines plug-and-play ingestion:

- A **connector** has a `type` (registry key, e.g. `git-local`), a `kind`
  (`vcs`, `tracker`, `plan`, `knowledge`, `deploy`, `ci`) and
  `collect(ctx): Promise<SnapshotFragment>`.
- A **fragment** is a partial snapshot: any subset of squads, repositories,
  change requests, reviews, commits, pipelines, deployments, initiatives,
  documents, work items, workstreams and capability levels.
- `ConnectorContext` gives `now`, `since`, a `secret(name)` reader (environment
  variables) and `log`. Connectors never log secrets.

| Connector | Source | Contributes | Secrets (env vars) |
|-----------|--------|-------------|--------------------|
| `git-local` | Local clones (`git log --all`, tags) | Repositories, inferred change requests from merge commits, commits, deployments from tags | none |
| `jira` | Jira REST search | Work items with status, epic, sprint and production date | `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| `plan-csv` | Planning sheet exported as CSV | Workstreams (fronts), plans, declarations | none |
| `confluence` | Confluence REST | Knowledge documents linked by label | `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN` (falls back to the Jira pair) |

Composition:

- `infrastructure/connectors/registry.ts` maps connector types to factories.
  Dependencies (`runGit`, `fetchJson`, `readText`) are injected, so tests use fakes.
- `infrastructure/connectors/config.ts` turns `forge.config.json` into connector
  blocks. Shared keys (organization, provider, people) are inherited.
- `application/contracts/mergeFragments.ts` is pure: later fragments win on id
  conflicts, capability levels keep the best value (`native` > `inferred` >
  `unavailable`), and organization and provider come from the first fragment that has them.
- `application/contracts/parseSnapshot.ts` validates the result before it is written
  or loaded, so the UI never receives an unchecked shape.

## 4. Domain model and evidence rules

Entities are provider-agnostic (`ChangeRequest`, `PipelineRun`, `Deployment`,
`WorkItem`, `Workstream`…). The provider's vocabulary ("PR", "MR", "Merge") comes
from `source.provider.vocabulary`, so the HUD speaks the native language and
the rules do not change.

Evidence rules are the core product rule: **merged is not in production**, and
**unknown is not zero**.

- `domain/rules/changeRequestProgress.ts`: a change reaches `in_production` only
  through a successful production deployment that contains it. Running or failed
  deployments never count as complete. The latest review per reviewer wins;
  plain comments do not overturn a verdict.
- `domain/rules/workstreamProgress.ts`: a front (workstream) is `delivered` only
  with production evidence from the tracker or from Git, and only when the
  sources agree. The planning sheet can declare "Finalizado", which sets
  `declaredWithoutEvidence` and never proves production. Disagreement between
  Jira and Git sets `divergence`.
- Deployments link to changes through `changeRequestIds`, which holds only changes
  proven to be contained in the deployed SHA. Date proximity is never evidence.
  The git-local connector derives this from tag ranges (merged up to the tag, not
  included in the previous tag of the same environment); see [INGESTION.md](INGESTION.md).

## 5. World: square grid, frames and signage

Layout is computed from data by `presentation/world/buildWorld.ts`. Adding a
squad or repository adds a room or rack without touching scene code. Constants
live in `config/world.ts` (`LAYOUT`).

### Two facing rows around a central corridor

```
          north row (facing +z)   [ Hub IA ] [ squad ] [ squad ] ...
   ─────────────────────────────────────────────────────────────────
    corridor (z = corridorZ, width 8): production plaza
      staging dock · gate · week board · credit plaque · fronts wall · calendar wall
   ─────────────────────────────────────────────────────────────────
          south row (facing −z)   [ squad ] [ squad ] ...
```

- The **Hub IA** is always in the north row. Squad rooms are split into the two
  rows by width, so both rows stay similar in length. Rooms in each row keep
  the order of the data.
- Plaza objects sit at fixed x offsets along the corridor (`buildWorld.ts`):
  staging dock, gate, week board, credit plaque, fronts wall and calendar wall.
- `bounds` covers the rooms and the plaza plus a margin. The camera overview and
  movement limits use it.
- Each room has an `exitX` (where people leave toward the corridor) and a `laneZ`
  (the scooter lane of its row in the corridor).

### Frames

`presentation/world/frame.ts` maps room-local coordinates (front toward +z) to
world coordinates:

- `toWorld(center, facing, local)`: a point in the room's frame → world `[x, z]`.
  For `facing = -1` (south row) the room is turned 180°. The mapping is its own inverse.
- `yawFor(facing)`: group rotation (`0` or `π`) for the same room.

All positions in `WorldModel` (racks, desks, boards, Hub objects) are world
coordinates, so focus targets and walking paths use one coordinate system.

### Signage

Flat signage (holo panels, walls, boards, plaques) uses `SIGN_YAW` from
`scene/kit/orientation.ts` (currently `0`). It faces +z, the side the isometric
camera looks from, and does not follow the room's facing. Signs therefore read
correctly from the default view, in both rows.

### Focus

`focusFor(world, ref)` returns the camera target for an entity: squad, repo,
person, desk, board, gate, Hub objects, walls and workstream. `overviewFocus`
frames the whole `bounds` for the isometric projection.

## 6. Animation system

`presentation/animation/` is pure TypeScript: it returns data, never meshes.

- **Scripts** (`script.ts`): a `Script` is a list of `Step`s (`walk` to a point,
  or an action with a duration and a `face` target). `compile()` precomputes
  segments; `sample(compiled, time)` is a pure function of time. Each figure has
  a deterministic phase offset so no two move in sync.
- **Behaviour** (`behaviour.ts`): `planBehaviour(figure, facts, world)` builds a
  person's script from where they worked in the period (authored or reviewed
  repositories, front or tech-lead roles, recent production participation). It
  reflects where work happened, never presence, workload or performance.
- **Production rides** (`rideToGate`): the person who triggered a production
  deployment rides a holographic scooter from their room, along the lane, to the
  gate. A running deploy shows the ride as "deploying"; a successful one within
  48 hours shows "celebrating". Unknown trigger, or a failed deploy: no ride.
- **Rig and expressions** (`rig.ts`, `expression.ts`): `rigPose(action, elapsed,
  time)` gives joint angles; expressions derive from the action and a quirk.
- **Quirks** (`quirks.ts`): occasional stumble, glitch, sigh or cheer, chosen
  deterministically per person and time.
- **Forge Bot** (`npc.ts`): `planNpcPatrol(hub)` is an NPC, not a contributor. It
  inspects the n8n desk, then loops around the hub and returns. Every waypoint stays in the hub.

The scene (`scene/entities/FigureEntity.tsx`, `NpcBot.tsx`) only reads the pose
for each frame and publishes live positions through `interaction/livePositions`,
which the camera uses to follow a person.

## 7. Object Screen pattern

Some 3D objects open a readable, flat version of themselves instead of the inspector.

```
3D click ──► uiStore.select(ref) ──► camera focusFor(ref) (zooms to the object)
                  │
                  ▼
        ObjectScreenHost: isObjectRef(ref)?  ──► <XxxScreen />  (built on ObjectScreen)
                  │
Close (×, Esc) ──► select(null) ──► camera returns to the saved view
```

- `hud/objects/objectRefs.ts` lists the refs that open as Object Screens:
  whiteboard, board, desk, hub, terminal, pinball, automation, fronts, calendar and
  workstream. Other selections (squad, repo, person, change, initiative, gate,
  document) use the inspector.
- `ObjectScreen` is the shared shell: a centred holographic panel that zooms in
  from the screen centre, full-screen on phones, with `Esc` to close. Inline
  editors opt out of Esc with `data-no-esc-close`.
- `ObjectScreenHost` is the only switch from ref to screen. Adding an object means:
  add a ref kind, a focus target in `focusFor`, a screen component, and a case in the host.

## 8. Layout tiers

`useBreakpoint()` picks one HUD arrangement; the 3D scene and overlays are shared.

| Tier | Width | Layout |
|------|-------|--------|
| Phone | < 768 px | `PhoneHud`: compact top bar, KPI carousel, bottom navigation, bottom sheets |
| Tablet | 768–1279 px | `TabletHud`: left column in a drawer (docked in landscape ≥ 1024 px), inspector panel |
| Desktop | ≥ 1280 px | `DesktopHud`: the full WareTrack-style arrangement |

Quality starts at "low" below 760 px wide and can be lowered further by a performance monitor.
Details are in [RESPONSIVE_SPEC.md](RESPONSIVE_SPEC.md).

## 9. State

- `state/dataStore.ts`: load status, snapshot, derived `index` and `world`, the
  active source and the registered sources. Load errors show a screen with a
  "back to Demo" action.
- `state/uiStore.ts`: selection, hover, squad, period, view mode, overlays, tour
  step, camera commands (with a nonce so repeated commands run), motion and quality.
  It never holds domain data.
- `state/notesStore.ts`: whiteboard notes, stored locally in the browser.
- `state/selectors.ts`: joins the two stores (`useScope`, `useKpis`, `useEvents`,
  `useRepoHealth`, `useFigureScripts`).

`localStorage` is used only for per-browser conveniences: the welcome flag, the
whiteboard notes and the pinball best score.

## 10. Git-agnostic vocabulary

| Forge term    | GitHub       | GitLab        | Bitbucket      | Azure Repos   |
|---------------|--------------|---------------|----------------|---------------|
| ChangeRequest | Pull request | Merge request | Pull request   | Pull request  |
| PipelineRun   | Actions run  | Pipeline      | Pipelines run  | Pipeline run  |
| Deployment    | Deployment   | Deployment    | Deployment     | Environment   |

The browser shows the provider's words, while every rule and 3D object stays
the same. The git-local connector infers change requests from merge commits of
GitHub, GitLab, Bitbucket and Azure DevOps.

## 11. Extending

- **New squad or repository:** comes from data. `buildWorld` places it.
- **New connector:** implement `Connector` in `infrastructure/connectors/`,
  register it in `registry.ts`, add a test with fake IO. The UI does not change.
- **New data source:** implement `DeliveryDataSource` in `infrastructure/`.
- **New 3D prop:** add a part to `scene/kit`, compose it in an entity.
- **New animation:** add a pure behaviour in `animation/`, and let the entity read its pose.
- **New panel or screen:** compose `hud/kit` primitives. For an interactive 3D
  object, follow the Object Screen pattern (section 7).
- **Decisions:** record non-obvious trade-offs in [DECISIONS.md](DECISIONS.md).
