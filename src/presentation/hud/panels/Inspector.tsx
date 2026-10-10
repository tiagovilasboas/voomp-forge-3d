import { useEffect, useRef } from 'react';
import type { ForgeIndex } from '@application/queries/forgeIndex';
import { refKey, type EntityRef } from '../../world/worldModel';
import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import { isObjectRef } from '../objects/objectRefs';
import { Card, EmptyState } from '../kit/primitives';
import { ChangeInspector } from './inspector/ChangeInspector';
import { DocumentInspector } from './inspector/DocumentInspector';
import { InitiativeInspector } from './inspector/InitiativeInspector';
import { InspectorHeader } from './inspector/InspectorHeader';
import { PersonInspector } from './inspector/PersonInspector';
import { RepoInspector } from './inspector/RepoInspector';
import { SquadInspector } from './inspector/SquadInspector';

function exists(index: ForgeIndex, ref: EntityRef): boolean {
  switch (ref.kind) {
    case 'squad':
      return index.squad.has(ref.id);
    case 'repo':
      return index.repo.has(ref.id);
    case 'person':
      return index.person.has(ref.id);
    case 'cr':
      return index.cr.has(ref.id);
    case 'initiative':
      return index.initiative.has(ref.id);
    case 'document':
      return index.document.has(ref.id);
    case 'gate':
    case 'whiteboard':
    case 'board':
    case 'desk':
      return true;
  }
}

function Variant({ selection }: { selection: EntityRef }) {
  switch (selection.kind) {
    case 'squad':
      return <SquadInspector id={selection.id} />;
    case 'repo':
      return <RepoInspector id={selection.id} />;
    case 'person':
      return <PersonInspector id={selection.id} />;
    case 'cr':
      return <ChangeInspector id={selection.id} />;
    case 'initiative':
      return <InitiativeInspector id={selection.id} />;
    case 'document':
      return <DocumentInspector id={selection.id} />;
    case 'whiteboard':
    case 'board':
    case 'desk':
      return null; // shown as an Object Screen instead
    case 'gate':
      return (
        <>
          <InspectorHeader icon="rocket" eyebrow="Portão · Produção" title="Portão de produção" subline="Só atravessa o portão o que tem deploy em produção confirmado." target={{ kind: 'gate' }} />
          <div className="pb-4" />
        </>
      );
  }
}

/** Body of the inspector (no chrome). Esc closes it; keyboard focus lands on the first control. */
export function InspectorContent() {
  const { index } = useReadyData();
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const key = selection ? refKey(selection) : '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const ui = useUiStore.getState();
      if (ui.overlay === null && ui.tourStep === null) ui.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keyboard users land on the panel's first control whenever the selection changes.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [key]);

  if (!selection) return null;

  return (
    <div ref={ref}>
      {exists(index, selection) ? (
        <Variant selection={selection} />
      ) : (
        <div className="p-2">
          <EmptyState icon="help" title="Item não encontrado nos dados atuais" />
          <div className="flex justify-center pb-3">
            <button type="button" data-autofocus onClick={() => select(null)} className="focus-ring rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-snow">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Right-hand panel (tablet and desktop). On phones the same content lives in a bottom sheet. */
export function Inspector() {
  const hasSelection = useUiStore((s) => s.selection !== null && !isObjectRef(s.selection));
  if (!hasSelection) return null;
  return (
    <Card label="Detalhes" className="scroll-thin max-h-[62vh] overflow-auto md:max-h-[calc(100vh-96px)]">
      <InspectorContent />
    </Card>
  );
}
