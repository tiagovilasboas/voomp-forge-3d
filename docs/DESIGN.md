# Voomp Forge — Design de produto e visual (Etapa A)

Este documento descreve **o que existe hoje** no protótipo (dados de demonstração). Itens futuros estão marcados como tal. Termos de código ficam em inglês.

## 1. Estrutura da experiência

O produto é um único "mundo" 3D com um HUD sobreposto. Não há rotas: tudo é estado (`uiStore`).

| Camada | O que é | Onde |
|--------|---------|------|
| Mundo 3D | Data center isométrico: setores, racks, personagens, fluxos, portão | `presentation/scene/` |
| HUD | Cards flutuantes sobre o mundo (barra, KPIs, listas, inspetor, atividade) | `presentation/hud/HudLayout.tsx` |
| Overlays | Modais: Delivery Explorer, Visão tabular, Boas-vindas | `presentation/hud/views/` |
| Tour | Card guiado de 6 passos que comanda câmera e seleção | `views/TourCoach.tsx` |

Dois modos de leitura (`ViewMode`), mesma cena e mesmos dados:

- **Product View** (padrão): perguntas da semana em linguagem simples, iniciativas, sem SHA.
- **Engineering View**: troca "Perguntas da semana" por "Saúde técnica" (pipeline falhando, mudanças bloqueadas, sem dados de pipeline, sem atividade) e mostra SHA, revisões, pipelines e deploys no inspetor.

Primeira visita: o modal de boas-vindas abre sozinho (flag `voomp-forge.welcome-seen` no `localStorage`; se o storage falhar, ele apenas reaparece).

## 2. Layout da tela

Regiões posicionadas por `HudLayout.tsx` (o overlay ignora o ponteiro; só os cards o capturam, então o mundo continua explorável entre painéis):

```
┌ TopBar (h 52) ─────────────────────────────────────────────────────────┐
│ logo · squad · DEMO DATA · 7d/14d/30d · Product|Eng · busca · 🔔 ⚙ · [Delivery Explorer]
├────────────────────────────────────────────────────────────────────────┤
│ KpiStrip (5 cards)                                   [MapControls] [Inspector]
│ ┌ LeftColumn (272px, ≥ lg) ┐                                     (quando há
│ │ Perguntas da semana /    │                                      seleção)
│ │   Saúde técnica          │              Mundo 3D
│ │ Iniciativas              │          (tela inteira, atrás)
│ │ Modo                     │
│ └──────────────────────────┘
│ DeliveryTracking (≥ md)      Legend (≥ xl)        ActivityTabs (≥ md, sem seleção)
└────────────────────────────────────────────────────────────────────────┘
```

Responsividade: abaixo de `lg` a coluna esquerda some; abaixo de `md` somem MapControls, DeliveryTracking e ActivityTabs, e o Inspector vira uma folha na base da tela (`max-h-[62vh]`). Com um item selecionado o `ActivityTabs` é substituído pelo `Inspector` e o `MapControls` desloca-se para a esquerda dele.

### Mapeamento para a referência WareTrack

| Região no Forge | Equivalente WareTrack | Re-propósito |
|-----------------|-----------------------|--------------|
| TopBar: seletor de squad | Seletor de site | Escopo por squad ("N repositórios · M pessoas") |
| TopBar: pílula DEMO DATA + fonte | Pílula "Shift" | Origem e frescor do snapshot; "Conectado" desabilitado |
| TopBar: 7d/14d/30d | Controle de velocidade | Período global de KPIs, cena e painéis |
| TopBar: Product/Engineering | Botões Town/Build | Modo de leitura |
| TopBar: botão laranja | "Call truck" | Abre o Delivery Explorer |
| KpiStrip | Cards de KPI | PRs integrados, aguardando revisão, falhas de pipeline, deploys em produção, entregas c/ iniciativa |
| LeftColumn: Perguntas da semana | Shift goals | Perguntas de negócio que abrem o Explorer pré-filtrado |
| LeftColumn: Iniciativas | Missions | Barra = em produção / total |
| LeftColumn: Modo | Actions | Alternar modo + aviso sobre personagens |
| Inspector (direita) | Inspector | Squad, repo, pessoa, mudança, iniciativa |
| MapControls | Pilha de zoom | Zoom, girar, visão geral, tabela |
| ActivityTabs | Orders/Docks/Forklifts/Trucks | Entregas, Revisões, Pipelines, Deploys |
| DeliveryTracking | Shipment tracking | Stepper das 6 etapas de uma mudança |
| Welcome + Tour | Site-select + training | Escolha de squad e tour de 6 passos |

Reprodução fiel da **disposição**, não de código nem assets (ver README).

## 3. Sistema de design

Fonte da verdade: tokens `@theme` em `src/index.css` (Tailwind 4) e `PALETTE` em `src/presentation/theme.ts` (a cena usa hex; o HUD usa tokens). Componentes usam nomes de token, nunca hex cru.

### Paleta

| Hex | Token | Uso |
|-----|-------|-----|
| `#090B10` | `ink-950` | Fundo da página e da cena, névoa |
| `#13161C` | `ink-900` | Base dos `hud-card` (86% + blur) |
| `#1A1E26` | `ink-800` | Superfícies elevadas |
| `#242932` | `ink-700` | Divisórias, controles |
| `#323844` | `ink-600` | Trilhos e scrollbar |
| `#4A5160` | `ink-500` | Detalhes de baixo contraste |
| `#F5F5F5` | `snow` | Texto principal |
| `#9DA3AE` | `fog` | Texto secundário e meta (11px) |
| `#FF6A00` | `forge` | Marca, CTA, atividade, etapas concluídas, "integrado" |
| `#FF8C32` | `forge-bright` | Hover, foco (`focus-ring`), seleção, texto laranja |
| `#34C88A` | `ok` | Sucesso, produção confirmada |
| `#EF5350` | `fail` | Erro, bloqueio, alerta |
| `#F6B94D` | `warn` | Atenção, staging, DEMO DATA |
| `#6B7280` | `idle` | Sem atividade, rascunho, fechado |
| `#8B8FB8` | `unknown` | Sem dados |

`ink-800/600/500` existem só como tokens do HUD (não estão em `PALETTE`).

### Tipografia

| Papel | Família | Uso |
|-------|---------|-----|
| Display | Space Grotesk (500–700) | Títulos de card (13px semibold), números (KPI 22px), nome do inspetor (18px) |
| Corpo | Inter (400–700) | Texto 12–13px; meta 11px em `fog` |
| Mono | JetBrains Mono (400/600) | Eyebrows em caixa-alta, SHA, rótulos tabulares; também nas placas desenhadas na cena |

As fontes vêm do Google Fonts (`@import` em `index.css`); sem rede, caem para `system-ui`/`ui-monospace`.

### Anatomia do card HUD

Utilitário `hud-card`: fundo `ink-900` 86% translúcido, borda `snow` 8%, raio 14px, sombra profunda + brilho interno de 1px, `backdrop-filter: blur(14px) saturate(1.2)`. Estrutura padrão (`hud/kit/primitives.tsx`): `Card` → `CardHeader` (título 13px display + ação opcional) → conteúdo com `SectionLabel`/`Eyebrow` (mono, caixa-alta). Blocos reutilizáveis: `StatusBadge`, `Chip` (neutral/forge/demo), `StatTile`, `IconButton`, `Segmented`, `EmptyState`, `ProgressBar`. Entrada com `animate-panel-in` (220 ms). Foco visível via `focus-ring` (contorno 2px `forge-bright`).

### Linguagem de status (nunca só cor)

Todo estado é **ícone + rótulo + cor** (`theme.ts`, tipo `Look`).

`SIGNAL_LOOK` — sinais de repositório e módulos de rack:

| Signal | Rótulo | Ícone | Cor |
|--------|--------|-------|-----|
| `active` | Atividade recente | `pulse` | forge |
| `success` | Sucesso confirmado | `check` | ok |
| `attention` | Atenção | `clock` | warn |
| `error` | Erro ou bloqueio | `alert` | fail |
| `idle` | Sem atividade recente | `moon` | idle |
| `unknown` | Sem dados | `help` | unknown |

`STATUS_LOOK` — status de entrega (`DeliveryStatus`):

| Status | Rótulo | Ícone | Cor |
|--------|--------|-------|-----|
| `in_production` | Em produção | `rocket` | ok |
| `in_staging` | Em staging | `flask` | warn |
| `merged` | Integrado · sem deploy | `merge` | forge-bright |
| `approved` | Aprovado | `check` | forge-bright |
| `awaiting_review` | Aguardando revisão | `eye` | warn |
| `changes_requested` | Ajustes solicitados | `alert` | fail |
| `ci_failed` | Pipeline falhou | `alert` | fail |
| `draft` | Rascunho | `draft` | idle |
| `closed` | Fechado sem integrar | `x` | idle |

Na cena, onde não cabe texto, o sinal é redundante: beacon + marcador "!" para alertas, módulos com LED e a Legend sempre visível no HUD (≥ xl) ou a visão tabular com rótulos.

## 4. Data center

Layout calculado por `world/buildWorld.ts` a partir dos dados (squads, repositórios, pessoas); `config/world.ts` só define aparência e parâmetros. Adicionar uma squad ou repositório nos dados adiciona um setor ou rack sem tocar na cena.

### Setores = squads

Plataforma elevada (0,14) com largura `max(17, racks×2,8+8, mesas×2,6+9)` e profundidade 15; sinal pintado no chão (`SETOR B · tagline`), faixa hachurada na borda frontal, trilhas luminosas na cor de destaque do setor, parede de fundo com **dois quadros**: "Mudanças" (abertas, aguardando revisão, bloqueadas) e "Entregas" (em produção, em staging, integradas sem deploy). Clicar no piso do setor seleciona a squad.

Sala temática por setor (`SectorTheme.feature`; squad sem tema recebe o próximo do ciclo):

| Squad (demo) | Feature | Cena |
|--------------|---------|------|
| A · Admin (`sq-admin`) | `coordination-desk` | Balcão de coordenação com tela de vidro |
| B · Sustentação N3 (`sq-n3`) | `monitoring-room` | Sala de vidro com parede de gráficos de monitoramento |
| C · Enablement (`sq-enable`) | `architecture-room` | Sala de vidro com holograma em wireframe rotativo |

### Racks = repositórios

Cada rack tem placa com nome, linguagem e branch padrão, e **4 módulos de 2 lâminas**, de cima para baixo:

| Módulo | Sinal mostra | Regra (`repositoryHealth`) |
|--------|--------------|----------------------------|
| `changes` | Mudanças abertas | error se há bloqueada (CI falhou / ajustes); attention se aguarda revisão; active se há abertas; idle se sem atividade no período; senão success |
| `pipeline` | Último pipeline da branch padrão | success / error / active (rodando) / idle (cancelado) / unknown (sem dados) |
| `deploy` | Último deploy | error se falhou; active se rodando; success se produção; attention se staging; unknown se nenhum |
| `commits` | Commits no período | active se houve, senão idle |

**Beacon** no topo: vermelho piscante = alerta (pipeline com erro, mudança bloqueada ou deploy falho) e marcador "!" flutuante; laranja pulsante = atividade nas últimas 48 h; cinza = sem atividade no período; verde = saudável e sem atividade recente. Hover/seleção/destaque de iniciativa desenham contorno e anel no chão; racks fora do foco ficam esmaecidos.

### Mesas, quadros e corredor

- **Mesas** (uma por pessoa da squad): estação em pé com monitor mostrando código decorativo. Não indicam presença.
- **Cable trays**: calhas luminosas ligando cada rack à parede de fundo (decoração).
- **Corredor** compartilhado em frente aos setores: a "linha principal de integração".
- **Doca de staging** (esquerda) e **Portão de produção** (direita), à frente do corredor. As placas mostram contagens de deploys bem-sucedidos no período (`STAGING` / `PRODUÇÃO`). O feixe do portão só acende quando há deploy de produção confirmado. O portão é clicável (inspetor "Portão de produção").

### Fluxos de luz

Um fluxo por par (repositório, tipo de evento): pulsos instanciados percorrendo uma trilha do rack até o destino; eventos repetidos não duplicam trilhas.

| Evento | Cor | Destino |
|--------|-----|---------|
| `merged` | forge (laranja) | Corredor (linha principal) |
| `deployed_staging` | warn (amarelo) | Doca de staging |
| `deployed_production` | ok (verde) | Portão de produção |
| `pipeline_failed` | fail (vermelho) | Não viaja: fica como alerta no rack |

Com um rack, mudança ou iniciativa em foco, os demais fluxos esmaecem.

## 5. Personagens

**Anatomia:** figura de blocos (pernas, quadril, torso, braços, pescoço, cabeça arredondada, cabelo, olhos) com tom de pele e cabelo derivados do `id` (determinístico). A cena só mapeia ângulos do rig sobre as malhas; a pose vem de `animation/`.

**Roupa por função** (`OUTFITS` em `FigureEntity.tsx`):

| Função | Camisa / detalhe | Dispositivo |
|--------|------------------|-------------|
| `developer` | Grafite, faixa laranja | Laptop |
| `reviewer` | Azul-acinzentado, faixa laranja clara | Tablet |
| `tech-lead` | Preto, faixa amarela + marcador amarelo na cabeça | Tablet |
| `product-manager` | Clara (areia), faixa laranja | Cartão |
| **desconhecida** (`role: null`) | **Cinza neutro, sem dispositivo** | Nenhum |

A função só vem de fonte autorizada (`Contributor.role`, nunca inferida da atividade). Sem função, a figura é neutra e o inspetor mostra "Função não informada".

**Ações** (`animation/script.ts`) e o que representam:

| Ação | Quando aparece | Significado |
|------|----------------|-------------|
| `type` | Início do ciclo | Trabalho na mesa (decorativo) |
| `walk` | Entre mesa e destino | Deslocamento ilustrativo |
| `inspect` | Pessoa tem mudança **aberta** de sua autoria: vai ao rack dela | "Há trabalho dela neste repositório" |
| `tablet` | Revisou mudanças no período (vai ao rack); `tech-lead` vai ao quadro de Mudanças | "Participou de revisão neste repositório" |
| `present` | `product-manager` vai ao quadro de Entregas | Leitura do quadro de entregas |
| `celebrate` | Participou de entrega que chegou à produção nos últimos 7 dias | Entrega confirmada em produção |
| `idle` | Fim do ciclo | Pausa na mesa |

**Regra:** a animação reflete **onde** houve trabalho no período (derivado de `personSummary`), **nunca** presença, carga ou desempenho. Quem está "andando" não está "online"; quem não anda não está "ocioso". Sem ranking, sem nota numérica. O aviso aparece no card "Modo" ("Personagens são ilustrativos…") e no inspetor de pessoa. Cada figura tem um deslocamento de fase determinístico para não se mover em sincronia.

## 6. Câmera

Câmera **ortográfica isométrica** (`CameraControls` do drei), configurada em `scene/stage/CameraRig.tsx`.

| Parâmetro | Valor |
|-----------|-------|
| Azimute | 0,62 rad ± 0,75 (limitado) |
| Polar | 0,98 rad (−0,25 / +0,12) |
| Zoom | 5 a 140; ajuste de enquadramento 4 a 120 |
| Limite de movimento | Caixa dos `world.bounds` |
| Mouse | Esquerdo = pan; direito = girar (limitado); roda = zoom (em direção ao cursor); meio = nada |
| Toque | 1 dedo = pan; 2 dedos = zoom + pan; 3 dedos = girar |

Comandos (`CameraCommand`, via `uiStore.commandCamera`): `focus` (entidade), `overview`, `back`, `zoom`, `rotate`.

- **focus:** squad → setor; repo → rack; person → posição ao vivo da figura (`livePositions`); cr → rack do repositório da mudança; initiative → enquadra todos os racks tocados pela iniciativa; gate → portão + doca.
- **back:** ao fechar o inspetor, volta ao estado salvo antes do primeiro foco (alvo, zoom, azimute).
- **overview:** reseta ângulo e enquadra todo o mundo. Escolher "Todas as squads" também aciona.
- **Ciente do inspetor:** com o painel aberto e tela > 900px, o alvo é deslocado para ficar na área livre à esquerda dele, e o zoom considera a largura útil.
- **Movimento reduzido:** sem animação de câmera (`smoothTime` 0 e movimentos instantâneos).

## 7. Mapeamento semântico

| Objeto 3D / HUD | Entidade | Observação |
|-----------------|----------|------------|
| Setor (plataforma) | `Squad` | Código `SQ-A`… e tema por squad |
| Rack | `Repository` | 4 módulos = saúde derivada |
| Módulo `changes` | `ChangeRequest` abertas | Rótulo "N abertas · M aguardando revisão" |
| Módulo `pipeline` | `PipelineRun` mais recente na branch padrão | |
| Módulo `deploy` | `Deployment` mais recente | |
| Módulo `commits` | `Commit` no período | |
| Beacon | `RepositoryHealth` (`alert`, `hot`, `idle`) | |
| Personagem | `Contributor` | Ilustrativo |
| Mesa | Pessoa da squad | Decorativa |
| Quadro "Mudanças" | `ChangeRequest` da squad por estado | |
| Quadro "Entregas" | `Delivery` por grupo de status | |
| Corredor | Linha principal de integração | |
| Fluxo laranja | Evento `merged` | |
| Doca de staging | `Deployment` com `environment: staging` bem-sucedido | |
| Portão de produção | `Deployment` com `environment: production` bem-sucedido | |
| Linha do tempo (6 etapas) | `ChangeRequest` + evidências | `Stage` de `domain/rules` |
| Iniciativa | `ProductInitiative` | Racks destacados + barra de progresso |

## 8. Fluxos de navegação

1. **Visão geral → squad → rack → linha do tempo da mudança.** Clicar num setor (ou escolher a squad na barra) foca a câmera e abre o inspetor da squad; clicar num rack abre o inspetor do repositório (módulos, últimos commits, mudanças recentes, último deploy); clicar numa mudança abre a linha do tempo vertical das 6 etapas (`opened`, `in_review`, `approved`, `merged`, `deployed`, `production`) com evidências (data, nota, link). Esc volta um nível de contexto (fecha o painel e restaura a câmera).
2. **Product View → Delivery Explorer → linha do tempo, em ≤ 3 cliques.** (1) Clique em uma pergunta da semana (ex.: "O que ainda não chegou à produção?"); (2) o Explorer abre pré-filtrado, clique no card da entrega; (3) o inspetor mostra a linha do tempo. O Explorer fecha ao selecionar. Alternativa: botão "Delivery Explorer" na barra, ou busca global (`/`).
3. **Destaque de iniciativa.** Clicar numa iniciativa na coluna esquerda seleciona e mantém `highlightInitiativeId`: os racks tocados ficam destacados, os demais e seus fluxos esmaecem, e a câmera enquadra o grupo.
4. **Delivery tracking.** "Acompanhar" numa linha de atividade ou no inspetor da mudança define `trackedCrId`; o card inferior mostra o stepper de 6 etapas e atalhos "Ver no mapa" e "Detalhes".
5. **Tour guiado (6 passos).**

| # | Título | O que faz |
|---|--------|-----------|
| 1 | O data center de entregas | Limpa seleção, câmera em visão geral |
| 2 | Escolha uma squad | `setSquad` (usa `sq-admin`; senão a primeira squad) |
| 3 | Abra um rack | Seleciona `repo-admin-console-web` (fallback: primeiro repo da squad) |
| 4 | Histórico de uma mudança | Seleciona a mudança mais recente do repo |
| 5 | Integrado não é em produção | Seleciona a entrega em produção mais recente (30 dias) |
| 6 | Visão de Produto | Product View, limpa seleção, destaca a primeira iniciativa |

Botões "Pular tour", "Voltar", "Próximo"/"Concluir"; `Esc` encerra.

## 9. Acessibilidade

| Tema | Implementação |
|------|---------------|
| Alternativa ao 3D | **Visão tabular** (`TableView`): abas Squads, Repositórios, Entregas, Pessoas, Iniciativas; `<table>` semântica com `<caption>`, `scope`, colunas ordenáveis (`aria-sort`), filtros de período e squad, botão "Abrir" por linha. Acessível pela barra de configurações, MapControls ou Legend |
| Sem WebGL | `App.tsx` detecta `webgl2/webgl`; sem suporte, renderiza a visão tabular embutida com aviso e os mesmos dados |
| Teclado | `/` busca; setas + Enter nos resultados; `Esc` fecha popovers, modais, tour e inspetor (modal captura o Esc para não fechar o inspetor atrás); controles com `focus-ring`; ao selecionar, o foco vai ao primeiro controle do inspetor; modais movem o foco para dentro |
| Cor | Status sempre com ícone + rótulo; legenda no HUD |
| Movimento reduzido | Respeita `prefers-reduced-motion` (inicializa a configuração) e há toggle em Configurações: sem animações de câmera, personagens parados na mesa, fluxos e beacons estáticos; CSS reduz transições a 1 ms |
| Leitores de tela | `<canvas>` com `role="img"` e `aria-label` que remete à visão tabular; cards com `aria-label`; tour com `aria-live`; **o conteúdo 3D em si não é navegável por teclado** |
| Mobile | Qualidade inicia em "Leve" se a largura < 760px; gestos de toque na câmera; inspetor como folha inferior; barra superior esconde itens por prioridade. A cena 3D continua pesada para celulares fracos (ver limitações no HANDOFF) |
| Linguagem | Copy em pt-BR, sem jargão de Git para Produto; vocabulário do provedor (PR/MR) via `snapshot.source.provider.vocabulary` |
