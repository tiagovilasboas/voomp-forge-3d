# Voomp Forge — Handoff de engenharia (Etapa C)

Estado: **protótipo front-end com dados de demonstração**. Não há backend, autenticação nem modo conectado. Este documento diz o que existe, como estender e o que vem a seguir. Para camadas e fluxo de dados, veja também [ARCHITECTURE.md](ARCHITECTURE.md); para o design, [DESIGN.md](DESIGN.md).

## 1. Arquitetura de componentes

### Camadas e regra de dependência

```
domain ← application ← { infrastructure, presentation }      config ← domain
```

| Camada | Pode importar | Conteúdo |
|--------|---------------|----------|
| `domain` | `domain` | `entities.ts`, `rules/changeRequestProgress.ts` |
| `application` | `application`, `domain` | Porta `DeliveryDataSource`, queries |
| `infrastructure` | `infrastructure`, `application`, `domain` | `demo/`, `remote/` |
| `config` | `config`, `domain` | `world.ts` (temas, layout) |
| `presentation` | `presentation`, `application`, `domain`, `config` | state, world, animation, interaction, scene, hud, `theme.ts` |

`infrastructure` e `presentation` nunca se importam. `App.tsx` e `main.tsx` (raiz de composição, fora das camadas) escolhem a fonte de dados e montam cena + HUD.

**Enforcement:** `src/architecture.test.ts` varre `src/` (imports relativos e aliases `@domain`, `@application`, `@infrastructure`, `@presentation`, `@config`) e falha se uma camada importa outra fora da tabela acima. Também garante que `presentation/world` e `presentation/animation` não importam `react`, `three` nem `@react-three/*` (puros, testáveis, reutilizáveis por outro renderizador).

### Estrutura de pastas

```
src/
├─ main.tsx · App.tsx           composição: fonte, WebGL check, boas-vindas
├─ index.css                    tokens Tailwind 4, hud-card, focus-ring
├─ architecture.test.ts
├─ domain/
│  ├─ entities.ts
│  └─ rules/changeRequestProgress.ts (+ .test.ts)
├─ application/
│  ├─ ports/DeliveryDataSource.ts
│  └─ queries/  forgeIndex · period · deliveries · events · kpis
│               repositoryHealth · summaries · initiatives (+ queries.test.ts)
├─ infrastructure/
│  ├─ demo/     DemoDataSource · demoSnapshot (+ .test.ts)
│  └─ remote/   RemoteDataSource (desativado)
├─ config/world.ts
└─ presentation/
   ├─ theme.ts                  PALETTE, SIGNAL_LOOK, STATUS_LOOK, IconName
   ├─ state/    dataStore · uiStore · selectors
   ├─ world/    buildWorld · flowPaths · worldModel          (puro)
   ├─ animation/ script · behaviour · rig                    (puro)
   ├─ interaction/ useInteractive · livePositions
   ├─ scene/
   │  ├─ ForgeCanvas.tsx · ForgeScene.tsx
   │  ├─ entities/  SectorEntity · RackEntity · FigureEntity · FlowStreams · ProductionGate · props
   │  ├─ kit/       Part · materials · canvasTexture
   │  └─ stage/     Environment · CameraRig · Effects
   └─ hud/
      ├─ HudLayout.tsx
      ├─ kit/      primitives · Icon · EvidenceLink · format
      ├─ panels/   TopBar · KpiStrip · LeftColumn · Inspector · MapControls
      │            ActivityTabs · DeliveryTracking · HoverTooltip
      │            (+ subpastas topbar/ left/ inspector/ activity/ tracking/)
      └─ views/    DeliveryExplorer · TableView · TableTabs · SortableTable · Legend
                   WelcomeModal · TourCoach · ModalShell · FilterSelect · …
```

Convenção de commits: um commit por domínio (escopo = camada), em inglês; veja [CONTRIBUTING.md](../CONTRIBUTING.md).

## 2. Modelos TypeScript principais

### Entidades (`domain/entities.ts`) — agnósticas de provedor

| Tipo | Campos relevantes |
|------|-------------------|
| `ForgeSnapshot` | `source { kind: 'demo'\|'connected', provider: ProviderInfo, generatedAt }`, `organization`, `squads`, `repositories`, `contributors`, `changeRequests`, `reviews`, `commits`, `pipelineRuns`, `deployments`, `initiatives` |
| `ProviderInfo` | `id`, `name`, `vocabulary { changeRequest, changeRequestShort, pipeline }` |
| `Squad` | `id`, `code` ("A"…), `name`, `description` |
| `Repository` | `squadId`, `name`, `fullName`, `defaultBranch`, `language`, `webUrl` |
| `Contributor` | `displayName`, `handle`, `squadId`, `role: ContributorRole \| null` (`developer`, `reviewer`, `tech-lead`, `product-manager`; só quando a fonte autoriza) |
| `ChangeRequest` | `number`, `repositoryId`, `title`, `productSummary \| null`, `authorId`, `state: open\|closed\|merged`, `draft`, `createdAt`, `mergedAt`, `closedAt`, `headSha`, `mergeCommitSha`, `targetBranch`, `requestedReviewerIds`, `initiativeId \| null` (nunca adivinhado), `webUrl` |
| `Review` | `changeRequestId`, `reviewerId`, `verdict: approved\|changes_requested\|commented`, `submittedAt` |
| `Commit` | `sha`, `repositoryId`, `authorId`, `message`, `committedAt`, `changeRequestId \| null` |
| `PipelineRun` | `repositoryId`, `pipelineName`, `headSha`, `branch`, `changeRequestId \| null`, `status: running\|success\|failure\|cancelled`, `startedAt` |
| `Deployment` | `repositoryId`, `environment: staging\|production`, `sha`, `ref`, `createdAt`, `status: running\|success\|failure`, **`changeRequestIds`** (única ligação de evidência), `webUrl` |
| `ProductInitiative` | `key`, `name`, `summary`, `ownerSquadId`, `status: discovery\|in_delivery\|released` |

Datas são strings ISO-8601. Toda `webUrl` aponta para o provedor (na demo, domínios fictícios; um teste garante que nenhuma contém `github.com`).

### Tipos derivados

| Tipo | Origem | Descrição |
|------|--------|-----------|
| `ChangeRequestEvidence` | `domain/rules` | `{ changeRequest, reviews, headRuns, deployments }`: tudo que as regras precisam |
| `DeliveryStatus` | `domain/rules` | `draft`, `awaiting_review`, `changes_requested`, `ci_failed`, `approved`, `merged`, `in_staging`, `in_production`, `closed` |
| `Stage` | `domain/rules` | `{ id: StageId, state: done\|blocked\|pending\|not_applicable, at, note }`; `StageId` = `opened`, `in_review`, `approved`, `merged`, `deployed`, `production` |
| `Delivery` | `application/queries/deliveries` | `{ cr, repo, squad, initiative, status, stages, environments, lastActivityAt }`. Unidade do Explorer, Product View e painéis |
| `StatusGroup` / `StatusFilter` | idem | `production`, `staging`, `integrated`, `review`, `blocked`, `draft`, `closed` (+ `awaiting_production` = integrada ou em staging) |
| `ForgeIndex` | `queries/forgeIndex` | Mapas por id e agrupados (`crsByRepo`, `deploymentsByCr`, `runsBySha`…), listas mais novas primeiro. `evidenceFor(idx, cr)` monta a evidência |
| `ScopeFilter` | `queries/period` | `{ periodDays: 7\|14\|30, squadId, now }`; `now` = `snapshot.source.generatedAt` (números reproduzíveis) |
| `RepositoryHealth` | `queries/repositoryHealth` | `repoId`, `hot` (48 h), `idle`, `lastActivityAt`, `pipeline { signal, latest }`, `lastDeployment`, `openChanges`, `blockedChanges`, `alert`, `modules: RackModule[]` (`changes`, `pipeline`, `deploy`, `commits`, cada um com `signal` + `label`) |
| `Signal` | idem | `active`, `success`, `attention`, `error`, `idle`, `unknown` |
| `DeliveryEvent` | `queries/events` | `kind: merged\|pipeline_failed\|deployed_staging\|deployed_production`, `at`, `repoId`, `squadId`, ids de origem |
| `Kpis` | `queries/kpis` | `merged`, `awaitingReview`, `pipelineFailures`, `productionDeploys`, `initiativeDeliveries` |
| `SquadSummary`, `PersonSummary`, `InitiativeSummary` | `queries/summaries`, `initiatives` | Resumos para inspetores. `PersonSummary` expõe só participação, nunca nota |
| `WorldModel` | `world/worldModel` | `sectors: SectorLayout[]`, `racks: RackLayout[]`, `figures: FigureLayout[]`, `corridorZ`, `gate`, `stagingDock`, `bounds` (posições `Vec2 = [x, z]`) |
| `EntityRef` | idem | `{kind:'squad'\|'repo'\|'person'\|'cr'\|'initiative', id}` ou `{kind:'gate'}`; `refKey()` gera a chave |
| `FocusTarget` | idem | `{ center: Vec2, radius }` para a câmera |
| `Script` / `Step` / `Pose` | `animation/script` | `Script { start, steps, offset }`; `Step` = `walk {to}` ou ação com `duration` e `face`; `Pose { position, heading, action, elapsed }`. `compile()` pré-calcula segmentos e `sample(compiled, time)` é função pura do tempo |
| `ActivityFacts` | `animation/behaviour` | `authoringRepoIds`, `reviewingRepoIds`, `celebrates`; `planBehaviour(figure, facts, world)` devolve o `Script` |
| `RigPose` | `animation/rig` | Ângulos de braços/pernas, `bob`, `headPitch`, `holdsDevice`; `rigPose(action, elapsed, time)` |

### Regras de evidência (`changeRequestProgress.ts`)

- `deliveryStatus`: fechada sem merge → `closed`; mergeada → `in_production` se há deploy **bem-sucedido** em produção que contenha a mudança, senão `in_staging`, senão `merged`; aberta → `draft`, `ci_failed` (a **última** execução na versão atual falhou), `changes_requested`, `approved` ou `awaiting_review`.
- Veredito por revisor: o mais recente vence; comentários simples não anulam veredito.
- `timeline`: etapa `done` só com registro concreto; sem ele `pending` (ou `not_applicable` se fechada sem integrar); `blocked` em ajustes pedidos, pipeline falhando ou deploy de produção falho.
- Deploy `running` ou `failure` nunca conta como concluído.

## 3. Contrato da fonte de dados

```ts
// application/ports/DeliveryDataSource.ts
interface DeliveryDataSource {
  readonly kind: SourceKind;            // 'demo' | 'connected'
  readonly label: string;
  availability(): { available: boolean; reason?: string };
  load(now?: Date): Promise<ForgeSnapshot>;   // `now` injetável para testes
}
```

| Implementação | Estado |
|---------------|--------|
| `DemoDataSource` ("Demo Mode") | Funcional. Snapshot determinístico: 3 squads, 9 repositórios, 12 pessoas (2 sem função), 25 mudanças, 8 pipelines, 6 deploys, 4 iniciativas, além de reviews e commits (2 ou 3 por mudança + commits antigos do repo legado) |
| `RemoteDataSource` ("Conectado") | **Stub**: `availability()` retorna `available: false` com o motivo; `load()` lança erro. O seletor de fonte da barra mostra "Conectado" desabilitado |

`dataStore.load(source)` checa `availability()`, chama `load()`, e deriva uma vez por snapshot `index` (`buildIndex`) e `world` (`buildWorld`). Erro → tela "Voltar ao Demo Mode".

### Modo conectado (futuro, desenho proposto)

```
Provedor Git ──webhooks──► Forge backend ──► PostgreSQL ──► GET /snapshot ──► RemoteDataSource ──► ForgeSnapshot
 (GitHub/GitLab/              (conectores,      (eventos       (autorizado       (navegador, sem
  Bitbucket/Azure)             normalização)     normalizados)  por usuário)      tokens)
```

Princípios (já refletidos em `RemoteDataSource.ts` e em ARCHITECTURE.md):

- O navegador **nunca** chama API de provedor e **nunca** guarda token. Só fala com o backend Forge.
- Cada provedor é um **conector no backend** (GitHub, GitLab, Bitbucket, Azure Repos). Adicionar provedor não muda o front, exceto `ProviderVocabulary`.
- Acesso **somente leitura**: GitHub App (preferido) ou OAuth com escopos mínimos de leitura.
- **Webhooks → PostgreSQL**: eventos normalizados para as entidades acima; reconciliação periódica por API para cobrir webhooks perdidos.
- **Autorização por usuário**: o snapshot devolvido contém só repositórios que o usuário pode ver no provedor (ou que a organização liberou explicitamente).
- **Nenhum código-fonte** sai da infraestrutura Forge nem vai a LLMs externos. Só metadados (títulos, números, SHAs, status).

### Mapeamento de payloads para as entidades

| Entidade | GitHub | GitLab |
|----------|--------|--------|
| `ChangeRequest` | `pull_request`: `number`, `title`, `user`, `draft`, `created_at`, `merged_at`, `closed_at`, `head.sha`, `merge_commit_sha`, `base.ref`, `requested_reviewers`, `html_url`. `state`: `merged` se `merged_at`, senão `closed`/`open` | Merge request: `iid`, `title`, `author`, `draft`, `created_at`, `merged_at`, `closed_at`, `sha`, `merge_commit_sha` (ou `squash_commit_sha`), `target_branch`, `reviewers`, `web_url` |
| `Review` | `pull_request_review`: `APPROVED`→`approved`, `CHANGES_REQUESTED`→`changes_requested`, `COMMENTED`→`commented` | Approvals → `approved`; "unapproved"/threads não resolvidas não mapeiam hoje para `changes_requested` (definir regra) |
| `PipelineRun` | `workflow_run`: `head_sha`, `head_branch`, `status`+`conclusion` → `running`/`success`/`failure`/`cancelled`; `pull_requests[]` → `changeRequestId` | Pipeline: `sha`, `ref`, `status` (`running`/`success`/`failed`/`canceled`), `web_url` |
| `Deployment` | Deployments API + último `deployment_status`: `environment`, `sha`, `ref`, `created_at`, estado → `running`/`success`/`failure` | Deployments: `environment`, `sha`, `ref`, `status` |
| `Commit` | `commits` da branch / do PR | `commits` do projeto / do MR |
| `Contributor.role` | **Não vem do provedor**. Só de configuração explícita da organização | Idem |
| `initiativeId` | De vínculo explícito (label, campo, referência a ticket). Sem vínculo = `null` | Idem |

Ambientes que não são `staging`/`production` precisam de mapeamento configurável por organização (ex.: `homolog` → `staging`); ambientes sem mapeamento são ignorados.

### Como calcular `Deployment.changeRequestIds` (evidência)

Este é o campo que decide "em produção". Regra: uma mudança entra em `changeRequestIds` **somente se estiver provado que seu código está contido no `sha` implantado**. Nunca por proximidade de datas ("integrou antes do deploy").

1. A mudança precisa estar `merged` com `mergeCommitSha` conhecido (para squash e rebase, é o commit resultante na branch de destino, não o `headSha`).
2. Para um deploy com `sha = D` no repositório, a mudança é contida se `mergeCommitSha` for **ancestral** de `D` (ou igual). Prova via comparação de commits do provedor (`compare`) ou `git merge-base --is-ancestor` em espelho do repositório mantido pelo backend.
3. Otimização: calcular só o intervalo `(deploy anterior bem-sucedido no mesmo ambiente .. D]` e associar cada commit do intervalo à sua mudança (`mergeCommitSha`, ou PR associado ao commit). Guardar o resultado no deploy.
4. Persistir em `changeRequestIds` apenas mudanças **do mesmo repositório** (o teste de integridade da demo exige isso).
5. Deploys `failure` e `running` também carregam seus ids (servem para marcar a etapa `production` como `blocked`), mas as regras só contam `success` como concluído. Se o status mudar (`running` → `success`), reavaliar sem recomputar ancestralidade.
6. Se a ancestralidade não puder ser provada (SHA desconhecido, histórico reescrito, falha do provedor), **não** incluir a mudança: ela permanece `merged` e o HUD mostra "Nenhum deploy contendo esta mudança foi encontrado". Falso negativo é aceitável; falso positivo não é.

## 4. Componentes da cena

| Componente | Arquivo (`presentation/scene/`) | Responsabilidade | Entradas principais |
|------------|---------------------------------|------------------|---------------------|
| `ForgeCanvas` | `ForgeCanvas.tsx` | Canvas R3F ortográfico (lazy-loaded), tone mapping ACES, sombras só em qualidade alta, `PerformanceMonitor` (rebaixa para "low" e DPR 1), `role="img"` + `aria-label` | `world` e `quality` (stores) |
| `ForgeScene` | `ForgeScene.tsx` | Compõe o mundo a partir dos dados: placar por setor, conjunto de racks em foco, contagens do portão | stores + `useScope`, `useRepoHealth`, `useFigureScripts`, `useEvents` |
| `SectorEntity` | `entities/SectorEntity.tsx` | Plataforma, sinal de piso, parede, quadros, mesas, sala temática, cable trays; clique seleciona squad | `layout: SectorLayout`, `racks`, `figures`, `boards: SectorBoards`, `dimmed` |
| `RackEntity` | `entities/RackEntity.tsx` | Rack: placa, 4 módulos x 2 lâminas, beacon, marcador "!", feedback de hover/seleção/destaque | `layout: RackLayout`, `repo`, `health: RepositoryHealth`, `highlighted`, `dimmed`, `reducedMotion` |
| `FigureEntity` | `entities/FigureEntity.tsx` | Personagem de blocos; aplica `sample()` + `rigPose()` por frame; publica posição em `livePositions` | `layout: FigureLayout`, `person`, `script: CompiledScript`, `dimmed`, `reducedMotion` |
| `FlowStreams` | `entities/FlowStreams.tsx` | Trilhas e pulsos (um `InstancedMesh` para todos); cor por tipo de evento | `world`, `events: DeliveryEvent[]`, `focusRepoIds`, `reducedMotion` |
| `ProductionGate` | `entities/ProductionGate.tsx` | Portão de produção e doca de staging com placas de contagem; clicável (`{kind:'gate'}`) | `gate`, `dock`, `productionCount`, `stagingCount`, `reducedMotion` |
| `Desk`, `Board`, `FeatureProp`, `CableTray` | `entities/props.tsx` | Adereços; `FeatureProp` escolhe sala por `SectorFeature` | posição `Vec2`, linhas do quadro, `feature` |
| `Box`, `Cylinder`, `Decal`, `useCanvasTexture` | `kit/Part.tsx` | Blocos de construção reutilizáveis | tamanho, material, textura |
| `mat`, `geo` | `kit/materials.ts` | Catálogo de materiais (matte, glow, emissive, glass, rackMetal…) | |
| `makeCanvasTexture`, `FONTS`, `makeFloorTexture`, `makeHatchTexture` | `kit/canvasTexture.ts` | Texturas 2D desenhadas em canvas | |
| `Environment` | `stage/Environment.tsx` | Luzes, névoa, piso, corredor principal | `world`, `shadows` |
| `CameraRig` | `stage/CameraRig.tsx` | `CameraControls`, limites, comandos da UI, enquadramento ciente do inspetor | `world`, `uiStore.camera` |
| `Effects` | `stage/Effects.tsx` | Bloom (só materiais não-tone-mapped) + vinheta; só em qualidade alta | |

Interação 3D: `useInteractive(ref)` devolve `{ hovered, selected, handlers }` e filtra cliques que terminaram um arrasto (`e.delta > 4`).

### HUD (resumo)

`HudLayout` posiciona `TopBar`, `KpiStrip`, `LeftColumn`, `MapControls`, `Inspector`, `DeliveryTracking`, `Legend`, `ActivityTabs`, `HoverTooltip`, `TourCoach` e os overlays `DeliveryExplorer`, `TableView`, `WelcomeModal`. Detalhes de cada região em [HUD_SPEC.md](HUD_SPEC.md). O Delivery Explorer expõe `useExplorerFilters` (zustand) com `open(prefilter)`, usado pelas "Perguntas da semana".

## 5. Estados de interação (`state/uiStore.ts`)

| Estado | Valores | Notas |
|--------|---------|-------|
| `selection` | `EntityRef \| null`: `squad`, `repo`, `person`, `cr`, `initiative`, `gate` | `squad`/`repo`/`person`/`gate` vêm do clique 3D ou de listas; `cr` e `initiative` só do HUD. `select(ref)` foca a câmera; `select(null)` dispara `back` |
| `hover` | `EntityRef \| null` | Só objetos 3D; alimenta `HoverTooltip` (squad, repo, pessoa, portão) e o contorno do objeto |
| `highlightInitiativeId` | `ID \| null` | Destaca racks da iniciativa e esmaece o resto; persiste ao limpar a seleção |
| `trackedCrId` | `ID \| null` | Mudança do card Delivery tracking; selecionar uma `cr` também a define |
| `squadId` / `periodDays` | `ID \| null` / `7\|14\|30` | Escopo global. `setSquad` também comanda a câmera (foco ou visão geral). Racks e personagens fora da squad ficam esmaecidos, mas o mundo mostra sempre todos |
| `viewMode` | `product` \| `engineering` | Troca "Perguntas da semana" por "Saúde técnica" e o nível de detalhe dos inspetores |
| `overlay` | `explorer` \| `table` \| `welcome` \| `null` | Um por vez; boas-vindas abre na primeira visita |
| `tourStep` | `0..5 \| null` | `TourCoach` executa a ação do passo ao mudar |
| `camera` | `focus`, `overview`, `back`, `zoom`, `rotate` + `nonce` | O `nonce` faz comandos idênticos repetidos reexecutarem |
| `reducedMotion` / `quality` | boolean / `high` \| `low` | Inicial: `prefers-reduced-motion`; `low` se largura < 760px; `PerformanceMonitor` pode rebaixar |

Ordem do `Esc`: tour e modais capturam o evento (fase de captura, `stopPropagation`) antes do inspetor; popovers e a busca tratam o próprio `Esc`; o inspetor só fecha se não há overlay nem tour.

`dataStore` guarda o estado de carga (`idle`/`loading`/`ready`/`error`), `snapshot`, `index`, `world`, a fonte atual e as registradas. `uiStore` nunca guarda dados de domínio. `selectors.ts` liga os dois (`useScope`, `useKpis`, `useEvents`, `useRepoHealth`, `useFigureScripts`).

## 6. Critérios de teste

### O que os testes unitários cobrem (`npm test`)

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `domain/rules/changeRequestProgress.test.ts` | 31 | `deliveryStatus` e `timeline`: merge sem deploy não é produção; deploy falho/rodando não conta; staging + produção falha; último veredito por revisor; comentário não anula; só a última execução decide CI; fechada → `not_applicable`; produção falha → `blocked`; nenhuma etapa `done` sem evidência; etapas `unknown` quando a fonte não informa revisões/deploys |
| `application/queries/queries.test.ts` | 25 | KPIs (não triviais, monotônicos com o período); `listDeliveries` (status, iniciativa `none`, ambiente, repo, squad, texto, ordenação); `repositoryHealth` (legado ocioso, alertas por pipeline/bloqueio/deploy, saudável sem alerta); `initiativeSummary` (headline, multi-squad, ignora filtro de squad); `personSummary` sem nota numérica; filtro `awaiting_production` |
| `infrastructure/demo/demoSnapshot.test.ts` | 16 | Contagens documentadas, fonte demo, determinismo, ids únicos, integridade referencial (CR, review, commit, pipeline com mesmo SHA, deploy com CR do mesmo repo), datas dentro de 30 dias, repo legado sem atividade, nenhuma URL com `github.com` |
| `architecture.test.ts` | 2 | Regra de dependência entre camadas; `world/` e `animation/` sem React/Three |

**Não há** testes de componentes React, de `world/`, `animation/`, `flowPaths`, da cena, nem e2e. A verificação visual é manual (ver abaixo).

### Critérios de aceite do MVP (brief, seção 19) e como verificar

| # | Critério do brief | Como verificar | Estado |
|---|---|---|---|
| 1 | O usuário consegue explorar o data center visualmente | `npm run dev`: arrastar (pan), botão direito (giro limitado), roda/pinça (zoom), controles do mapa | ✅ |
| 2 | Os três setores são identificáveis | Placa pintada no piso (código + nome + tagline), sala temática por setor, cards no onboarding | ✅ |
| 3 | Os racks representam repositórios do modelo de demonstração | 9 racks com placa do nome; contagens em `demoSnapshot.test.ts` | ✅ |
| 4 | Os personagens têm significado visual e interação | Roteiros derivados de onde a pessoa atuou (`animation/behaviour.ts`); clique abre o inspetor de pessoa, sem ranking | ✅ |
| 5 | Selecionar uma squad mostra suas informações | Clicar no piso do setor ou no seletor de squad → inspetor de squad | ✅ |
| 6 | Selecionar um rack abre o histórico correspondente | Clicar no rack → commits, mudanças, pipeline e último deploy | ✅ |
| 7 | Os filtros atualizam consistentemente os dados | Período/squad afetam KPIs, quadros, fluxos, explorer e tabela; teste "soma por squad = total" | ✅ |
| 8 | O Product View permite encontrar entregas da semana | Período 7d → "O que chegou em produção?" | ✅ |
| 9 | PR merged e deployment em produção são estados distintos | `changeRequestProgress.test.ts`; UI: "Integrado · sem deploy" vs "Em produção" | ✅ |
| 10 | O sistema não apresenta dados fictícios como reais | Chip DEMO DATA, links de evidência não navegáveis em demo, nenhuma URL real (teste) | ✅ |
| 11 | Chegar a uma entrega em até três cliques a partir da visão geral | Pergunta → card no Explorer → linha do tempo (2 cliques), verificado com Playwright | ✅ |
| 12 | Identidade de produto corporativo, não landing page | Layout operacional no padrão WareTrack (barra, KPIs, colunas, inspector) | ✅ |

Antes de integrar: `npm run typecheck && npm test && npm run build`.

## 7. Backlog incremental

Ordem sugerida. Cada história deve caber em um PR pequeno. Tudo abaixo é **futuro**, nada existe ainda.

### Épico 1 — Esqueleto do backend
1. Repositório/pasta do backend (NestJS proposto) com health check, config por ambiente e CI.
2. PostgreSQL + migrações para as tabelas espelhando `ForgeSnapshot`.
3. Endpoint `GET /snapshot` devolvendo um `ForgeSnapshot` estático validado por schema (contrato compartilhado com o front).
4. `RemoteDataSource.load()` chamando o endpoint; `availability()` real; habilitar "Conectado" na barra.
5. Teste de contrato: o snapshot do backend passa nas mesmas checagens de integridade do demo.

### Épico 2 — Autenticação e autorização
1. Login (OIDC/OAuth) e sessão por cookie httpOnly; sem token no navegador.
2. Modelo de organização, usuários e papéis do Forge.
3. Filtro do snapshot por repositórios autorizados ao usuário.
4. Auditoria de acesso.

### Épico 3 — Conector GitHub
1. GitHub App somente leitura e fluxo de instalação.
2. Backfill de repositórios, PRs, reviews, commits, workflow runs, deployments.
3. Normalização para as entidades (tabela de mapeamento da seção 3) com testes de fixture.
4. Mapa de ambientes por organização (`homolog` → `staging`).
5. Cálculo de `Deployment.changeRequestIds` por ancestralidade (seção 3).

### Épico 4 — Webhooks
1. Endpoint de webhooks com verificação de assinatura e idempotência.
2. Fila e processamento incremental dos eventos para o PostgreSQL.
3. Reconciliação periódica por API.
4. Atualização ao vivo no front (polling → SSE/WebSocket) e indicador de frescor real em "Snapshot · sincronizado há X".

### Épico 5 — Evidência real de produção
1. Ancestralidade em espelho de repositório vs API `compare`; escolher e medir.
2. Tratamento de squash, rebase e histórico reescrito; casos de teste.
3. Reavaliar deploys que mudam de status.
4. Exibir no inspetor "por que" uma mudança está ou não em produção.

### Épico 6 — Conector GitLab
1. OAuth/token de aplicação somente leitura.
2. Mapeamento de MR, pipelines, deployments e approvals (definir regra para `changes_requested`).
3. `ProviderVocabulary` "MR" ponta a ponta.

### Épico 7 — Outros provedores e ligação com produto
1. Bitbucket e Azure Repos (conectores).
2. Vínculo a iniciativas por label/campo; depois Jira e Azure DevOps como fonte de `ProductInitiative` (adiado).
3. Função de contribuidor (`role`) por configuração explícita da organização.

### Épico 8 — Performance da cena
1. Instanciar lâminas/LEDs dos racks (hoje cada lâmina é um conjunto de malhas).
2. Carregar setores sob demanda (lazy) e culling por distância.
3. Compartilhar texturas de placas e atlas de canvas.
4. Orçamento de frames medido em dispositivos de referência; reduzir custo de sombras e bloom.
5. Layout para muitas squads (hoje uma única fileira horizontal).

### Épico 9 — Mobile
1. Cena 3D simplificada (sem sombras/bloom, menos detalhes) por padrão em telas pequenas.
2. HUD mobile dedicado (hoje esconde painéis); navegação por abas inferiores.
3. Opção de iniciar direto na visão tabular em dispositivos fracos.

### Épico 10 — Qualidade e plataforma
1. Testes de e2e com Playwright: fluxos 1 e 2 de navegação, tour, visão tabular, fallback sem WebGL, teclado.
2. Testes unitários para `world/`, `animation/` e `flowPaths` (puros, hoje sem cobertura).
3. Testes de componentes do HUD (Inspector, Explorer, TableView).
4. i18n (hoje pt-BR fixo; extrair strings).
5. Fontes hospedadas localmente (hoje Google Fonts).
6. Deep links e estado na URL (seleção, squad, período, modo).
7. Auditoria de acessibilidade (leitor de tela na cena, contraste) e navegação por teclado entre racks.
8. Observabilidade do front (erros, métricas de FPS).

### Fora do MVP (explicitamente excluído ou adiado)

| Item | Decisão |
|------|---------|
| Agentes de IA, chat, RAG sobre código | **Excluído do MVP.** Se vier, nenhum código-fonte vai a LLMs externos |
| Rankings, notas ou métricas de produtividade por pessoa | **Excluído** por princípio de produto, não só por prazo |
| Presença, "quem está online", carga de trabalho | **Excluído**; personagens são ilustrativos |
| Escrita no provedor (comentar, aprovar, fazer deploy) | **Excluído**; somente leitura |
| Previsões e recomendações automáticas | **Adiado**, sem data |
| Edição de layout do data center pelo usuário | **Adiado** |

## 8. Limitações conhecidas do protótipo

- **Somente dados de demonstração.** O modo "Conectado" é um stub desabilitado; não há backend, auth nem persistência. O instante de referência do snapshot é a hora do carregamento (`new Date()`), então os dados "rejuvenescem" a cada abertura.
- **Cobertura de testes parcial.** Os testes cobrem domínio, queries, snapshot demo e arquitetura. Cena, animação, `world/` e HUD não têm testes automatizados; sem e2e. A verificação visual é manual.
- **Desempenho.** Cada lâmina de rack é composta de várias malhas (só os pulsos de fluxo são instanciados); todos os setores são carregados de uma vez; texturas de canvas por rack/placa. Em celulares fracos a cena pode ficar lenta; o `PerformanceMonitor` só rebaixa a qualidade (não volta a "alta" sozinho).
- **Escala do layout.** Setores ficam numa única fileira horizontal; muitas squads geram um mundo muito largo.
- **Acessibilidade.** A cena 3D não é navegável por teclado nem lida por leitores de tela; a alternativa é a visão tabular. O fallback sem WebGL mostra só a tabela.
- **Mobile.** Em telas pequenas faltam a coluna esquerda, o tracking, a atividade e os controles de mapa; a experiência recomendada é a visão tabular.
- **Estado efêmero.** Seleção, squad, período e modo não vão para a URL e se perdem ao recarregar. O único `localStorage` é a flag de boas-vindas.
- **Dependência de CDN.** Fontes vêm do Google Fonts; sem rede o visual cai para fontes do sistema.
- **Tour acoplado à demo.** O tour prefere ids da demo (`sq-admin`, `repo-admin-console-web`) e cai para o primeiro registro quando eles não existem.
- **Temas de setor.** Só 3 temas fixos em `config/world.ts` (ciclados para squads novas); personagens com tons de pele/cabelo e blocos genéricos, sem personalização.
- **Idioma.** Apenas pt-BR.
- **Fonte de verdade de layout.** `docs/HUD_SPEC.md` referencia imagens de um checkout externo (não incluídas aqui por não haver licença de reuso).
