import { useMemo } from 'react';
import { periodStart, type ScopeFilter } from '@application/queries/period';
import type { RoadmapEntry } from '@application/queries/workstreams';
import { dayKey } from '@application/queries/calendar';
import { Icon } from '../kit/Icon';
import { useUiStore } from '../../state/uiStore';
import { WS_STATUS_LOOK, dateOnly, shortDate } from './frontLabels';
import { EmptyState } from '../kit/primitives';

const DAY = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T12:00:00Z`);

/** Weeks across the top; per front, plan markers (past hollow, current filled) and the delivered marker. */
export function RoadmapView({ entries, scope }: { entries: RoadmapEntry[]; scope: ScopeFilter }) {
  const select = useUiStore((s) => s.select);

  const range = useMemo(() => {
    const start = dayMs(dayKey(new Date(periodStart(scope)).toISOString()));
    const today = dayMs(dayKey(scope.now.toISOString()));
    let min = start;
    let max = today + 7 * DAY;
    for (const e of entries) {
      for (const p of e.plans) {
        if (p.target) {
          const t = dayMs(dateOnly(p.target));
          min = Math.min(min, t);
          max = Math.max(max, t);
        }
      }
      if (e.deliveredAt) {
        const t = dayMs(dayKey(e.deliveredAt));
        min = Math.min(min, t);
        max = Math.max(max, t);
      }
    }
    min -= DAY;
    max += DAY;
    const weeks: number[] = [];
    for (let t = min; t <= max; t += 7 * DAY) weeks.push(t);
    return { min, max, today, weeks, span: max - min };
  }, [entries, scope]);

  if (entries.length === 0) return <EmptyState icon="target" title="Nenhuma frente para este filtro" />;
  const pct = (t: number) => `${Math.max(0, Math.min(100, ((t - range.min) / range.span) * 100))}%`;
  const fmt = (t: number) => shortDate(new Date(t).toISOString());

  return (
    <div>
      <p className="mb-2 text-[11px] text-fog">
        Previsto × entregue. <Legend />
      </p>
      <div className="scroll-thin overflow-x-auto rounded-xl border border-white/[0.08]">
        <div className="min-w-[720px]">
          <div className="flex border-b border-white/[0.08] bg-white/[0.03]">
            <div className="sticky left-0 z-10 w-44 shrink-0 bg-ink-900 px-2 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-fog uppercase">Frente</div>
            <div className="relative h-7 flex-1">
              {range.weeks.map((w) => (
                <span key={w} className="absolute top-1.5 -translate-x-1/2 font-mono text-[10px] text-fog" style={{ left: pct(w) }}>
                  {fmt(w)}
                </span>
              ))}
            </div>
          </div>
          <ul>
            {entries.map((e) => {
              const look = WS_STATUS_LOOK[e.status];
              return (
                <li key={e.workstream.id} className="flex border-b border-white/[0.05] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => select({ kind: 'workstream', id: e.workstream.id })}
                    className={`focus-ring sticky left-0 z-10 flex w-44 shrink-0 flex-col items-start gap-0.5 bg-ink-900 px-2 py-1.5 text-left hover:bg-ink-800 tap:min-h-11`}
                  >
                    <span className="line-clamp-2 text-[12px] leading-tight font-semibold text-snow">{e.workstream.name}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${look.text}`}>
                      <Icon name={look.icon} size={10} />
                      {look.label}
                    </span>
                  </button>
                  <div className="relative min-h-11 flex-1">
                    {range.weeks.map((w) => (
                      <span key={w} aria-hidden className="absolute inset-y-0 w-px bg-white/[0.06]" style={{ left: pct(w) }} />
                    ))}
                    <span aria-hidden className="absolute inset-y-0 w-px bg-forge/60" style={{ left: pct(range.today) }} title="Hoje" />
                    {e.plans.map((p, i) =>
                      p.target ? (
                        <span
                          key={i}
                          title={`${p.current ? 'Plano atual' : 'Plano anterior'}: ${p.label} · ${shortDate(p.target)}`}
                          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-forge ${p.current ? 'bg-forge' : 'bg-transparent opacity-70'}`}
                          style={{ left: pct(dayMs(dateOnly(p.target))) }}
                        >
                          <span className="sr-only">
                            {p.current ? 'Plano atual' : 'Plano anterior'}: {p.label}, {shortDate(p.target)}
                          </span>
                        </span>
                      ) : null,
                    )}
                    {e.plans.every((p) => !p.target) && <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[11px] text-fog">Sem data comprometida</span>}
                    {e.deliveredAt && (
                      <span
                        title={`Entregue em ${shortDate(e.deliveredAt)}`}
                        className="absolute top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ok text-ink-950"
                        style={{ left: pct(dayMs(dayKey(e.deliveredAt))) }}
                      >
                        <Icon name="check" size={12} />
                        <span className="sr-only">Entregue em {shortDate(e.deliveredAt)}</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="h-2.5 w-2.5 rotate-45 border-2 border-forge opacity-70" /> plano anterior
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="h-2.5 w-2.5 rotate-45 bg-forge" /> plano atual
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="grid h-3.5 w-3.5 place-items-center rounded-full bg-ok text-ink-950">
          <Icon name="check" size={9} />
        </span>
        entregue
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="h-3 w-px bg-forge" /> hoje
      </span>
    </span>
  );
}
