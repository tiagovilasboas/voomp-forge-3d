import { useMemo } from 'react';
import { useReadyData } from '../../../state/dataStore';
import type { EntityRef } from '../../../world/worldModel';
import { useVocabulary } from '../../views/viewHooks';

export const NO_LINK = 'none';
const RECENT_CRS = 40;

export const encodeRef = (r: EntityRef | null) => (r && 'id' in r ? `${r.kind}:${r.id}` : NO_LINK);
export function decodeRef(v: string): EntityRef | null {
  const i = v.indexOf(':');
  if (i < 0) return null;
  return { kind: v.slice(0, i), id: v.slice(i + 1) } as EntityRef;
}

/** Link picker options for notes: initiatives, recent change requests and repositories. */
export function useLinkOptions(extra: (EntityRef | null)[]): { options: [string, string][]; label: (r: EntityRef) => string } {
  const { index, snapshot } = useReadyData();
  const vocab = useVocabulary();
  return useMemo(() => {
    const names = new Map<string, string>();
    const groups: [string, string][] = [];
    const add = (ref: EntityRef, text: string) => {
      const k = encodeRef(ref);
      if (names.has(k)) return;
      names.set(k, text);
      groups.push([k, text]);
    };
    for (const i of snapshot.initiatives) add({ kind: 'initiative', id: i.id }, `Iniciativa · ${i.key} ${i.name}`);
    const recent = [...snapshot.changeRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_CRS);
    for (const cr of recent) add({ kind: 'cr', id: cr.id }, `${vocab.changeRequestShort} #${cr.number} ${cr.title}`);
    for (const r of snapshot.repositories) add({ kind: 'repo', id: r.id }, `Repositório · ${r.name}`);
    // Keep links that fell out of the "recent" window selectable.
    for (const ref of extra) {
      if (ref?.kind === 'cr') {
        const cr = index.cr.get(ref.id);
        add(ref, cr ? `${vocab.changeRequestShort} #${cr.number} ${cr.title}` : ref.id);
      }
    }
    const label = (r: EntityRef) => names.get(encodeRef(r)) ?? 'Item vinculado';
    return { options: [[NO_LINK, 'Sem vínculo'], ...groups] as [string, string][], label };
  }, [index, snapshot, vocab, extra]);
}
