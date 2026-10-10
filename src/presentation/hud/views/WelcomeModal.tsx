import { useMemo } from 'react';
import type { Squad } from '@domain/entities';
import { useReadyData } from '../../state/dataStore';
import { useRepoHealth } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { SIGNAL_LOOK } from '../../theme';
import { Icon } from '../kit/Icon';
import { Chip, StatusBadge } from '../kit/primitives';
import { ModalShell } from './ModalShell';
import { useIsDemo } from './viewHooks';

export { TourCoach } from './TourCoach';

const READING_GUIDE = [
  ['Setor', 'uma squad'],
  ['Rack', 'um repositório'],
  ['Personagem', 'uma pessoa (ilustrativo)'],
  ['Fluxo de luz', 'um evento de integração ou deploy'],
  ['Portão', 'produção confirmada'],
] as const;

function SquadCard({ squad, onPick }: { squad: Squad; onPick: () => void }) {
  const { index } = useReadyData();
  const health = useRepoHealth();
  const repos = index.reposBySquad.get(squad.id) ?? [];
  const people = index.peopleBySquad.get(squad.id) ?? [];
  const alerts = repos.filter((r) => health.get(r.id)?.alert).length;
  const look = alerts ? { ...SIGNAL_LOOK.error, label: `${alerts} com alerta` } : { ...SIGNAL_LOOK.success, label: 'Sem alertas' };

  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Explorar squad ${squad.name}`}
      className="focus-ring flex w-full flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left transition hover:border-forge/50 hover:bg-white/[0.06]"
    >
      <Chip tone="forge">SQ-{squad.code}</Chip>
      <span className="font-display text-sm font-bold text-snow">{squad.name}</span>
      <span className="text-xs leading-snug text-fog">{squad.description}</span>
      <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <Chip>{repos.length} repositórios</Chip>
        <Chip>{people.length} pessoas</Chip>
        <StatusBadge look={look} />
      </span>
    </button>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <h3 className="font-display text-[13px] font-semibold text-snow">{title}</h3>
      <div className="mt-1.5 text-xs leading-relaxed text-fog">{children}</div>
    </section>
  );
}

export function WelcomeModal() {
  const { snapshot } = useReadyData();
  const isDemo = useIsDemo();
  const openOverlay = useUiStore((s) => s.openOverlay);
  const setSquad = useUiStore((s) => s.setSquad);
  const setTourStep = useUiStore((s) => s.setTourStep);
  const squads = useMemo(() => snapshot.squads, [snapshot]);
  const close = () => openOverlay(null);

  return (
    <ModalShell
      title="Voomp Forge"
      subtitle="From Code to Delivery — veja o que as squads constroem, integram e entregam."
      badges={isDemo ? <Chip tone="demo">DEMO DATA</Chip> : undefined}
      onClose={close}
      closeLabel="Fechar boas-vindas"
      className="h-auto max-w-4xl"
    >
      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
        {isDemo && <p className="text-xs text-warn">Dados fictícios de demonstração. Nenhum dado real da Voomp.</p>}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forge/30 bg-forge/10 p-4">
          <div>
            <h3 className="font-display text-sm font-bold text-snow">Primeira vez aqui? Faça o tour guiado</h3>
            <p className="text-xs text-fog">Seis passos, cerca de dois minutos, para ler o data center sem precisar saber Git.</p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={() => {
              setTourStep(0);
              close();
            }}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-forge px-4 py-2 text-sm font-bold text-ink-950 transition hover:bg-forge-bright"
          >
            <Icon name="play" size={14} />
            Iniciar tour
          </button>
        </section>

        <section aria-label="Squads">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {squads.map((s) => (
              <li key={s.id} className="flex">
                <SquadCard
                  squad={s}
                  onPick={() => {
                    setSquad(s.id);
                    close();
                  }}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InfoBox title="Como ler o data center">
            <ul className="space-y-0.5">
              {READING_GUIDE.map(([term, meaning]) => (
                <li key={term}>
                  <strong className="font-semibold text-snow">{term}</strong> = {meaning}
                </li>
              ))}
            </ul>
          </InfoBox>
          <InfoBox title="Integrado ≠ Em produção">
            Uma mudança integrada já foi aprovada e unida ao código principal, mas só chega aos clientes depois de um deploy em produção. A Forge só marca uma etapa como concluída quando existe evidência registrada.
          </InfoBox>
        </div>
      </div>
    </ModalShell>
  );
}
