# HUD specification

The HUD reproduces the **WareTrack screen arrangement** (see reference shots in
`/home/user/voomp-forge/docs/media/*.jpg` (fork checkout, not copied here — no reuse licence): `shift.jpg`, `inspector.jpg`,
`order-requests.jpg`, `site-select.jpg`), re-skinned in Voomp Forge black/orange
and re-purposed for engineering delivery. Regions are placed by
`src/presentation/hud/HudLayout.tsx` — panels only render their card content.

All copy in **pt-BR**, written for people who don't know Git. Use the
provider vocabulary from `snapshot.source.provider.vocabulary`
(`changeRequestShort` → "PR"/"MR", `changeRequest`, `pipeline`) — never hardcode
"Pull request" / "GitHub".

## Building blocks (do not restyle from scratch)

- `hud/kit/primitives.tsx`: `Card`, `CardHeader`, `Eyebrow`, `SectionLabel`,
  `StatusBadge`, `Chip`, `StatTile`, `IconButton`, `Segmented`, `EmptyState`, `ProgressBar`.
- `hud/kit/Icon.tsx`, `hud/kit/EvidenceLink.tsx` (demo-aware links), `hud/kit/format.ts`.
- `presentation/theme.ts`: `STATUS_LOOK` (per DeliveryStatus), `SIGNAL_LOOK` (per Signal). Status is always icon + text + colour.
- Tailwind 4 tokens from `src/index.css`: `bg-ink-950/900/800/700/600`, `text-snow`, `text-fog`,
  `text-forge`/`bg-forge`, `forge-bright`, `ok`, `fail`, `warn`, `idle`, `unknown`; fonts `font-display`, `font-mono`; utilities `hud-card`, `focus-ring`, `scroll-thin`.
- Typography scale like WareTrack: card titles 13px display semibold; body 12–13px; meta 11px fog; numbers in `font-display`.

## State & data

- `state/dataStore.ts` → `useReadyData()` gives `{ snapshot, index, world }` (components below render only when ready).
- `state/uiStore.ts` → `useUiStore` (period, squad, viewMode, selection, select(ref), trackedCrId, track, overlay, openOverlay, highlightInitiative, reducedMotion, quality, commandCamera…).
- `state/selectors.ts` → `useScope()`, `useKpis()`, `useEvents()`, `useRepoHealth()`.
- Queries in `src/application/queries/*` (`listDeliveries`, `toDelivery`, `squadSummary`, `personSummary`, `initiativeSummary(ies)`, `repositoryHealth`, `STATUS_GROUP`). Call them inside `useMemo`.
- Selecting anything: `select({ kind: 'squad'|'repo'|'person'|'cr'|'initiative', id })`. Closing: `select(null)`.

## Regions

### TopBar (`panels/TopBar.tsx`) — WareTrack top bar
One `hud-card` row, h-[52px], items centered, gap-2, px-3:
1. Logo: small orange forge mark (inline SVG) + "Voomp Forge" (display, bold) + tagline "From Code to Delivery" (11px fog, hidden < xl).
2. Org/squad selector (WareTrack site selector): chip with squad code (e.g. `SQ-A`) + name + sub-line "N repositórios · M pessoas"; native `<select>` styled, options "Todas as squads" + squads → `setSquad`.
3. Source status pill (WareTrack "Shift" pill): `DEMO DATA` warn chip + "Snapshot · sincronizado há X" (relativeTime of `generatedAt` vs real `new Date()`), with a data source `Segmented` [Demo Mode | Conectado] where "Conectado" is disabled with title = RemoteDataSource availability reason.
4. Period `Segmented` 7d / 14d / 30d (WareTrack speed control) → `setPeriod`.
5. View toggle (WareTrack Town/Build buttons): "Product View" / "Engineering View" → `setViewMode`.
6. Global search (input, `/` shortcut focuses it): searches repos, change requests (title/#number), people, initiatives, squads; dropdown results (max 8) with icon + kind; Enter/click → `select(ref)`. Keyboard navigable (arrow keys).
7. Bell `IconButton` with count badge = repos with `alert` (from `useRepoHealth`); popover lists them; click → select repo.
8. Settings `IconButton` → popover: "Movimento reduzido" toggle, "Qualidade gráfica" Alta/Leve, "Rever boas-vindas" (openOverlay('welcome')), "Visão tabular" (openOverlay('table')).
9. Primary CTA (WareTrack "Call truck"): orange button "Delivery Explorer" → openOverlay('explorer').
Hide lower-priority items progressively on smaller widths (tagline, source pill text, search becomes icon) — never overflow horizontally.

### KpiStrip (`panels/KpiStrip.tsx`) — WareTrack KPI cards
Row of 5 small `hud-card`s (w-[168px], px-3 py-2, horizontal scroll on small screens): icon tile left (rounded-lg bg-white/5), label 11px, value display 22px, hint 11px fog.
`useKpis()`: "PRs integrados" (merged), "Aguardando revisão" (awaitingReview), "Falhas de pipeline" (pipelineFailures, red when > 0), "Deploys em produção" (productionDeploys, green), "Entregas c/ iniciativa" (initiativeDeliveries). Hint "últimos N dias" + squad name if filtered. Use vocabulary for "PRs". Animate value change (brief orange flash) for filter feedback. Each card has a `title` tooltip explaining the metric in plain language (e.g. "Integrado ≠ em produção").

### LeftColumn (`panels/LeftColumn.tsx`) — WareTrack Shift goals / Missions / Actions
Flex column gap-3, scroll-thin overflow-auto, three cards:
1. **Product View → "Perguntas da semana"** (WareTrack Shift goals): list of business questions, each row = question + count on the right; click applies the answer: opens Delivery Explorer pre-filtered OR selects. Questions:
   "O que chegou em produção?" (status production), "O que ainda não chegou à produção?" (staging+integrated), "O que aguarda revisão?" (review), "Há bloqueios técnicos?" (blocked), "Mudanças sem iniciativa identificada" (initiative none). Use `listDeliveries`. Pass prefilter to the explorer via a tiny exported zustand store in `views/DeliveryExplorer.tsx` (e.g. `useExplorerFilters`) — keep it simple.
   In **Engineering View** this card becomes "Saúde técnica": repos with failing pipeline, blocked CRs, repos without pipeline data, idle repos (from `useRepoHealth`), each clickable → select repo.
2. **Iniciativas** (WareTrack Missions): each initiative row: key chip + name, mini progress bar = inProduction / total deliveries, sub-line headline from `initiativeSummary`. Click → `select({kind:'initiative'})` (store also highlights racks). Selected row has orange left border.
3. **Modo** (WareTrack Actions): segmented Product/Engineering + 1-line explanation of what each mode shows, and a disclaimer: "Personagens são ilustrativos: não indicam presença, carga ou produtividade."

### Inspector (`panels/Inspector.tsx`) — WareTrack inspector (top-right)
`Card` max-h-full overflow-auto scroll-thin. Header like WareTrack: icon tile (40px rounded-xl bg-forge/15 text-forge) + Eyebrow (entity type · code) + title (display 18px) + subline; header buttons: "Centralizar" (`commandCamera({type:'focus', ref})`) and close (`select(null)`); Esc closes. Below: status chips row, 2×2 `StatTile` grid, then lists with `SectionLabel`. Variants by `selection.kind`:
- **squad** (Interaction A): name, description, repos (clickable rows with health signal badge), KPIs tiles (merged, open, awaiting review, pipeline failures, production deploys), "Entregas recentes" list (clickable → cr).
- **repo** (Interaction B): name, description, default branch (`branch` icon), language, health modules (4 rows: signal badge + label), "Últimos commits" (5; message, author, relative time, short sha; Engineering View shows sha), "Mudanças recentes" (CRs with StatusBadge, click → cr), pipeline status + last run link, "Último deploy" (env, status, time, EvidenceLink), EvidenceLink "Abrir repositório".
- **person** (Interaction C): name, handle, role only if not null (else "Função não informada"), squad, "Mudanças de autoria", "Revisões realizadas" (count of reviews as a list, not a score), "Participação em entregas em produção". Fixed disclaimer: no ranking / presence / productivity. Never show numeric scores.
- **cr** (Interaction D): "#number title", repo, author, initiative (or "Iniciativa não identificada"), productSummary (or "Sem resumo para Produto"), StatusBadge, **vertical timeline** of the 6 stages (`toDelivery().stages`): done = orange/green check with date; blocked = red alert with note; pending = hollow grey circle with note "Sem evidência ainda"; not_applicable = dashed. Engineering View adds head sha, target branch, reviews list, pipeline runs on head, deployments with env/status/sha. EvidenceLink to the CR. Button "Acompanhar" → `track(id)`.
- **initiative**: key, name, summary, headline (plain language), counts tiles (em produção / aguardando produção / em revisão / bloqueadas), repos involved (click → repo), deliveries grouped by status group. If no deliveries: EmptyState.
Unknown/missing ids → EmptyState "Item não encontrado nos dados atuais".

### MapControls (`panels/MapControls.tsx`) — WareTrack zoom stack
Vertical `hud-card` p-1 with `IconButton`s: plus (`commandCamera({type:'zoom', factor:1.25})`), minus (0.8), rotate (`{type:'rotate', radians: Math.PI/8}`), compass/home → `{type:'overview'}` + `setSquad(null)` NOT required (just overview), and table icon → openOverlay('table').

### ActivityTabs (`panels/ActivityTabs.tsx`) — WareTrack Orders/Docks/Forklifts/Trucks
Card with tab header (counts after each label, active tab underlined orange): **Entregas** (merged/staging/production deliveries in scope), **Revisões** (awaiting review / changes requested), **Pipelines** (runs in period, newest first, status badge), **Deploys** (deployments in period: env + status + repo). Rows like WareTrack queue rows: index/icon square, title + 11px subline, right aligned action chip ("Ver", "Acompanhar"). Click → select. Empty tab → EmptyState with friendly copy. Respect scope (period + squad).

### DeliveryTracking (`panels/DeliveryTracking.tsx`) — WareTrack Shipment tracking
Card, two columns. Left: header "Delivery tracking" + current CR ref (`#N · repo`), Segmented [Em andamento | Entregues] that picks which list the "‹ ›" arrows cycle through; **horizontal stepper** of the 6 stages (circles 26px: done = filled orange w/ check (production done = green), blocked = red ring w/ alert, pending = hollow); label under each (Aberto, Em revisão, Aprovado, Integrado, Deploy, Produção) + date/“—”. Right: detail card: "#N title", repo → env, StatusBadge, initiative line, link "Ver no mapa →" (`select({kind:'repo', id})`) and "Detalhes" (`select({kind:'cr'})`). Uses `trackedCrId`; when null, default to the most recent delivery in production in scope. Empty → EmptyState.

### Legend (`views/Legend.tsx`) — footer legend
Small `hud-card` pill row: each `SIGNAL_LOOK` entry as icon + label (11px), plus a "Visão tabular" button (openOverlay('table')).

### DeliveryExplorer (`views/DeliveryExplorer.tsx`) — overlay (Interaction E)
Modal like WareTrack site-select (centered, max-w-5xl, h-[86vh], backdrop blur, Esc/close button, focus trap-lite: focus first control on open). Header: title "Delivery Explorer", subtitle, DEMO DATA chip. Filter bar: squad, repo (filtered by squad), period, status group (production/staging/integrated/review/blocked/draft/closed in pt-BR), initiative (incl. "Sem iniciativa identificada" = 'none'), environment (staging/production), text search. Results count. Results as cards (grid 1–2 cols): StatusBadge, "#N" + plain-language title (productSummary ?? title), origin line (squad · repo · author), initiative chip or "Iniciativa não identificada", evidence row: stage mini-stepper + EvidenceLinks (CR, deployments). Click card → select cr + close overlay. Export `useExplorerFilters` (zustand) with `open(prefilter)` helper used by LeftColumn.

### TableView (`views/TableView.tsx`) — accessible 2D view
Props `{ embedded?: boolean; notice?: string }`. As overlay (not embedded): full-screen modal; embedded: fills parent with its own minimal header (logo + DEMO DATA) since there is no TopBar. Tabs: Squads, Repositórios, Entregas, Pessoas, Iniciativas. Semantic `<table>` with `<caption>`, `<th scope>`, sortable columns (button in th, aria-sort), same period + squad filters (Segmented + select at top, wired to uiStore). Status cells use StatusBadge. Row "Abrir" button → select + close overlay (when not embedded). Keyboard accessible. Responsive: horizontal scroll inside the table container.

### WelcomeModal (`views/WelcomeModal.tsx`) — WareTrack site-select + training
Centered modal like `site-select.jpg`: title "Voomp Forge", subtitle "From Code to Delivery — veja o que as squads constroem, integram e entregam.", DEMO DATA notice ("Dados fictícios de demonstração. Nenhum dado real da Voomp."). Highlight box "Primeira vez aqui? Faça o tour guiado" + orange button "Iniciar tour" → `setTourStep(0)` + close. Grid of squad cards (code chip `SQ-A`, name, description, chips "N repositórios", "N pessoas", health mini badge) → click: setSquad + close. Bottom two boxes: "Como ler o data center" (setor = squad, rack = repositório, personagem = pessoa (ilustrativo), fluxo de luz = evento, portão = produção confirmada) and "Integrado ≠ Em produção" explanation.
**Guided tour** (same file, exported `TourCoach` component rendered by WelcomeModal module? No — render it from HudLayout is not allowed for you; instead export `TourCoach` and the main agent will mount it). Steps (tourStep 0..5): 1 data center overview (commandCamera overview), 2 highlight a squad (setSquad('sq-admin')), 3 select a rack (select repo `repo-admin-console-web`), 4 open CR history (select cr = most recent CR of that repo), 5 a delivery confirmed in production (select a cr with status in_production), 6 Product View (setViewMode('product'), select(null), highlight first initiative). Coach card bottom-center: step n/6, title, 1–2 sentences, buttons "Pular tour" / "Voltar" / "Próximo" (last: "Concluir"). Esc ends the tour.
