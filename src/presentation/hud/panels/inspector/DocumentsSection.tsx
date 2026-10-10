import type { KnowledgeDocument } from '@domain/entities';
import { useUiStore } from '../../../state/uiStore';
import { DOCUMENT_KIND_LABEL } from './documentLabels';
import { ListRow, Section } from './inspectorParts';

/** "Documentos" list for squad/repo/initiative inspectors. Hidden when empty. */
export function DocumentsSection({ docs }: { docs: KnowledgeDocument[] | undefined }) {
  const select = useUiStore((s) => s.select);
  if (!docs || docs.length === 0) return null;
  return (
    <Section title="Documentos" aside={<span>{docs.length}</span>}>
      {docs.map((d) => (
        <ListRow
          key={d.id}
          icon="book"
          title={d.title}
          sub={`${DOCUMENT_KIND_LABEL[d.kind]} · ${d.space}`}
          ariaLabel={`Abrir documento ${d.title}`}
          onClick={() => select({ kind: 'document', id: d.id })}
        />
      ))}
    </Section>
  );
}
