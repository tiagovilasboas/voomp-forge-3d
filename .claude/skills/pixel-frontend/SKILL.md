---
name: pixel-frontend
description: >
  Frontend do projeto agents (Next.js + PixiJS), usada pelo senior-staff-fullstack.
  Ativa para tarefas Next.js 16, PixiJS 8, Zustand, XState e integração WebSocket no projeto agents/client.
evidence_level: curated
last_verified: 2026-09-28
---

# Pixel Frontend — projeto agents

## Escopo

Frontend pixel art e real-time do projeto agents. Renderiza o que o server manda. Zero lógica de negócio no client.

## Stack do projeto agents/client

- **Next.js 16** com App Router e Turbopack (`next dev --turbo`)
- **PixiJS 8.19** + **@pixi/react 8.0** — pixel art engine WebGL/Canvas
- **Zustand 5** — estado global (gameStore, preferencesStore, navigationStore)
- **XState 5** + **@xstate/react 6** — state machines para lifecycle dos agents
- **Tailwind CSS v4** — utility classes
- **Vitest** — testes

## Referências curadas

- [PixiJS 8 docs](https://pixijs.com/) — rendering engine oficial
- [Zustand docs](https://github.com/pmndrs/zustand) — stores leves e performáticos
- [XState v5 docs](https://stately.ai/docs) — state machines para arrival/departure
- [Next.js App Router](https://nextjs.org/docs) — SSR, layouts, server components
- [claude-office source](https://github.com/paulrobello/claude-office) — fork original (MIT)

## Estrutura do client (fork claude-office)

```
client/src/
├── app/           ← Next.js App Router (layout, page)
├── components/    ← game/ (PixiJS), layout/, overlay/, navigation/
├── hooks/         ← useWebSocketEvents.ts (PRINCIPAL), useOfficeTextures.ts
├── stores/        ← gameStore (9 slices), preferencesStore, navigationStore
├── systems/       ← animationSystem (RAF), pathfinding (A*), stateReconciler
├── machines/      ← agentMachine, agentArrivalMachine, agentDepartureMachine
└── types/         ← generated.ts (NÃO editar), index.ts
```

## Contrato WebSocket (o que o client espera receber)

```typescript
// WebSocketMessage recebida via useWebSocketEvents.ts
{
  type: "state_update",
  state: GameState,      // ver types/generated.ts
  timestamp: string
}

// GameState (campos críticos)
{
  sessionId: string,
  boss: { state: BossState, currentTask?, bubble? },
  agents: Agent[],       // { id, name, color, number, state, desk, bubble? }
  office: OfficeState,   // { deskCount, elevatorState, phoneState, contextUtilization }
  arrivalQueue: string[],
  departureQueue: string[]
}
```

## Princípios de implementação

1. **Frontend burro de propósito**: só renderiza o que o server manda, zero lógica de negócio
2. **WebSocket é a fonte**: estado vem via `stateReconciler.ts` — não fazer fetch REST para estado
3. **Stores não conhecem UI**: Zustand stores são puro estado, sem imports de componentes
4. **Tipos gerados**: `generated.ts` é auto-gerado do schema Go — nunca editar à mão
5. **Mudança mínima no fork**: adaptar vocabulário Agents, não reescrever o claude-office

## Vocabulário Agents no visual

| claude-office | Agents |
|---------------|-----|
| Boss | Orquestrador (`senior-staff-ai-finops`) |
| Employee | Operador Agents |
| Office | Sala de Operações |
| Session | Missão |

## Ao terminar qualquer tarefa frontend

Sempre rodar:
```bash
cd client && npx tsc --noEmit
```

E registrar no Logseq via skill `logseq-capture`.
