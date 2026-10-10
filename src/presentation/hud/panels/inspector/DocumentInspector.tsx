import { useReadyData } from '../../../state/dataStore';
import { useUiStore } from '../../../state/uiStore';
import { EvidenceLink } from '../../kit/EvidenceLink';
import { relativeTime } from '../../kit/format';
import { Chip } from '../../kit/primitives';
import { useSnapshotNow } from '../../views/viewHooks';
import { DOCUMENT_KIND_LABEL } from './documentLabels';
import { InspectorHeader } from './InspectorHeader';
import { Chips, ListRow, Muted, Section } from './inspectorParts';

export function DocumentInspector({ id }: { id: string }) {
  const { index } = useReadyData();
  const now = useSnapshotNow();
  const select = useUiStore((s) => s.select);
  const doc = index.document.get(id)!;
  const squad = doc.squadId ? index.squad.get(doc.squadId) : undefined;
  const initiatives = doc.initiativeIds.map((i) => index.initiative.get(i)).filter((x) => x !== undefined);
  const repos = doc.repositoryIds.map((r) => index.repo.get(r)).filter((x) => x !== undefined);

  return (
    <>
      <InspectorHeader icon="book" eyebrow={`Documento · ${DOCUMENT_KIND_LABEL[doc.kind]}`} title={doc.title} subline={`Atualizado ${relativeTime(doc.updatedAt, now)}`} />
      <Chips>
        <Chip tone="forge">{DOCUMENT_KIND_LABEL[doc.kind]}</Chip>
        <Chip>Espaço: {doc.space}</Chip>
        <Chip>{squad ? `SQ-${squad.code} · ${squad.name}` : 'Sem squad'}</Chip>
      </Chips>
      <Section title="Iniciativas relacionadas">
        {initiatives.length === 0 && <Muted>Nenhuma iniciativa vinculada.</Muted>}
        {initiatives.map((i) => (
          <ListRow key={i.id} icon="target" title={i.name} sub={i.key} ariaLabel={`Abrir iniciativa ${i.name}`} onClick={() => select({ kind: 'initiative', id: i.id })} />
        ))}
      </Section>
      <Section title="Repositórios relacionados">
        {repos.length === 0 && <Muted>Nenhum repositório vinculado.</Muted>}
        {repos.map((r) => (
          <ListRow key={r.id} icon="rack" title={r.name} sub={r.language} ariaLabel={`Abrir repositório ${r.name}`} onClick={() => select({ kind: 'repo', id: r.id })} />
        ))}
      </Section>
      <div className="px-4 pt-2 pb-4">
        <EvidenceLink href={doc.webUrl}>Abrir documento</EvidenceLink>
      </div>
    </>
  );
}
