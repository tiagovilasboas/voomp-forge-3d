import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MAX_NOTE_LENGTH, useNotesStore, type Note, type NoteColor } from '../../../state/notesStore';
import { useUiStore } from '../../../state/uiStore';
import type { EntityRef } from '../../../world/worldModel';
import { Icon } from '../../kit/Icon';
import { decodeRef, encodeRef, NO_LINK } from './useLinkOptions';

export const NOTE_SIZE = 148;

export const NOTE_COLORS: { id: NoteColor; label: string; swatch: string; paper: string; edge: string }[] = [
  { id: 'yellow', label: 'Amarelo', swatch: '#fde047', paper: '#fef08a', edge: '#ca8a04' },
  { id: 'orange', label: 'Laranja', swatch: '#fb923c', paper: '#fdba74', edge: '#c2410c' },
  { id: 'green', label: 'Verde', swatch: '#4ade80', paper: '#86efac', edge: '#15803d' },
  { id: 'blue', label: 'Azul', swatch: '#38bdf8', paper: '#7dd3fc', edge: '#0369a1' },
];
const LOOK = Object.fromEntries(NOTE_COLORS.map((c) => [c.id, c])) as Record<NoteColor, (typeof NOTE_COLORS)[number]>;
const NUDGE = 0.02;
const DRAG_THRESHOLD = 4;

interface Props {
  note: Note;
  /** Resolved relative position (stored or auto-grid). */
  pos: { x: number; y: number };
  /** Free area inside the board, in px (board size minus the note size). */
  free: { w: number; h: number };
  editing: boolean;
  onEditing: (editing: boolean) => void;
  linkOptions: [string, string][];
  linkLabel: (r: EntityRef) => string;
  zIndex: number;
  onRaise: () => void;
}

/** A draggable, keyboard-movable, inline-editable sticky note. */
export function StickyNote({ note, pos, free, editing, onEditing, linkOptions, linkLabel, zIndex, onRaise }: Props) {
  const { update, remove, move } = useNotesStore();
  const select = useUiStore((s) => s.select);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const [draft, setDraft] = useState(note.text);
  const textId = useId();
  const look = LOOK[note.color];
  const shown = drag ?? pos;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (editing || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button,select,textarea,input')) return;
    onRaise();
    start.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    s.moved = true;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    setDrag({ x: clamp(s.x + (free.w > 0 ? dx / free.w : 0)), y: clamp(s.y + (free.h > 0 ? dy / free.h : 0)) });
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (s?.moved && drag) move(note.id, drag);
    setDrag(null);
  };

  const beginEdit = () => {
    setDraft(note.text);
    onEditing(true);
  };
  const save = () => {
    const clean = draft.trim();
    if (clean) update(note.id, { text: clean });
    onEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || e.target !== e.currentTarget) return;
    const step = e.shiftKey ? NUDGE * 5 : NUDGE;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = delta[e.key];
    if (d) {
      e.preventDefault();
      move(note.id, { x: pos.x + d[0], y: pos.y + d[1] });
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      beginEdit();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      remove(note.id);
    }
  };

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`Nota: ${note.text}. Setas movem, Enter edita, Delete exclui.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('button,select')) beginEdit();
      }}
      onKeyDown={onKeyDown}
      onFocus={onRaise}
      style={{
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        left: `calc(${shown.x} * (100% - ${NOTE_SIZE}px))`,
        top: `calc(${shown.y} * (100% - ${NOTE_SIZE}px))`,
        background: look.paper,
        borderBottom: `4px solid ${look.edge}`,
        zIndex: drag ? 1000 : zIndex,
        touchAction: editing ? 'auto' : 'none',
        transform: drag ? 'rotate(2deg) scale(1.04)' : 'rotate(-1deg)',
        boxShadow: drag ? '0 14px 24px rgba(0,0,0,.35)' : '0 3px 6px rgba(0,0,0,.25)',
        cursor: editing ? 'auto' : drag ? 'grabbing' : 'grab',
      }}
      className="focus-ring absolute flex flex-col rounded-sm p-2 text-[#1c1917] transition-shadow select-none"
    >
      {editing ? (
        <>
          <label htmlFor={textId} className="sr-only">
            Texto da nota
          </label>
          <textarea
            id={textId}
            autoFocus
            data-no-esc-close
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              if (!e.relatedTarget || !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) save();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                onEditing(false);
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
              }
            }}
            className="min-h-0 flex-1 resize-none rounded-sm border border-black/20 bg-white/50 p-1 text-base leading-tight text-[#1c1917] outline-none focus:border-black/50 md:text-xs"
          />
          <select
            aria-label="Vínculo da nota"
            value={encodeRef(note.ref)}
            onChange={(e) => update(note.id, { ref: e.target.value === NO_LINK ? null : decodeRef(e.target.value) })}
            onKeyDown={(e) => e.stopPropagation()}
            className="mt-1 w-full truncate rounded-sm border border-black/20 bg-white/60 px-1 py-0.5 text-[11px] text-[#1c1917]"
          >
            {linkOptions.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" onClick={save} className="focus-ring mt-1 self-end rounded-sm bg-[#1c1917] px-2 py-0.5 text-[11px] font-bold text-white">
            Salvar
          </button>
        </>
      ) : (
        <>
          <p className="min-h-0 flex-1 overflow-hidden text-[13px] leading-tight font-medium break-words whitespace-pre-wrap" style={{ fontFamily: '"Segoe Print","Bradley Hand","Comic Sans MS",cursive' }}>
            {note.text}
          </p>
          {note.ref && (
            <button
              type="button"
              onClick={() => select(note.ref)}
              aria-label={`Abrir item vinculado: ${linkLabel(note.ref)}`}
              title={linkLabel(note.ref)}
              className="focus-ring mt-1 flex max-w-full items-center gap-1 rounded-sm bg-black/15 px-1 py-0.5 text-left text-[10px] font-bold hover:bg-black/25"
            >
              <Icon name="external" size={10} className="shrink-0" />
              <span className="truncate">{linkLabel(note.ref)}</span>
            </button>
          )}
          <div className="mt-1 flex items-center justify-between gap-1">
            <div role="radiogroup" aria-label="Cor da nota" className="flex gap-1">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={note.color === c.id}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => update(note.id, { color: c.id })}
                  className="focus-ring h-4 w-4 rounded-full border-2"
                  style={{ background: c.swatch, borderColor: note.color === c.id ? '#1c1917' : 'transparent' }}
                />
              ))}
            </div>
            <span className="flex gap-0.5">
              <button type="button" onClick={beginEdit} aria-label="Editar nota" title="Editar" className="focus-ring grid h-5 w-5 place-items-center rounded-sm hover:bg-black/15">
                <Icon name="draft" size={12} />
              </button>
              <button type="button" onClick={() => remove(note.id)} aria-label="Excluir nota" title="Excluir" className="focus-ring grid h-5 w-5 place-items-center rounded-sm hover:bg-black/15">
                <Icon name="x" size={12} />
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
