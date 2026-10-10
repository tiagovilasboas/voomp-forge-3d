# Voomp Forge — Handoff de engenharia (v0.1.0)

Estado: **protótipo front-end**. Roda com dados de demonstração (fictícios) ou com um snapshot importado (`?snapshot=<url>`) gerado por conectores. Não há backend, autenticação nem modo conectado. Este documento diz o que existe, como estender e o que vem a seguir. Para camadas e fluxo de dados, veja [ARCHITECTURE.md](ARCHITECTURE.md); para o design, [DESIGN.md](DESIGN.md); para a ingestão, [INGESTION.md](INGESTION.md); para decisões, [DECISIONS.md](DECISIONS.md). Histórico de versões: [../CHANGELOG.md](../CHANGELOG.md).

## 0. Próximos passos

Em ordem sugerida. Cada item cabe em um PR pequeno.

1. **Validar a ingestão em dados reais** (com credenciais e clones do time): rodar `npm run ingest` com um `forge.config.json` real e revisar o snapshot gerado contra o que o time conhece.
2. **Automatizar a ingestão diária** no n8n ou em um job agendado (o fluxo hoje é só documentado na tela Automações do Hub IA). Nada roda a partir do Forge.
3. **Backend mínimo** (Épico 1) para substituir o snapshot estático por `GET /snapshot` e habilitar "Conectado".
4. **Testes de interface**: e2e com Playwright para os fluxos de navegação e testes de componentes do HUD (hoje sem cobertura automatizada).
5. **Escala do layout**: testar com 10 ou mais squads (hoje validado só com a demonstração).

## 1. Arquitetura de componentes

### Camadas e regra de dependência

```
domain ← application ← { infrastructure, presentation }      config ← domain, presentation
```

| Camada | Pode importar | Conteúdo |
|--------|---------------|----------|
| `domain` | `domain` | `entities.ts`, `rules/changeRequestProgress.ts`, `rules/workstreamProgress.ts` |
| `application` | `application`, `domain` | Portas (`DeliveryDataSource`, `connectors`, `KnowledgeRetriever`), `contracts/` (merge e validação do snapshot), `queries/` |
| `infrastructure` | `infrastructure`, `application`, `domain` | `connectors/` (git-local, jira, plan-csv, confluence), `git/`, `demo/`, `file/`, `remote/` |
| `config` | `config`, `domain` | `world.ts` (temas dos setores, constantes de layout) |
| `presentation` | `presentation`, `application`, `domain`, `config` | state, world, animation, interaction, scene, hud, `theme.ts` |

`infrastructure` e `presentation` nunca se importam. `App.tsx` e `main.tsx` (raiz de composição, fora das camadas) escolhem a fonte de dados e montam cena + HUD. `tools/ingest/cli.ts` é a raiz de composição da ingestão.

**Enforcement:** `src/architecture.test.ts` varre `src/` (imports relativos e aliases `@domain`, `@application`, `@infrastructure`, `@presentation`, `@config`) e falha se uma camada importa outra fora da tabela acima. Também garante que `presentation/world` e `presentation/animation` não importam `react`, `three` nem `@react-three/*`.

### Estrutura de pastas

```
src/
├─ main.tsx · App.tsx           composição: fonte, WebGL check, boas-vindas
├─ index.css                    tokens Tailwind 4, hud-card, focus-ring
├─ architecture.test.ts
├─ domain/
│  ├─ entities.ts
│  └─ rules/                    changeRequestProgress · workstreamProgress
├─ application/
│  ├─ ports/                    DeliveryDataSource · connectors · KnowledgeRetriever
│  ├─ contracts/                mergeFragments · parseSnapshot
│  └─ queries/                  forgeIndex · period · deliveries · events · kpis · repositoryHealth
│                               summaries · initiatives · workstreams · calendar
├─ infrastructure/
│  ├─ connectors/               registry · config · git-local · jira · plan-csv · confluence · http
│  ├─ git/                      buildSnapshotFromGit · mergeMessages · workItems
│  ├─ demo/                     DemoDataSource · demoSnapshot
│  ├─ file/                     SnapshotFileDataSource (?snapshot=)
│  └─ remote/                   RemoteDataSource (desativado)
├─ config/world.ts
└─ presentation/
   ├─ theme.ts                  PALETTE, SIGNAL_LOOK, STATUS_LOOK, IconName
   ├─ state/                    dataStore · uiStore · notesStore · selectors · productionRides
   ├─ world/                    buildWorld · frame · flowPaths · worldModel     (puro)
   ├─ animation/                script · behaviour · rig · quirks · expression · npc   (puro)
   ├─ interaction/              useInteractive · livePositions
   ├─ scene/
   │  ├─ ForgeCanvas.tsx · ForgeScene.tsx
   │  ├─ entities/              Sector · Rack · Figure (robô) · Hub IA · Gate · Fronts/Calendar/Week walls
   │  │                         Credit plaque · N8n desk · NPC · Flow streams · props · holoProps
   │  ├─ holo/                  HoloPanel · RepoHologram · holoDraw
   │  ├─ kit/                   Part · materials · canvasTexture · orientation · robotDesign
   │  └─ stage/                 Environment · CameraRig · Effects · Reflections
   └─ hud/
      ├─ HudLayout.tsx          escolhe o layout pelo breakpoint e monta os overlays
      ├─ layouts/               PhoneHud · TabletHud · DesktopHud
      ├─ kit/                   primitives · Icon · EvidenceLink · format · useMediaQuery · BottomSheet · Drawer
      ├─ panels/                TopBar · KpiStrip · LeftColumn · Inspector · MapControls · ActivityTabs
      │                         DeliveryTracking · HoverTooltip (+ topbar/ left/ inspector/ activity/ tracking/)
      ├─ objects/               Object Screens: Hub · Terminal · Pinball · Automação · Board · Desk · Whiteboard
      ├─ fronts/                Mural de Frentes (Mural, Roadmap, Alocação) · Calendário de entregas
      ├─ mobile/                BottomNav · MobileSheets · MoreContent · SearchSheet
      └─ views/                 DeliveryExplorer · TableView · WelcomeModal · TourCoach · Legend · …
```

Convenção de commits: um commit por domínio (escopo = camada), em inglês; veja [CONTRIBUTING.md](../CONTRIBUTING.md).

## 2. Modelos TypeScript principais

### Entidades (`domain/entities.ts`) — agnósticas de provedor

| Tipo | Campos relevantes |
|------|-------------------|
| `ForgeSnapshot` | `schemaVersion` (1), `source { kind: 'demo'\|'imported'\|'connected', provider: ProviderInfo, capabilities: SourceCapabilities, generatedAt }`, `organization`, `squads`, `repositories`, `contributors`, `changeRequests`, `reviews`, `commits`, `pipelineRuns`, `deployments`, `initiatives`, `documents`, `workItems`, `workstreams` |
| `SourceCapabilities` | Um nível por fonte (`native` \| `inferred` \| `unavailable`) para `changeRequests`, `reviews`, `pipelines`, `deployments`, `documents`, `workItems`, `workstreams`. A interface mostra "sem dados" quando `unavailable`, nunca "0" |
| `ProviderInfo` | `id`, `name`, `vocabulary { changeRequest, changeRequestShort, pipeline }` |
| `Squad` | `id`, `code` ("A"…), `name`, `description` |
| `Repository` | `squadId`, `name`, `fullName`, `defaultBranch`, `language`, `webUrl` |
| `Contributor` | `displayName`, `handle`, `squadId`, `role: ContributorRole \| null` (`developer`, `reviewer`, `tech-lead`, `product-manager`; só quando a fonte autoriza) |
| `ChangeRequest` | `number`, `repositoryId`, `title`, `productSummary \| null`, `authorId`, `state: open\|closed\|merged`, `draft`, datas, `headSha`, `mergeCommitSha`, `targetBranch`, `requestedReviewerIds`, `initiativeId \| null` (nunca adivinhado), `workItems` (chaves de tarefas), `origin` (`provider` ou `merge-commit`), `webUrl` |
| `Review` | `changeRequestId`, `reviewerId`, `verdict: approved\|changes_requested\|commented`, `submittedAt` |
| `Commit` | `sha`, `repositoryId`, `authorId`, `message`, `committedAt`, `changeRequestId \| null` |
| `PipelineRun` | `repositoryId`, `pipelineName`, `headSha`, `branch`, `changeRequestId \| null`, `status: running\|success\|failure\|cancelled`, `startedAt` |
| `Deployment` | `repositoryId`, `environment: staging\|production`, `sha`, `ref`, `createdAt`, `status: running\|success\|failure`, **`changeRequestIds`** (única ligação de evidência), **`triggeredById`** (quem disparou, quando o CD registra; `null` = desconhecido), `webUrl` |
| `ProductInitiative` | `key`, `name`, `summary`, `ownerSquadId`, `status: discovery\|in_delivery\|released` |
| `KnowledgeDocument` | `kind: spec\|adr\|runbook\|postmortem\|guide`, título, vínculos com iniciativas e repositórios (só por rótulo mapeado) |
| `WorkItem` | `key`, `type: epic\|story\|task\|bug`, `status: todo\|in_progress\|done`, `productionAt` (só com evidência do tracker), épico, sprint |
| `Workstream` (frente) | `id`, `name`, `category: sprint_priority\|closing\|sustaining\|open_topic`, `squadIds` (many-to-many com squads), `team` (`StaffAssignment`), `plans` (histórico de datas), `dependencies` (bloqueio ou espera), `declaredDone` (declaração da planilha) |

Datas são strings ISO-8601. Toda `webUrl` aponta para o provedor (na demo, domínios fictícios; um teste garante que nenhuma contém `github.com`).

### Tipos derivados

| Tipo | Origem | Descrição |
|------|--------|-----------|
| `ChangeRequestEvidence` | `domain/rules` | `{ changeRequest, reviews, headRuns, deployments }`: tudo que as regras precisam |
| `DeliveryStatus` | `domain/rules` | `draft`, `awaiting_review`, `changes_requested`, `ci_failed`, `approved`, `merged`, `in_staging`, `in_production`, `closed` |
| `Stage` | `domain/rules` | `{ id: StageId, state: done\|blocked\|pending\|not_applicable, at, note }`; `StageId` = `opened`, `in_review`, `approved`, `merged`, `deployed`, `production` |
| `WorkstreamProgress` / `WorkstreamStatus` | `domain/rules/workstreamProgress` | `delivered`, `blocked`, `at_risk`, `in_progress`, `planned`, `on_demand`; `evidence` (`tracker`, `git`), `divergence`, `declaredWithoutEvidence`, `onTime`, contagens |
| `Delivery` | `application/queries/deliveries` | `{ cr, repo, squad, initiative, status, stages, environments, lastActivityAt }`. Unidade do Explorer, Product View e painéis |
| `StatusGroup` / `StatusFilter` | idem | `production`, `staging`, `integrated`, `review`, `blocked`, `draft`, `closed` (+ `awaiting_production` = integrada ou em staging) |
| `ForgeIndex` | `queries/forgeIndex` | Mapas por id e agrupados (`crsByRepo`, `deploymentsByCr`, `runsBySha`…), listas mais novas primeiro. `evidenceFor(idx, cr)` monta a evidência |
| `ScopeFilter` | `queries/period` | `{ periodDays: 7\|14\|30, squadId, now }`; `now` = `snapshot.source.generatedAt` (números reproduzíveis) |
| `RepositoryHealth` | `queries/repositoryHealth` | `repoId`, `hot` (48 h), `idle`, `lastActivityAt`, `pipeline { signal, latest }`, `lastDeployment`, `openChanges`, `blockedChanges`, `alert`, `modules: RackModule[]` (`changes`, `pipeline`, `deploy`, `commits`, cada um com `signal` + `label`) |
| `Signal` | idem | `active`, `success`, `attention`, `error`, `idle`, `unknown` |
| `DeliveryEvent` | `queries/events` | `kind: merged\|pipeline_failed\|deployed_staging\|deployed_production`, `at`, `repoId`, `squadId`, ids de origem |
| `Kpis` | `queries/kpis` | `merged`, `awaitingReview`, `pipelineFailures`, `productionDeploys`, `initiativeDeliveries` |
| `SquadSummary`, `PersonSummary`, `InitiativeSummary` | `queries/summaries`, `initiatives` | Resumos para inspetores. `PersonSummary` expõe só participação, nunca nota |
| `WorldModel` | `world/worldModel` | `sectors: SectorLayout[]`, `racks`, `figures`, `aiHub` (`center`, `size`, `facing`, posições de terminal, pinball e automação), `knowledgeVault`, `corridorZ`, `gate`, `stagingDock`, `weekBoard`, `creditPlaque`, `frontsWall`, `calendarWall`, `bounds` (posições `Vec2 = [x, z]`) |
| `EntityRef` | idem | `{kind: 'squad'\|'repo'\|'person'\|'cr'\|'initiative'\|'document'\|'workstream'\|'board'\|'desk', id}` ou sem id: `gate`, `whiteboard`, `hub`, `terminal`, `pinball`, `automation`, `fronts`, `calendar`. `refKey()` gera a chave |
| `FocusTarget` | idem | `{ center: Vec2, radius }` para a câmera (`focusFor`) |
| `Script` / `Step` / `Pose` | `animation/script` | `Script { start, steps, offset }`; `Step` = `walk {to}` ou ação com `duration` e `face`; `Pose { position, heading, action, elapsed }`. `compile()` pré-calcula segmentos e `sample(compiled, time)` é função pura do tempo |
| `ActivityFacts` | `animation/behaviour` | `authoringRepoIds`, `reviewingRepoIds`, `celebrates`, `ride` (`deploying` \| `celebrating`); `planBehaviour(figure, facts, world)` devolve o `Script` |
| `RigPose` | `animation/rig` | Ângulos de braços/pernas, `bob`, `headPitch`, `holdsDevice`; `rigPose(action, elapsed, time)` |

### Regras de evidência

**`changeRequestProgress.ts`**

- `deliveryStatus`: fechada sem merge → `closed`; mergeada → `in_production` se há deploy **bem-sucedido** em produção que contenha a mudança, senão `in_staging`, senão `merged`; aberta → `draft`, `ci_failed` (a **última** execução na versão atual falhou), `changes_requested`, `approved` ou `awaiting_review`.
- Veredito por revisor: o mais recente vence; comentários simples não anulam veredito.
- `timeline`: etapa `done` só com registro concreto; sem ele `pending` (ou `not_applicable` se fechada sem integrar); `blocked` em ajustes pedidos, pipeline falhando ou deploy de produção falho.
- Deploy `running` ou `failure` nunca conta como concluído.

**`workstreamProgress.ts` (frentes)**

- Produção só com evidência do **tracker** (`productionAt` de uma tarefa) ou do **Git** (mudança em produção). A planilha nunca prova produção.
- `delivered` exige evidência e concordância: o Git concorda se todas as mudanças mescladas chegaram à produção e nenhuma está aberta; o tracker concorda se todas as tarefas estão concluídas.
- `divergence` quando Jira e Git discordam (ex.: Jira diz "em produção" e a mudança vinculada não foi implantada).
- "Finalizado" na planilha vira `declaredWithoutEvidence` e não conta como entregue.
- Ordem de prioridade do status: `delivered` → `blocked` (bloqueio declarado ou mudança bloqueada) → `at_risk` (data comprometida passou) → `on_demand` (sustentação sem data) → `in_progress` → `planned`.

## 3. Contrato da fonte de dados

```ts
// application/ports/DeliveryDataSource.ts
interface DeliveryDataSource {
  readonly kind: SourceKind;            // 'demo' | 'imported' | 'connected'
  readonly label: string;
  availability(): { available: boolean; reason?: string };
  load(now?: Date): Promise<ForgeSnapshot>;   // `now` injetável para testes
}
```

| Implementação | Estado |
|---------------|--------|
| `DemoDataSource` ("Demo Mode") | Funcional. Snapshot determinístico e fictício: 3 squads, 9 repositórios, 12 pessoas (2 sem função), 25 mudanças, 8 pipelines, 7 deploys, 4 iniciativas, 8 frentes, pelo menos 38 tarefas, além de reviews e commits. O instante de referência é a hora do carregamento |
| `SnapshotFileDataSource` ("Snapshot importado") | Funcional. Ativo com `?snapshot=<url>`: baixa o JSON, valida (`parseSnapshot`) e mostra os problemas encontrados se o arquivo for inválido. Vira a fonte padrão quando o parâmetro existe; o Demo continua no seletor |
| `RemoteDataSource` ("Conectado") | **Stub**: `availability()` retorna `available: false` com o motivo; `load()` lança erro. O seletor de fonte da barra mostra "Conectado" desabilitado |

`dataStore.load(source)` checa `availability()`, chama `load()`, e deriva uma vez por snapshot `index` (`buildIndex`) e `world` (`buildWorld`). Erro → tela com ação "Voltar ao Demo Mode".

### Ingestão atual (conectores)

`npm run ingest -- --config forge.config.json --out public/snapshot.json` executa os conectores (`git-local`, `jira`, `plan-csv`, `confluence`), une os fragmentos, valida e grava o JSON. Detalhes, segredos e regras de evidência em [INGESTION.md](INGESTION.md). O navegador nunca recebe tokens.

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

### Mapeamento de payloads para as entidades (conexão via API)

| Entidade | GitHub | GitLab |
|----------|--------|--------|
| `ChangeRequest` | `pull_request`: `number`, `title`, `user`, `draft`, `created_at`, `merged_at`, `closed_at`, `head.sha`, `merge_commit_sha`, `base.ref`, `requested_reviewers`, `html_url`. `state`: `merged` se `merged_at`, senão `closed`/`open` | Merge request: `iid`, `title`, `author`, `draft`, `created_at`, `merged_at`, `closed_at`, `sha`, `merge_commit_sha` (ou `squash_commit_sha`), `target_branch`, `reviewers`, `web_url` |
| `Review` | `pull_request_review`: `APPROVED`→`approved`, `CHANGES_REQUESTED`→`changes_requested`, `COMMENTED`→`commented` | Approvals → `approved`; "unapproved"/threads não resolvidas não mapeiam hoje para `changes_requested` (definir regra) |
| `PipelineRun` | `workflow_run`: `head_sha`, `head_branch`, `status`+`conclusion` → `running`/`success`/`failure`/`cancelled`; `pull_requests[]` → `changeRequestId` | Pipeline: `sha`, `ref`, `status` (`running`/`success`/`failed`/`canceled`), `web_url` |
| `Deployment` | Deployments API + último `deployment_status`: `environment`, `sha`, `ref`, `created_at`, estado → `running`/`success`/`failure` | Deployments: `environment`, `sha`, `ref`, `status` |
| `Deployment.triggeredById` | Só quando o CD registra quem disparou; senão `null` (nunca deduzido) | Idem |
| `Commit` | `commits` da branch / do PR | `commits` do projeto / do MR |
| `Contributor.role` | **Não vem do provedor**. Só de configuração explícita da organização | Idem |
| `initiativeId` | De vínculo explícito (label, campo, referência a ticket). Sem vínculo = `null` | Idem |

Ambientes que não são `staging`/`production` precisam de mapeamento configurável por organização (ex.: `homolog` → `staging`); ambientes sem mapeamento são ignorados.

### Como calcular `Deployment.changeRequestIds` (evidência)

Este é o campo que decide "em produção". Regra: uma mudança entra em `changeRequestIds` **somente se estiver provado que seu código está contido no `sha` implantado**. Nunca por proximidade de datas ("integrou antes do deploy").

1. A mudança precisa estar `merged` com `mergeCommitSha` conhecido (para squash e rebase, é o commit resultante na branch de destino, não o `headSha`).
2. Para um deploy com `sha = D` no repositório, a mudança é contida se `mergeCommitSha` for **ancestral** de `D` (ou igual). Prova via comparação de commits do provedor (`compare`) ou `git merge-base --is-ancestor` em espelho do repositório mantido pelo backend.
3. Otimização: calcular só o intervalo `(deploy anterior bem-sucedido no mesmo ambiente .. D]` e associar cada commit do intervalo à sua mudança (`mergeCommitSha`, ou PR associado ao commit). Guardar o resultado no deploy. O conector `git-local` já faz isso com tags (ver INGESTION.md).
4. Persistir em `changeRequestIds` apenas mudanças **do mesmo repositório** (o teste de integridade da demo exige isso).
5. Deploys `failure` e `running` também carregam seus ids (servem para marcar a etapa `production` como `blocked`), mas as regras só contam `success` como concluído. Se o status mudar (`running` → `success`), reavaliar sem recomputar ancestralidade.
6. Se a ancestralidade não puder ser provada (SHA desconhecido, histórico reescrito, falha do provedor), **não** incluir a mudança: ela permanece `merged` e o HUD mostra "Nenhum deploy contendo esta mudança foi encontrado". Falso negativo é aceitável; falso positivo não é.

## 4. Componentes da cena

| Componente | Arquivo (`presentation/scene/`) | Responsabilidade | Entradas principais |
|------------|---------------------------------|------------------|---------------------|
| `ForgeCanvas` | `ForgeCanvas.tsx` | Canvas R3F ortográfico (lazy-loaded), tone mapping ACES, sombras só em qualidade alta, `PerformanceMonitor` (rebaixa para "low" e DPR 1), `role="img"` + `aria-label` | `world` e `quality` (stores) |
| `ForgeScene` | `ForgeScene.tsx` | Compõe o mundo a partir dos dados: placar por setor, conjunto de racks em foco, contagens do portão | stores + `useScope`, `useRepoHealth`, `useFigureScripts`, `useEvents` |
| `SectorEntity` | `entities/SectorEntity.tsx` | Plataforma, sinal de piso, parede, quadros, mesas, sala temática, conduítes ligando cada rack ao fundo da sala; clique seleciona squad | `layout: SectorLayout`, `racks`, `figures`, `boards: SectorBoards`, `dimmed` |
| `RackEntity` | `entities/RackEntity.tsx` | Rack: placa, 4 módulos x 2 lâminas, beacon, marcador "!", feedback de hover/seleção/destaque | `layout: RackLayout`, `repo`, `health: RepositoryHealth`, `highlighted`, `dimmed`, `reducedMotion` |
| `FigureEntity` / `RobotBody` | `entities/FigureEntity.tsx` | Androide ilustrativo (cabeça com rosto de LEDs, corpo blindado); aplica `sample()` + `rigPose()` por frame; publica posição em `livePositions` | `layout: FigureLayout`, `person`, `script: CompiledScript`, `dimmed`, `reducedMotion` |
| `NpcBot` | `entities/NpcBot.tsx` | "Forge Bot": NPC (não é contribuidor); patrulha o hub; clique abre a tela de Automações | `world`, `reducedMotion` |
| `AiHubRoom` | `entities/AiHubRoom.tsx` | Hub IA: terminal holográfico, pinball holográfico e cofre de conhecimento (`KnowledgeVault`) | `world`, `reducedMotion` |
| `N8nDesk` | `entities/N8nDesk.tsx` | Mesa de automação (fluxo n8n que chama `npm run ingest`); clique abre a tela de Automações | `position`, `yaw`, `reducedMotion` |
| `FrontsWall`, `CalendarWall`, `WeekBoard`, `CreditPlaque` | `entities/` | Painéis do plaza: Mural de Frentes, calendário de entregas, quadro da semana, placa de créditos | `position`, `reducedMotion` |
| `FlowStreams` | `entities/FlowStreams.tsx` | Trilhas e pulsos (um `InstancedMesh` para todos); cor por tipo de evento | `world`, `events: DeliveryEvent[]`, `focusRepoIds`, `reducedMotion` |
| `ProductionGate` | `entities/ProductionGate.tsx` | Portão de produção e doca de staging com placas de contagem; clicável (`{kind:'gate'}`) | `gate`, `dock`, `productionCount`, `stagingCount`, `reducedMotion` |
| `Desk`, `Board`, `FeatureProp`, `CableTray` | `entities/props.tsx` | Adereços; `CableTray` é um conduíte holográfico no chão, liga cada rack ao fundo da sala; `FeatureProp` escolhe sala por `SectorFeature` | posição `Vec2`, linhas do quadro, `feature` |
| `HoloPanel`, `RepoHologram`, `HoloWall` | `holo/`, `entities/holoWallKit.tsx` | Painéis holográficos planos: repositório (`RepoHologram`), e a base das paredes de frentes e calendário (`HoloWall`); alinhados à grade por `SIGN_YAW` | `position`, conteúdo desenhado em canvas |
| `Box`, `Cylinder`, `Decal`, `useCanvasTexture` | `kit/Part.tsx` | Blocos de construção reutilizáveis | tamanho, material, textura |
| `mat`, `geo` | `kit/materials.ts` | Catálogo de materiais (matte, glow, emissive, glass, rackMetal…) | |
| `makeCanvasTexture`, `FONTS`, `makeFloorTexture`, `makeHatchTexture` | `kit/canvasTexture.ts` | Texturas 2D desenhadas em canvas | |
| `Environment` | `stage/Environment.tsx` | Luzes, névoa, piso, corredor central e plaza | `world`, `shadows` |
| `CameraRig` | `stage/CameraRig.tsx` | `CameraControls`, limites, comandos da UI, enquadramento ciente do inspetor | `world`, `uiStore.camera` |
| `Effects` | `stage/Effects.tsx` | Bloom (só materiais não-tone-mapped) + vinheta; só em qualidade alta | |

Interação 3D: `useInteractive(ref)` devolve `{ hovered, selected, handlers }` e filtra cliques que terminaram um arrasto (`e.delta > 4`).

### HUD (resumo)

- Três arranjos por breakpoint (`HudLayout` escolhe): `PhoneHud` (< 768 px, navegação inferior e folhas), `TabletHud` (768–1279 px, coluna esquerda em gaveta) e `DesktopHud` (≥ 1280 px, layout completo). Detalhes em [RESPONSIVE_SPEC.md](RESPONSIVE_SPEC.md).
- Regiões do desktop: `TopBar`, `KpiStrip`, `LeftColumn`, `MapControls`, `Inspector`, `DeliveryTracking`, `Legend`, `ActivityTabs`, `HoverTooltip`. Overlays: `DeliveryExplorer`, `TableView`, `WelcomeModal`, `TourCoach`.
- **Object Screens** (`hud/objects/`): telas planas e legíveis de objetos 3D interativos (hub, terminal, pinball, automação, quadros de setor, mesa, quadro do time). Padrão em ARCHITECTURE.md, seção 7.
- **Mural de Frentes** (`hud/fronts/`): abas Mural, Roadmap e Alocação, com filtros por squad, status e categoria; cada frente abre o detalhe. **Calendário de entregas** (`CalendarScreen`) agrupa a evidência de entrega por dia.
- Detalhes de cada região em [HUD_SPEC.md](HUD_SPEC.md).

## 5. Estados de interação (`state/uiStore.ts`)

| Estado | Valores | Notas |
|--------|---------|-------|
| `selection` | `EntityRef \| null` (ver tabela de `EntityRef` na seção 2) | `select(ref)` foca a câmera; `select(null)` dispara `back`. Refs de Object Screen abrem a tela do objeto; as demais abrem o inspetor |
| `hover` | `EntityRef \| null` | Só objetos 3D; alimenta `HoverTooltip` e o contorno do objeto |
| `highlightInitiativeId` | `ID \| null` | Destaca racks da iniciativa e esmaece o resto; persiste ao limpar a seleção |
| `trackedCrId` | `ID \| null` | Mudança do card Delivery tracking; selecionar uma `cr` também a define |
| `squadId` / `periodDays` | `ID \| null` / `7\|14\|30` | Escopo global. `setSquad` também comanda a câmera (foco ou visão geral). Racks e personagens fora da squad ficam esmaecidos, mas o mundo mostra sempre todos |
| `viewMode` | `product` \| `engineering` | Troca "Perguntas da semana" por "Saúde técnica" e o nível de detalhe dos inspetores |
| `overlay` | `explorer` \| `table` \| `welcome` \| `null` | Um por vez; boas-vindas abre na primeira visita |
| `tourStep` | `0..5 \| null` | `TourCoach` executa a ação do passo ao mudar |
| `camera` | `focus`, `overview`, `back`, `zoom`, `rotate` + `nonce` | O `nonce` faz comandos idênticos repetidos reexecutarem |
| `reducedMotion` / `quality` | boolean / `high` \| `low` | Inicial: `prefers-reduced-motion`; `low` se largura < 760px; `PerformanceMonitor` pode rebaixar |
| `leftDrawerOpen` | boolean | Gaveta da coluna esquerda no tablet |

Ordem do `Esc`: tour e modais capturam o evento (fase de captura, `stopPropagation`) antes do inspetor; popovers e a busca tratam o próprio `Esc`; o inspetor só fecha se não há overlay nem tour.

`dataStore` guarda o estado de carga (`idle`/`loading`/`ready`/`error`), `snapshot`, `index`, `world`, a fonte atual e as registradas. `uiStore` nunca guarda dados de domínio. `selectors.ts` liga os dois (`useScope`, `useKpis`, `useEvents`, `useRepoHealth`, `useFigureScripts`, que também calcula as rides de deploy de `productionRides`).

**Armazenamento local (`localStorage`):** flag de boas-vindas, notas do quadro do time (`notesStore`, só neste navegador) e recorde do pinball. Nada mais persiste.

## 6. Critérios de teste

### O que os testes automatizados cobrem (`npm test`)

Estado verificado: **26 arquivos de teste, 246 testes, todos passando**.

| Área | Cobertura |
|------|-----------|
| Domínio (`domain/rules`) | Status e timeline de mudanças (merge sem deploy não é produção; deploy falho/rodando não conta; último veredito por revisor; etapas sem evidência não ficam `done`); progresso de frentes (evidência só de tracker ou Git, divergência, declaração sem evidência, prioridade de status) |
| Contratos e queries (`application/`) | Merge de fragmentos e capacidades; validação do snapshot; KPIs, filtros, saúde de repositório, resumos sem nota numérica, calendário e frentes (workstreams) |
| Conectores e ingestão (`infrastructure/`) | Registro e configuração dos conectores; Jira, plan-csv e Confluence com fixtures; regras git (mensagens de merge, tags, tarefas); leitura de snapshot importado |
| Demo (`infrastructure/demo`) | Contagens documentadas, determinismo, ids únicos, integridade referencial, datas dentro de 30 dias, nenhuma URL com `github.com`, frentes e tarefas com evidência de produção |
| Mundo e animação (`presentation/world`, `animation`) | Layout em grade (limites, orientação, sobreposição, proporção); roteiros de rides de deploy; patrulha do Forge Bot; quirks, expressões e rides |
| Estado e HUD puro | Rides de produção (`productionRides`); física do pinball; comandos do terminal |
| Arquitetura (`architecture.test.ts`) | Regra de dependência entre camadas; `world/` e `animation/` sem React/Three |

**Não há** testes de componentes React, de `flowPaths`, da cena (R3F) nem e2e. A verificação visual é manual (ver abaixo).

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

Itens com ✅ já existem na v0.1.0; os demais são **futuros**. Cada história deve caber em um PR pequeno.

### Já entregue na v0.1.0 (referência)

- ✅ Ingestão por conectores: `git-local`, `jira`, `plan-csv`, `confluence`, merge de fragmentos e validação (Épico 3 parcial, Épico 7.2 parcial).
- ✅ Snapshot importado por URL (`?snapshot=`).
- ✅ Regras de frentes com evidência de tracker ou Git (Épico 5 parcial, no nível de frente).
- ✅ Layout em grade com salas em duas fileiras (Épico 8.5 parcial).
- ✅ Layout de telefone com navegação inferior e folhas (Épico 9.2).
- ✅ Hub IA, Forge Bot, Mural de Frentes e calendário de entregas.
- ✅ PWA instalável com cache offline.

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

### Épico 3 — Conector GitHub por API
Hoje o GitHub entra pelo `git-local` (clones locais, mudanças inferidas de merge commits). Falta a versão por API, com dados nativos.
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
5. Divergência Jira × Git: mostrar no Mural de Frentes qual fonte discorda e por quê (hoje só o sinal `divergence`).

### Épico 6 — Conector GitLab
1. OAuth/token de aplicação somente leitura.
2. Mapeamento de MR, pipelines, deployments e approvals (definir regra para `changes_requested`).
3. `ProviderVocabulary` "MR" ponta a ponta (o vocabulário já é lido da fonte; falta o conector).

### Épico 7 — Outros provedores e ligação com produto
1. Bitbucket e Azure Repos (conectores).
2. Iniciativas a partir de Jira ou Azure DevOps como `ProductInitiative` (hoje vínculo por campo ou rótulo; a fonte automática é adiada).
3. Função de contribuidor (`role`) por configuração explícita da organização (já aceita no `forge.config.json`; falta a fonte oficial).

### Épico 8 — Performance da cena
1. Instanciar lâminas/LEDs dos racks (hoje cada lâmina é um conjunto de malhas).
2. Carregar setores sob demanda (lazy) e culling por distância.
3. Compartilhar texturas de placas e atlas de canvas.
4. Orçamento de frames medido em dispositivos de referência; reduzir custo de sombras e bloom.
5. Validar o layout em grade com 10 ou mais squads (hoje as salas se dividem em duas fileiras balanceadas por largura; o alcance ainda não foi medido).

### Épico 9 — Mobile
1. Cena 3D simplificada (sem sombras/bloom, menos detalhes) por padrão em telas pequenas.
2. ✅ HUD de telefone com navegação inferior e folhas (`PhoneHud`).
3. Opção de iniciar direto na visão tabular em dispositivos fracos.

### Épico 10 — Qualidade e plataforma
1. Testes de e2e com Playwright: fluxos 1 e 2 de navegação, tour, visão tabular, fallback sem WebGL, teclado.
2. Testes unitários para `flowPaths` e para o layout do mundo com muitas squads (hoje `world/` e `animation/` têm cobertura parcial).
3. Testes de componentes do HUD (Inspector, Explorer, TableView, Mural de Frentes).
4. i18n (hoje pt-BR fixo; extrair strings).
5. Fontes hospedadas localmente (hoje Google Fonts).
6. Deep links e estado na URL (seleção, squad, período, modo).
7. Auditoria de acessibilidade (leitor de tela na cena, contraste) e navegação por teclado entre racks.
8. Observabilidade do front (erros, métricas de FPS).
9. Automação da ingestão diária (n8n ou job agendado) com alerta quando o snapshot falhar.

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

- **Dados de demonstração ou snapshot diário.** O modo "Conectado" é um stub desabilitado; não há backend, auth nem atualização ao vivo. A demo usa a hora do carregamento como referência, então os dados "rejuvenescem" a cada abertura. Um snapshot importado usa a data em que foi gerado.
- **Frescor.** A ingestão roda como processo externo (CLI, n8n ou job agendado). O app só lê o arquivo publicado e não sabe se o job falhou.
- **Cobertura de testes parcial.** Domínio, queries, conectores, snapshot demo, layout do mundo e partes da animação têm testes. Componentes React, cena e e2e não têm; a verificação visual é manual.
- **Desempenho.** Cada lâmina de rack é composta de várias malhas (só os pulsos de fluxo são instanciados); todos os setores são carregados de uma vez; texturas de canvas por rack/placa. Em celulares fracos a cena pode ficar lenta; o `PerformanceMonitor` só rebaixa a qualidade (não volta a "alta" sozinho).
- **Escala do layout.** As salas se dividem em duas fileiras frente a frente, balanceadas por largura. Muitas squads aumentam a largura do mundo; o limite prático ainda não foi medido.
- **Acessibilidade.** A cena 3D não é navegável por teclado nem lida por leitores de tela; a alternativa é a visão tabular. O fallback sem WebGL mostra só a tabela.
- **Mobile.** A cena 3D continua pesada para celulares fracos. A visão tabular é a alternativa recomendada em aparelhos antigos.
- **Estado efêmero.** Seleção, squad, período e modo não vão para a URL e se perdem ao recarregar. Além da flag de boas-vindas, o `localStorage` guarda só as notas do quadro e o recorde do pinball.
- **Dependência de CDN.** Fontes vêm do Google Fonts (cache offline pelo service worker); sem rede e sem cache o visual cai para fontes do sistema.
- **Tour acoplado à demo.** O tour prefere ids da demo (`sq-admin`, `repo-admin-console-web`) e cai para o primeiro registro quando eles não existem.
- **Temas de setor.** Só 3 temas fixos em `config/world.ts` (ciclados para squads novas); androides com variação determinística por pessoa, sem personalização.
- **Idioma.** Apenas pt-BR.
- **Fonte de verdade de layout.** `docs/HUD_SPEC.md` referencia imagens de um checkout externo (não incluídas aqui por não haver licença de reuso).
