import type { Delivery } from '@application/queries/deliveries';
import { STATUS_LOOK } from '../../theme';
import { Chip, StatusBadge } from '../kit/primitives';
import { EvidenceLink } from '../kit/EvidenceLink';
import { useReadyData } from '../../state/dataStore';
import { ENVIRONMENT_LABEL, NO_INITIATIVE } from './deliveryLabels';
import { StageMiniStepper } from './StageMiniStepper';
import { useVocabulary } from './viewHooks';

/** One delivery in the Explorer: plain-language title, origin, initiative and evidence. */
export function DeliveryCard({ delivery, onOpen }: { delivery: Delivery; onOpen: (d: Delivery) => void }) {
  const { index } = useReadyData();
  const vocab = useVocabulary();
  const { cr, repo, squad, initiative } = delivery;
  const author = index.person.get(cr.authorId)?.displayName ?? 'Autoria desconhecida';
  const deployments = index.deploymentsByCr.get(cr.id) ?? [];

  return (
    <article className="rounded-xl border border-white/[0.07] bg-white/[0.03] transition hover:border-forge/40">
      <button
        type="button"
        onClick={() => onOpen(delivery)}
        aria-label={`Abrir detalhes de ${vocab.changeRequestShort} #${cr.number}: ${cr.productSummary ?? cr.title}`}
        className="focus-ring block w-full rounded-t-xl px-3 pt-3 pb-2 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <StatusBadge look={STATUS_LOOK[delivery.status]} />
          <span className="font-mono text-[11px] text-fog">
            {vocab.changeRequestShort} #{cr.number}
          </span>
        </div>
        <h3 className="mt-2 text-[13px] font-semibold leading-snug text-snow">{cr.productSummary ?? cr.title}</h3>
        <p className="mt-0.5 text-[11px] text-fog">
          {squad.name} · {repo.name} · {author}
        </p>
        <div className="mt-2">{initiative ? <Chip tone="forge">{`${initiative.key} · ${initiative.name}`}</Chip> : <Chip>{NO_INITIATIVE}</Chip>}</div>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
        <StageMiniStepper stages={delivery.stages} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EvidenceLink href={cr.webUrl}>{vocab.changeRequestShort}</EvidenceLink>
          {deployments.map((d) => (
            <EvidenceLink key={d.id} href={d.webUrl}>
              {`Deploy ${ENVIRONMENT_LABEL[d.environment]}`}
            </EvidenceLink>
          ))}
        </div>
      </div>
    </article>
  );
}
