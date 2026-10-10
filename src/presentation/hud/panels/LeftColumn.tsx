import { useUiStore, type ViewMode } from '@presentation/state/uiStore';
import { Card, CardHeader, Segmented } from '@presentation/hud/kit/primitives';
import { WeeklyQuestions } from './left/WeeklyQuestions';
import { TechHealth } from './left/TechHealth';
import { InitiativesCard } from './left/InitiativesCard';
import { FrontsCard } from './left/FrontsCard';

const MODE_EXPLANATION: Record<ViewMode, string> = {
  product: 'Product View: o que foi entregue, o que falta chegar à produção e a que iniciativa cada mudança pertence.',
  engineering: 'Engineering View: pipelines, bloqueios, revisões e commits para quem precisa agir.',
};

export function ModeCard() {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  return (
    <Card label="Modo de visão">
      <CardHeader title="Modo" />
      <div className="space-y-2 px-4 pb-3">
        <Segmented<ViewMode>
          label="Modo de visão"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'product', label: 'Product' },
            { value: 'engineering', label: 'Engineering' },
          ]}
        />
        <p className="text-[11px] leading-snug text-fog">{MODE_EXPLANATION[viewMode]}</p>
        <p className="text-[11px] leading-snug text-fog">
          Personagens são ilustrativos: não indicam presença, carga ou produtividade.
        </p>
      </div>
    </Card>
  );
}

/** Left column: questions (or technical health), initiatives and mode. */
export function LeftColumn() {
  const viewMode = useUiStore((s) => s.viewMode);
  return (
    <div className="scroll-thin flex h-full flex-col gap-3 overflow-y-auto overflow-x-hidden pr-0.5">
      {viewMode === 'product' ? <WeeklyQuestions /> : <TechHealth />}
      {viewMode === 'product' && <FrontsCard />}
      <InitiativesCard />
      <ModeCard />
    </div>
  );
}
