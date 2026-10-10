import { useMemo, useState } from 'react';
import { dayKey, deliveryCalendar, type CalendarDay } from '@application/queries/calendar';
import type { DeliveryEvent, DeliveryEventKind } from '@application/queries/events';
import { workstreamRoadmap } from '@application/queries/workstreams';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { Chip, EmptyState, SectionLabel } from '../kit/primitives';
import { HOLO, ObjectScreen } from '../objects/ObjectScreen';
import { relativeTime } from '../kit/format';
import { useSnapshotNow, useVocabulary } from '../views/viewHooks';
import { dateOnly, shortDate } from './frontLabels';

const KINDS: { kind: DeliveryEventKind; glyph: string; label: string; plural: string }[] = [
  { kind: 'deployed_production', glyph: '🚀', label: 'produção', plural: 'em produção' },
  { kind: 'deployed_staging', glyph: '🧪', label: 'staging', plural: 'em staging' },
  { kind: 'merged', glyph: '⤵', label: 'integrações', plural: 'integrações' },
  { kind: 'pipeline_failed', glyph: '⚠', label: 'falhas', plural: 'falhas de pipeline' },
];
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const FUTURE_DAYS = 7;

const emptyCounts = (): CalendarDay['counts'] => ({ merged: 0, pipeline_failed: 0, deployed_staging: 0, deployed_production: 0 });
/** 0 = Monday. Dates are plain calendar days, so noon UTC avoids any shift. */
const weekdayOf = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

interface DayMarkers {
  targets: { id: string; name: string }[];
  delivered: { id: string; name: string }[];
}

/** Delivery calendar: evidence per day (from the period) plus the fronts' planned targets and deliveries. */
export function CalendarScreen() {
  const { index } = useReadyData();
  const scope = useScope();
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const today = dayKey(scope.now.toISOString());
  const [picked, setPicked] = useState<string | null>(null);

  const days = useMemo(() => {
    const base = deliveryCalendar(index, scope);
    const future: CalendarDay[] = Array.from({ length: FUTURE_DAYS }, (_, i) => ({ date: addDays(today, i + 1), events: [], counts: emptyCounts() }));
    return [...base, ...future];
  }, [index, scope, today]);

  const markers = useMemo(() => {
    const map = new Map<string, DayMarkers>();
    const at = (d: string) => map.get(d) ?? map.set(d, { targets: [], delivered: [] }).get(d)!;
    for (const e of workstreamRoadmap(index, scope)) {
      const current = e.plans[e.plans.length - 1];
      const item = { id: e.workstream.id, name: e.workstream.name };
      if (current?.target) at(dateOnly(current.target)).targets.push(item);
      if (e.deliveredAt) at(dayKey(e.deliveredAt)).delivered.push(item);
    }
    return map;
  }, [index, scope]);

  const cells = useMemo(() => [...Array.from({ length: weekdayOf(days[0]!.date) }, () => null), ...days], [days]);
  const selectedDay = days.find((d) => d.date === (picked ?? today)) ?? null;
  const selectedMarkers = selectedDay ? markers.get(selectedDay.date) : undefined;

  const describe = (e: DeliveryEvent): { title: string; sub: string; open: () => void } => {
    const repo = index.repo.get(e.repoId);
    const crId = e.changeRequestId ?? (e.deploymentId ? (index.deployment.get(e.deploymentId)?.changeRequestIds[0] ?? null) : null);
    const cr = crId ? index.cr.get(crId) : undefined;
    const kind = KINDS.find((k) => k.kind === e.kind)!;
    return {
      title: `${kind.glyph} ${kind.plural.charAt(0).toUpperCase()}${kind.plural.slice(1)}${cr ? ` · ${vocab.changeRequestShort} #${cr.number}` : ''}`,
      sub: `${repo?.name ?? 'repositório'}${cr ? ` · ${cr.productSummary ?? cr.title}` : ''} · ${relativeTime(e.at, now)}`,
      open: () => (cr ? select({ kind: 'cr', id: cr.id }) : select({ kind: 'repo', id: e.repoId })),
    };
  };

  return (
    <ObjectScreen
      icon="clock"
      title="Calendário de entregas"
      subtitle={`Últimos ${scope.periodDays} dias + próximos ${FUTURE_DAYS} · evidência do Git e metas das frentes`}
      actions={<Chip tone="forge">últimos {scope.periodDays} dias</Chip>}
    >
      <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_300px] md:p-4">
        <div>
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fog" aria-label="Legenda do calendário">
            {KINDS.map((k) => (
              <li key={k.kind}>
                <span aria-hidden>{k.glyph}</span> {k.plural}
              </li>
            ))}
            <li>meta de frente</li>
            <li>
              <span aria-hidden className="text-ok">✓</span> entrega de frente
            </li>
          </ul>
          <div role="grid" aria-label="Calendário de entregas" className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} role="columnheader" className="pb-0.5 text-center font-mono text-[10px] tracking-[0.1em] text-fog uppercase">
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`pad-${i}`} aria-hidden />;
              const m = markers.get(d.date);
              const isToday = d.date === today;
              const isFuture = d.date > today;
              const active = d.date === (picked ?? today);
              const total = d.events.length;
              const label = [
                `${shortDate(d.date)}${isToday ? ' (hoje)' : ''}`,
                ...KINDS.filter((k) => d.counts[k.kind] > 0).map((k) => `${d.counts[k.kind]} ${k.plural}`),
                ...(m?.targets.length ? [`${m.targets.length} meta(s) de frente`] : []),
                ...(m?.delivered.length ? [`${m.delivered.length} frente(s) entregue(s)`] : []),
                ...(total === 0 && !m ? ['sem eventos'] : []),
              ].join(', ');
              return (
                <button
                  key={d.date}
                  type="button"
                  role="gridcell"
                  aria-label={label}
                  aria-pressed={active}
                  aria-current={isToday ? 'date' : undefined}
                  onClick={() => setPicked(d.date)}
                  className={`focus-ring flex min-h-16 min-w-0 flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left transition hover:bg-white/[0.08] md:min-h-24 ${
                    isFuture ? 'bg-white/[0.015]' : 'bg-white/[0.04]'
                  } ${active ? 'border-transparent' : isToday ? 'border-forge' : 'border-white/[0.07]'}`}
                  style={active ? { boxShadow: `0 0 0 2px ${HOLO}` } : undefined}
                >
                  <span className={`font-mono text-[10px] ${isToday ? 'font-bold text-forge-bright' : 'text-fog'}`} aria-hidden>
                    {shortDate(d.date)}
                    {isToday ? ' · hoje' : ''}
                  </span>
                  <span className="flex flex-wrap gap-x-1.5 text-[11px] leading-tight text-snow" aria-hidden>
                    {KINDS.map(
                      (k) =>
                        d.counts[k.kind] > 0 && (
                          <span key={k.kind} title={`${d.counts[k.kind]} ${k.plural}`} className={k.kind === 'pipeline_failed' ? 'text-fail' : ''}>
                            {k.glyph}
                            {d.counts[k.kind]}
                          </span>
                        ),
                    )}
                  </span>
                  {m?.delivered.slice(0, 1).map((f) => (
                    <span key={f.id} aria-hidden className="truncate rounded bg-ok/15 px-1 text-[10px] font-semibold text-ok">
                      ✓ {f.name}
                    </span>
                  ))}
                  {m?.targets.slice(0, 1).map((f) => (
                    <span key={f.id} aria-hidden className="truncate rounded bg-forge/15 px-1 text-[10px] text-forge-bright">
                      meta: {f.name}
                    </span>
                  ))}
                  {m && m.targets.length + m.delivered.length > 2 && (
                    <span aria-hidden className="text-[10px] text-fog">
                      +{m.targets.length + m.delivered.length - 2}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside aria-label="Eventos do dia" aria-live="polite" className="rounded-xl border border-white/[0.08] bg-white/[0.03] pb-2 md:max-h-[60dvh] md:overflow-auto scroll-thin">
          {!selectedDay ? (
            <EmptyState icon="clock" title="Escolha um dia" />
          ) : (
            <>
              <SectionLabel>{shortDate(selectedDay.date)}{selectedDay.date === today ? ' · hoje' : ''}</SectionLabel>
              {selectedMarkers && (selectedMarkers.targets.length > 0 || selectedMarkers.delivered.length > 0) && (
                <ul className="space-y-1 px-3 pb-2">
                  {selectedMarkers.delivered.map((f) => (
                    <li key={`d-${f.id}`}>
                      <button type="button" onClick={() => select({ kind: 'workstream', id: f.id })} className="focus-ring w-full rounded-md bg-ok/10 px-2 py-1 text-left text-[12px] text-ok tap:min-h-11">
                        ✓ Frente entregue: {f.name}
                      </button>
                    </li>
                  ))}
                  {selectedMarkers.targets.map((f) => (
                    <li key={`t-${f.id}`}>
                      <button type="button" onClick={() => select({ kind: 'workstream', id: f.id })} className="focus-ring w-full rounded-md bg-forge/10 px-2 py-1 text-left text-[12px] text-forge-bright tap:min-h-11">
                        Meta: {f.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedDay.events.length === 0 ? (
                <p className="px-4 py-2 text-[12px] text-fog">
                  {selectedDay.date > today ? 'Dia futuro: ainda não há evidência.' : 'Nenhum evento de entrega neste dia.'}
                </p>
              ) : (
                <ul>
                  {[...selectedDay.events].reverse().map((e) => {
                    const info = describe(e);
                    return (
                      <li key={e.id}>
                        <button type="button" onClick={info.open} className="focus-ring block w-full px-4 py-1.5 text-left hover:bg-white/[0.06] tap:min-h-11">
                          <span className={`block text-[12px] font-semibold ${e.kind === 'pipeline_failed' ? 'text-fail' : 'text-snow'}`}>{info.title}</span>
                          <span className="block text-[11px] text-fog">{info.sub}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
    </ObjectScreen>
  );
}
