import { useEffect } from 'react';
import { listDeliveries } from '@application/queries/deliveries';
import type { ForgeIndex } from '@application/queries/forgeIndex';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { Card, Eyebrow } from '../kit/primitives';

interface TourStep {
  title: string;
  body: string;
  /** Moves the world to what the step talks about. */
  run: (ctx: TourContext) => void;
}

interface TourContext {
  index: ForgeIndex;
  mostRecentProductionCrId: string | null;
}

const DEMO_SQUAD_ID = 'sq-admin';
const DEMO_REPO_ID = 'repo-admin-console-web';

const ui = () => useUiStore.getState();

/** Prefers the demo ids from the spec, falls back to the first record when the data is different. */
function tourSquadId(index: ForgeIndex) {
  return index.squad.has(DEMO_SQUAD_ID) ? DEMO_SQUAD_ID : (index.snapshot.squads[0]?.id ?? null);
}

function tourRepoId(index: ForgeIndex) {
  if (index.repo.has(DEMO_REPO_ID)) return DEMO_REPO_ID;
  const squadId = tourSquadId(index);
  return (squadId && index.reposBySquad.get(squadId)?.[0]?.id) ?? index.snapshot.repositories[0]?.id ?? null;
}

const STEPS: TourStep[] = [
  {
    title: 'O data center de entregas',
    body: 'Cada setor é uma squad, cada rack é um repositório. A luz que corre pelo chão são eventos reais de integração e deploy.',
    run: () => {
      ui().select(null);
      ui().commandCamera({ type: 'overview' });
    },
  },
  {
    title: 'Escolha uma squad',
    body: 'Ao focar uma squad, os números e painéis passam a mostrar só o que ela construiu e entregou no período.',
    run: ({ index }) => {
      const id = tourSquadId(index);
      if (id) ui().setSquad(id);
    },
  },
  {
    title: 'Abra um rack',
    body: 'O rack mostra a saúde do repositório: mudanças abertas, pipeline, último deploy e commits recentes.',
    run: ({ index }) => {
      const id = tourRepoId(index);
      if (id) ui().select({ kind: 'repo', id });
    },
  },
  {
    title: 'Histórico de uma mudança',
    body: 'Cada mudança tem uma linha do tempo. Uma etapa só aparece como concluída quando existe evidência registrada.',
    run: ({ index }) => {
      const repoId = tourRepoId(index);
      const cr = repoId ? index.crsByRepo.get(repoId)?.[0] : undefined;
      if (cr) ui().select({ kind: 'cr', id: cr.id });
    },
  },
  {
    title: 'Integrado não é em produção',
    body: 'Esta entrega tem deploy em produção confirmado. Uma mudança apenas integrada ainda não chegou aos clientes.',
    run: ({ mostRecentProductionCrId }) => {
      if (mostRecentProductionCrId) ui().select({ kind: 'cr', id: mostRecentProductionCrId });
    },
  },
  {
    title: 'Visão de Produto',
    body: 'Na Product View você acompanha iniciativas e perguntas da semana em linguagem simples, sem precisar saber Git.',
    run: ({ index }) => {
      ui().setViewMode('product');
      ui().select(null);
      ui().highlightInitiative(index.snapshot.initiatives[0]?.id ?? null);
    },
  },
];

const buttonBase = 'focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold';

/** Guided tour card. Mounted once by the HUD layout; renders nothing while the tour is off. */
export function TourCoach() {
  const step = useUiStore((s) => s.tourStep);
  const setStep = useUiStore((s) => s.setTourStep);
  const { index } = useReadyData();
  const scope = useScope();
  const active = step !== null;

  useEffect(() => {
    if (step === null) return;
    const mostRecentProductionCrId = listDeliveries(index, { ...scope, periodDays: 30, squadId: null }, { status: 'production' })[0]?.cr.id ?? null;
    STEPS[step]?.run({ index, mostRecentProductionCrId });
    // The tour reads the scope only to find an example; it must not re-run when the period changes.
  }, [step, index]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setStep(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, setStep]);

  if (step === null || !STEPS[step]) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="absolute inset-x-3 bottom-3 z-40 md:inset-x-auto md:bottom-[88px] md:left-1/2 md:w-[440px] md:-translate-x-1/2">
      <Card label="Tour guiado" className="p-4">
        <Eyebrow>
          Passo {step + 1} de {STEPS.length}
        </Eyebrow>
        <h2 className="mt-1 font-display text-base font-bold text-snow">{current.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-fog" aria-live="polite">
          {current.body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setStep(null)} className={`${buttonBase} text-fog hover:text-snow`}>
            Pular tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className={`${buttonBase} bg-white/[0.07] text-snow hover:bg-white/[0.12]`}>
                Voltar
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => setStep(last ? null : step + 1)}
              className={`${buttonBase} bg-forge font-bold text-ink-950 hover:bg-forge-bright`}
            >
              {last ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
