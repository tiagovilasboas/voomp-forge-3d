import type { Stage, StageId, StageState } from '@domain/rules/changeRequestProgress';
import { Icon } from '@presentation/hud/kit/Icon';

const STAGE_LABEL: Record<StageId, string> = {
  opened: 'Aberto',
  in_review: 'Em revisão',
  approved: 'Aprovado',
  merged: 'Integrado',
  deployed: 'Deploy',
  production: 'Produção',
};

const STATE_TEXT: Record<StageState, string> = {
  done: 'concluído',
  blocked: 'bloqueado',
  pending: 'pendente',
  not_applicable: 'não se aplica',
};

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function circleClass(stage: Stage): string {
  if (stage.state === 'done') return stage.id === 'production' ? 'bg-ok text-ink-950' : 'bg-forge text-ink-950';
  if (stage.state === 'blocked') return 'bg-ink-900 text-fail ring-2 ring-fail';
  if (stage.state === 'not_applicable') return 'border-2 border-dashed border-white/20 text-transparent';
  return 'border-2 border-white/25 text-transparent';
}

/** Horizontal six-step progress of one change request. */
export function StageStepper({ stages }: { stages: Stage[] }) {
  return (
    <ol className="grid grid-cols-6" aria-label="Etapas da entrega">
      {stages.map((stage, i) => (
        <li key={stage.id} className="relative flex flex-col items-center text-center" title={stage.note}>
          {i > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-3 left-[-50%] h-0.5 w-full ${stage.state === 'done' ? 'bg-forge/70' : 'bg-white/10'}`}
            />
          )}
          <span className={`relative z-10 grid h-[26px] w-[26px] place-items-center rounded-full ${circleClass(stage)}`}>
            {stage.state === 'done' && <Icon name="check" size={14} />}
            {stage.state === 'blocked' && <Icon name="alert" size={14} />}
          </span>
          <span className={`mt-1 text-[10px] leading-tight font-semibold ${stage.state === 'done' ? 'text-snow' : 'text-fog'}`}>
            {STAGE_LABEL[stage.id]}
          </span>
          <span className="font-mono text-[10px] text-fog">{stage.at ? shortDate.format(new Date(stage.at)) : '—'}</span>
          <span className="sr-only">{STATE_TEXT[stage.state]}</span>
        </li>
      ))}
    </ol>
  );
}
