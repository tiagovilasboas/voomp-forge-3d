import type { Stage, StageState } from '@domain/rules/changeRequestProgress';
import { STAGE_LABEL } from './deliveryLabels';

const STATE_TEXT: Record<StageState, string> = {
  done: 'com evidência',
  blocked: 'bloqueado',
  pending: 'sem evidência ainda',
  not_applicable: 'não se aplica',
  unknown: 'fonte não informa',
};

const DOT: Record<StageState, string> = {
  done: 'bg-forge border-forge',
  blocked: 'bg-fail/20 border-fail',
  pending: 'border-idle bg-transparent',
  not_applicable: 'border-dashed border-idle/60 bg-transparent',
  unknown: 'border-dotted border-unknown bg-transparent',
};

/** Six tiny dots, one per stage. Production done turns green. Never marks a stage without evidence. */
export function StageMiniStepper({ stages }: { stages: Stage[] }) {
  const summary = stages.map((s) => `${STAGE_LABEL[s.id]}: ${STATE_TEXT[s.state]}`).join('; ');
  return (
    <div role="img" aria-label={`Etapas da entrega. ${summary}`} className="flex items-center gap-1">
      {stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <span
            title={`${STAGE_LABEL[s.id]} — ${STATE_TEXT[s.state]}`}
            className={`h-2.5 w-2.5 rounded-full border ${s.id === 'production' && s.state === 'done' ? 'border-ok bg-ok' : DOT[s.state]}`}
          />
          {i < stages.length - 1 && <span className="h-px w-2 bg-white/15" />}
        </div>
      ))}
    </div>
  );
}
