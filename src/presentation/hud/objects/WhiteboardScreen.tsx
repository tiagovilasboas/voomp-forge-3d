import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { listDeliveries } from '@application/queries/deliveries';
import { useReadyData } from '../../state/dataStore';
import { MAX_NOTES, useNotesStore } from '../../state/notesStore';
import { useScope } from '../../state/selectors';
import { useUiStore } from '../../state/uiStore';
import { Icon } from '../kit/Icon';
import { relativeTime } from '../kit/format';
import { useSnapshotNow, useVocabulary } from '../views/viewHooks';
import { ObjectScreen } from './ObjectScreen';
import { NOTE_SIZE, StickyNote } from './whiteboard/StickyNote';
import { useLinkOptions } from './whiteboard/useLinkOptions';

const MARKER = '#1d4ed8';
const GAP = 12;
const SLOTS = MAX_NOTES;

interface Size {
  w: number;
  h: number;
}

/** Auto-grid slot -> relative position inside the free area. */
function slotPos(slot: number, size: Size) {
  const cols = Math.max(1, Math.floor((size.w - GAP) / (NOTE_SIZE + GAP)));
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const freeW = size.w - NOTE_SIZE;
  const freeH = size.h - NOTE_SIZE;
  const px = GAP + col * (NOTE_SIZE + GAP);
  const py = GAP + row * (NOTE_SIZE + GAP);
  return { x: freeW > 0 ? Math.min(1, px / freeW) : 0, y: freeH > 0 ? Math.min(1, py / freeH) : 0 };
}

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }, size: Size) =>
  Math.abs(a.x - b.x) * (size.w - NOTE_SIZE) < NOTE_SIZE * 0.6 && Math.abs(a.y - b.y) * (size.h - NOTE_SIZE) < NOTE_SIZE * 0.6;

export function WhiteboardScreen() {
  const { index } = useReadyData();
  const scope = useScope();
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const notes = useNotesStore((s) => s.notes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 720, h: 460 });

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shipped = useMemo(() => listDeliveries(index, { ...scope, periodDays: 7, squadId: null }, { status: 'production' }), [index, scope]);
  const linkedRefs = useMemo(() => notes.map((n) => n.ref), [notes]);
  const { options, label } = useLinkOptions(linkedRefs);

  const positions = useMemo(() => notes.map((n, i) => n.pos ?? slotPos(i, size)), [notes, size]);
  const free = { w: Math.max(0, size.w - NOTE_SIZE), h: Math.max(0, size.h - NOTE_SIZE) };
  const full = notes.length >= MAX_NOTES;

  const addNote = useCallback(() => {
    const store = useNotesStore.getState();
    if (store.notes.length >= MAX_NOTES) return;
    const taken = store.notes.map((n, i) => n.pos ?? slotPos(i, size));
    let slot = 0;
    while (slot < SLOTS - 1 && taken.some((p) => overlaps(p, slotPos(slot, size), size))) slot++;
    store.add('Nova nota', 'yellow', null);
    const created = useNotesStore.getState().notes.at(-1);
    if (created) {
      store.move(created.id, slotPos(slot, size));
      setEditingId(created.id);
    }
  }, [size]);

  const raise = (id: string) => setOrder((o) => [...o.filter((x) => x !== id), id]);

  return (
    <ObjectScreen
      icon="note"
      title="Quadro do time"
      subtitle="Entregas da semana e lembretes do time"
      actions={
        <button
          type="button"
          onClick={addNote}
          disabled={full}
          title={full ? `Limite de ${MAX_NOTES} notas atingido` : undefined}
          className="focus-ring inline-flex items-center gap-1 rounded-lg bg-forge px-3 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-forge-bright disabled:cursor-not-allowed disabled:opacity-50 tap:min-h-11"
        >
          <Icon name="plus" size={14} />
          Nova nota
        </button>
      }
    >
      <div className="flex min-h-full flex-col gap-3 p-3 md:p-4">
        <div className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-xl border-[6px] border-[#cbd5e1] bg-[#f8f7f2] text-[#1e293b] shadow-inner md:min-h-0 md:flex-row">
          <section aria-label="Entregue esta semana" className="flex max-h-56 shrink-0 flex-col border-b-2 border-dashed border-[#94a3b8]/60 p-3 md:max-h-none md:w-[270px] md:border-r-2 md:border-b-0">
            <h3 className="flex items-baseline justify-between font-display text-lg font-bold" style={{ color: MARKER }}>
              Entregue esta semana
              <span className="text-sm">{shipped.length}</span>
            </h3>
            <ul className="scroll-thin mt-2 min-h-0 flex-1 space-y-1 overflow-auto">
              {shipped.length === 0 && <li className="text-xs text-[#475569]">Nada chegou em produção nos últimos 7 dias.</li>}
              {shipped.map((d) => (
                <li key={d.cr.id}>
                  <button
                    type="button"
                    onClick={() => select({ kind: 'cr', id: d.cr.id })}
                    aria-label={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
                    className="focus-ring flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-[#1d4ed8]/10"
                  >
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-[#15803d]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{d.cr.productSummary ?? d.cr.title}</span>
                      <span className="block truncate text-[11px] text-[#475569]">
                        {vocab.changeRequestShort} #{d.cr.number} · {d.repo.name} · {relativeTime(d.lastActivityAt, now)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Notas do time" className="flex min-h-[420px] min-w-0 flex-1 flex-col p-3">
            <h3 className="flex items-baseline justify-between font-display text-lg font-bold" style={{ color: MARKER }}>
              Notas do time
              <span className="text-sm">
                {notes.length}/{MAX_NOTES}
              </span>
            </h3>
            <div ref={boardRef} className="relative mt-2 min-h-0 flex-1">
              {notes.length === 0 && <p className="absolute inset-x-0 top-2 text-center text-xs text-[#475569]">Nenhuma nota ainda. Use “Nova nota” para criar a primeira.</p>}
              {notes.map((n, i) => (
                <StickyNote
                  key={n.id}
                  note={n}
                  pos={positions[i]}
                  free={free}
                  editing={editingId === n.id}
                  onEditing={(v) => setEditingId(v ? n.id : null)}
                  linkOptions={options}
                  linkLabel={label}
                  zIndex={10 + Math.max(0, order.indexOf(n.id))}
                  onRaise={() => raise(n.id)}
                />
              ))}
            </div>
          </section>
        </div>
        <p className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-fog">
          Notas salvas apenas neste navegador (local). Compartilhamento chega com o backend. Arraste as notas para organizá-las; com uma nota focada, use as setas para movê-la e Enter para editar.
        </p>
      </div>
    </ObjectScreen>
  );
}
