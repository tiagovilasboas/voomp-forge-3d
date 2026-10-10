# Voomp Forge

**From Code to Delivery** — Engineering Delivery Intelligence em 3D.

O Voomp Forge transforma dados de entrega de software (mudanças, revisões, pipelines e deploys) em um data center 3D explorável: cada **setor** é uma squad, cada **rack** é um repositório e a luz que corre pelo chão são eventos de integração e deploy. A mesma informação está disponível para Produto, em linguagem simples ("o que chegou em produção?"), e para Engenharia, com evidências (SHA, pipeline, deploy). A regra central: **integrado ≠ em produção** — uma etapa só aparece como concluída quando existe um registro que a comprove.

> **DEMO DATA.** Todos os dados exibidos são **fictícios**, gerados localmente por `src/infrastructure/demo/`. Nenhuma pessoa, repositório ou número representa a Voomp real. O modo "Conectado" ainda não existe (veja [docs/HANDOFF.md](docs/HANDOFF.md)).

## Quickstart

```bash
npm install
npm run dev         # servidor de desenvolvimento (Vite)
npm test            # testes unitários (Vitest)
npm run typecheck   # tsc -b
npm run build       # typecheck + build de produção em dist/
```

## Controles

| Ação | Como |
|------|------|
| Mover o mapa (pan) | Arrastar com o botão esquerdo |
| Girar a visão (limitado) | Arrastar com o botão direito |
| Zoom | Roda do mouse / pinça |
| Inspecionar | Clique em setor, rack, personagem, portão ou item de lista |
| Fechar painel / modal / tour | `Esc` |
| Buscar | `/` foca a busca global (setas + Enter para escolher) |

Também há botões de zoom, giro, visão geral e visão tabular no canto superior direito do mapa.

## O que existe (escopo do MVP)

- **Data center 3D** isométrico: setores (squads), racks (repositórios) com 4 módulos (mudanças, pipeline, deploy, commits), personagens ilustrativos, quadros de dados, fluxos de luz por tipo de evento, doca de staging e portão de produção.
- **Inspetor** por entidade: squad, repositório, pessoa, mudança (PR/MR) com linha do tempo de 6 etapas, iniciativa.
- **Product View** e **Engineering View**: perguntas da semana / saúde técnica, iniciativas, linguagem do provedor (PR vs MR).
- **Delivery Explorer**: filtros (squad, repositório, status, iniciativa, ambiente, período, texto) e cards com evidências.
- **Delivery tracking**: stepper horizontal das 6 etapas de uma mudança.
- **KPIs**, abas de atividade (entregas, revisões, pipelines, deploys), alertas e busca global.
- **Tour guiado** de 6 passos e modal de boas-vindas.
- **Visão tabular** acessível (mesmos dados, sem 3D) e fallback automático quando não há WebGL.
- **Movimento reduzido** e qualidade gráfica (Alta/Leve, com redução automática em dispositivos fracos).

Fora do MVP (não implementado): modo conectado, backend, autenticação, agentes de IA, RAG, rankings de pessoas. Veja o backlog em [docs/HANDOFF.md](docs/HANDOFF.md).

## Stack

React 19 · TypeScript · Vite · React Three Fiber + drei + postprocessing (Three.js) · Zustand · Tailwind CSS 4 · Vitest.

## Estrutura

```
src/
├─ domain/          entidades e regras de evidência (sem dependências)
├─ application/     porta DeliveryDataSource + queries (KPIs, filtros, resumos)
├─ infrastructure/  demo/ (dados fictícios) e remote/ (cliente do backend, desativado)
├─ config/          temas dos setores e parâmetros de layout
└─ presentation/    state, world (layout puro), animation (pura), scene (R3F), hud (React)
```

Regras de dependência e fluxo de dados: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentação

- [docs/DESIGN.md](docs/DESIGN.md) — design de produto e visual (Etapa A)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas e fluxo de dados
- [docs/HUD_SPEC.md](docs/HUD_SPEC.md) — especificação das regiões do HUD
- [docs/HANDOFF.md](docs/HANDOFF.md) — handoff de engenharia, testes e backlog (Etapa C)
- [CONTRIBUTING.md](CONTRIBUTING.md) — commits e checagens antes do push

---

Inspirado na experiência do WareTrack (siddik-web/waretrack) — nenhum código ou asset reaproveitado.
