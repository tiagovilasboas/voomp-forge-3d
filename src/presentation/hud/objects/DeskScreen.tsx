import { useMemo } from 'react';
import type { ContributorRole, ReviewVerdict } from '@domain/entities';
import type { Delivery } from '@application/queries/deliveries';
import { personSummary } from '@application/queries/summaries';
import { useReadyData } from '../../state/dataStore';
import { useScope } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { EmptyState } from '../kit/primitives';
import { useVocabulary } from '../views/viewHooks';
import { HOLO, ObjectScreen } from './ObjectScreen';

const ROLE_LABEL: Record<ContributorRole, string> = {
  developer: 'Desenvolvimento',
  reviewer: 'Revisão de código',
  'tech-lead': 'Tech lead',
  'product-manager': 'Produto',
};
const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  approved: 'aprovou',
  changes_requested: 'pediu ajustes',
  commented: 'comentou',
};

/** Holographic workstation for one person: participation only, never scores or presence. */
export function DeskScreen({ id }: { id: string }) {
  const { index } = useReadyData();
  const scope = useScope();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const exists = index.person.has(id);
  const summary = useMemo(() => (exists ? personSummary(index, id, scope) : null), [index, id, scope, exists]);

  if (!summary) {
    return (
      <ObjectScreen icon="person" title="Estação de trabalho">
        <EmptyState icon="help" title="Item não encontrado nos dados atuais" />
      </ObjectScreen>
    );
  }
  const { person, squad, authored, reviews, reviewedDeliveries } = summary;
  const verdictOf = (crId: string) => {
    const mine = reviews.find((r) => r.changeRequestId === crId);
    return mine ? VERDICT_LABEL[mine.verdict] : '';
  };

  const list = (items: Delivery[], sub: (d: Delivery) => string, empty: string) =>
    items.length === 0 ? (
      <p className="px-2 py-1 text-fog">{`> ${empty}`}</p>
    ) : (
      <ul>
        {items.map((d) => (
          <li key={d.cr.id}>
            <button
              type="button"
              onClick={() => select({ kind: 'cr', id: d.cr.id })}
              aria-label={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
              className="focus-ring block w-full rounded px-2 py-1.5 text-left transition hover:bg-[#38E1FF]/10 tap:min-h-11"
            >
              <span className="block truncate" style={{ color: HOLO }}>
                {'> '}
                {vocab.changeRequestShort} #{d.cr.number} · {d.cr.productSummary ?? d.cr.title}
              </span>
              <span className="block truncate pl-3 text-[11px] text-fog">{sub(d)}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <ObjectScreen icon="person" title={`Estação · ${person.displayName}`} subtitle={`@${person.handle}`}>
      <div className="p-3 font-mono text-xs md:p-4 md:text-[13px]" style={{ color: HOLO }}>
        <div className="rounded-xl border p-3 md:p-4" style={{ borderColor: `${HOLO}55`, background: `${HOLO}0d`, textShadow: `0 0 8px ${HOLO}66` }}>
          <p>
            <span className="text-fog">nome&nbsp;&nbsp;&nbsp;&nbsp;</span> {person.displayName}
          </p>
          <p>
            <span className="text-fog">função&nbsp;&nbsp;</span> {person.role ? ROLE_LABEL[person.role] : 'Função não informada'}
          </p>
          <p>
            <span className="text-fog">squad&nbsp;&nbsp;&nbsp;</span>{' '}
            {squad ? (
              <button type="button" onClick={() => select({ kind: 'squad', id: squad.id })} aria-label={`Abrir squad ${squad.name}`} className="focus-ring rounded underline decoration-dotted underline-offset-2">
                SQ-{squad.code} · {squad.name}
              </button>
            ) : (
              'Sem squad'
            )}
          </p>
          <p>
            <span className="text-fog">período&nbsp;</span> últimos {scope.periodDays} dias
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <section aria-label="Mudanças de autoria" className="rounded-xl border p-2" style={{ borderColor: `${HOLO}33` }}>
            <h3 className="px-2 pb-1 text-[11px] font-semibold tracking-[0.12em] uppercase">$ mudanças de autoria</h3>
            {list(authored, (d) => d.repo.name, 'nenhuma mudança de autoria no período.')}
          </section>
          <section aria-label="Revisões" className="rounded-xl border p-2" style={{ borderColor: `${HOLO}33` }}>
            <h3 className="px-2 pb-1 text-[11px] font-semibold tracking-[0.12em] uppercase">$ revisões</h3>
            {list(reviewedDeliveries, (d) => `${d.repo.name} · ${verdictOf(d.cr.id)}`, 'nenhuma revisão no período.')}
          </section>
        </div>

        <p className="mt-3 rounded-lg border px-3 py-2 text-[11px] leading-snug text-fog" style={{ borderColor: `${HOLO}22` }}>
          Estação ilustrativa: não indica presença, carga ou produtividade.
        </p>
      </div>
    </ObjectScreen>
  );
}
