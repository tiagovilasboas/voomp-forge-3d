import type { Stage } from '@domain/rules/changeRequestProgress';
import { Icon } from '../../kit/Icon';
import { dateTime } from '../../kit/format';
import { STAGE_LABEL } from '../../views/deliveryLabels';

function Marker({ stage }: { stage: Stage }) {
  const base = 'grid h-[22px] w-[22px] place-items-center rounded-full border-2';
  if (stage.state === 'done') {
    const tone = stage.id === 'production' ? 'border-ok bg-ok text-ink-950' : 'border-forge bg-forge text-ink-950';
    return (
      <span className={`${base} ${tone}`}>
        <Icon name="check" size={12} />
      </span>
    );
  }
  if (stage.state === 'blocked') {
    return (
      <span className={`${base} border-fail bg-fail/15 text-fail`}>
        <Icon name="alert" size={12} />
      </span>
    );
  }
  if (stage.state === 'unknown') {
    return (
      <span className={`${base} border-dotted border-unknown text-unknown`} title="A fonte de dados não informa esta etapa">
        <Icon name="help" size={12} />
      </span>
    );
  }
  return <span className={`${base} ${stage.state === 'not_applicable' ? 'border-dashed border-idle/60' : 'border-idle'} bg-transparent`} />;
}

const STATE_TEXT = {
  done: 'Concluído',
  blocked: 'Bloqueado',
  pending: 'Sem evidência ainda',
  not_applicable: 'Não se aplica',
  unknown: 'Fonte não informa',
} as const;

/** Vertical timeline of the six delivery stages. A stage is only "done" when the evidence rule says so. */
export function StageTimeline({ stages }: { stages: Stage[] }) {
  return (
    <ol className="px-4 pt-1 pb-1" aria-label="Etapas da entrega">
      {stages.map((stage, i) => (
        <li key={stage.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Marker stage={stage} />
            {i < stages.length - 1 && <span className={`my-0.5 w-px flex-1 ${stage.state === 'done' ? 'bg-forge/50' : 'bg-white/10'}`} />}
          </div>
          <div className="min-w-0 flex-1 pb-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-xs font-semibold ${stage.state === 'pending' || stage.state === 'not_applicable' || stage.state === 'unknown' ? 'text-fog' : 'text-snow'}`}>
                {STAGE_LABEL[stage.id]}
                <span className="sr-only"> — {STATE_TEXT[stage.state]}</span>
              </span>
              <span className="font-mono text-[10px] text-fog">{stage.at ? dateTime(stage.at) : '—'}</span>
            </div>
            <p className={`text-[11px] leading-snug ${stage.state === 'blocked' ? 'text-fail' : 'text-fog'}`}>
              {stage.state === 'pending' ? `Sem evidência ainda. ${stage.note}` : stage.note}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
