import { useEffect, useRef, useState } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { useKpis } from '@presentation/state/selectors';
import type { IconName } from '@presentation/theme';
import { Icon } from '@presentation/hud/kit/Icon';

/** True for a moment after `value` changes: feedback that a filter was applied. */
function useFlashOnChange(value: number): boolean {
  const previous = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [value]);
  return flash;
}

interface KpiCardProps {
  icon: IconName;
  label: string;
  value: number;
  hint: string;
  title: string;
  tone?: 'neutral' | 'fail' | 'ok';
}

const TONE = { neutral: 'text-snow', fail: 'text-fail', ok: 'text-ok' } as const;

function KpiCard({ icon, label, value, hint, title, tone = 'neutral' }: KpiCardProps) {
  const flash = useFlashOnChange(value);
  return (
    <article
      title={title}
      className={`hud-card flex w-[168px] shrink-0 cursor-help items-center gap-2.5 px-3 py-2 transition-colors duration-500 ${flash ? 'border-forge/70 bg-forge/10' : ''}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-fog">
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[11px] text-fog">{label}</div>
        <div className={`font-display text-[22px] font-semibold ${TONE[tone]}`}>{value}</div>
        <div className="truncate text-[11px] text-fog">{hint}</div>
      </div>
    </article>
  );
}

/** Headline indicators for the current period and squad. */
export function KpiStrip() {
  const { snapshot, index } = useReadyData();
  const kpis = useKpis();
  const periodDays = useUiStore((s) => s.periodDays);
  const squadId = useUiStore((s) => s.squadId);
  const short = snapshot.source.provider.vocabulary.changeRequestShort;
  const long = snapshot.source.provider.vocabulary.changeRequest;

  const squadName = squadId ? index.squad.get(squadId)?.name : null;
  const hint = `últimos ${periodDays} dias${squadName ? ` · ${squadName}` : ''}`;

  return (
    <div role="list" aria-label="Indicadores" className="scroll-thin flex gap-2 overflow-x-auto pb-1">
      <div role="listitem">
        <KpiCard
          icon="merge"
          label={`${short}s integrados`}
          value={kpis.merged}
          hint={hint}
          title={`${long}s integrados à branch principal no período. Integrado não significa em produção: o deploy é confirmado à parte.`}
        />
      </div>
      <div role="listitem">
        <KpiCard
          icon="eye"
          label="Aguardando revisão"
          value={kpis.awaitingReview}
          hint={hint}
          title={`${long}s abertos que ainda esperam uma primeira revisão ou aprovação.`}
        />
      </div>
      <div role="listitem">
        <KpiCard
          icon="alert"
          label="Falhas de pipeline"
          value={kpis.pipelineFailures}
          hint={hint}
          tone={kpis.pipelineFailures > 0 ? 'fail' : 'neutral'}
          title="Execuções de pipeline que terminaram com falha no período. Falhas bloqueiam a integração ou o deploy."
        />
      </div>
      <div role="listitem">
        <KpiCard
          icon="rocket"
          label="Deploys em produção"
          value={kpis.productionDeploys}
          hint={hint}
          tone="ok"
          title="Deploys em produção concluídos com sucesso no período: é isso que prova que a mudança chegou ao cliente."
        />
      </div>
      <div role="listitem">
        <KpiCard
          icon="target"
          label="Entregas c/ iniciativa"
          value={kpis.initiativeDeliveries}
          hint={hint}
          title="Mudanças integradas que têm vínculo explícito com uma iniciativa de Produto. Sem vínculo, não adivinhamos."
        />
      </div>
    </div>
  );
}
