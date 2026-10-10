import { useId, useMemo, useState } from 'react';
import { listDeliveries } from '@application/queries/deliveries';
import { useReadyData } from '../../../state/dataStore';
import { MAX_NOTE_LENGTH, MAX_NOTES, useNotesStore, type Note, type NoteColor } from '../../../state/notesStore';
import { useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import type { EntityRef } from '../../../world/worldModel';
import { Icon } from '../../kit/Icon';
import { relativeTime } from '../../kit/format';
import { FilterSelect } from '../../views/FilterSelect';
import { useSnapshotNow, useVocabulary } from '../../views/viewHooks';
import { InspectorHeader } from './InspectorHeader';
import { ListRow, Muted, Notice, Section } from './inspectorParts';

const COLORS: { id: NoteColor; label: string; swatch: string; card: string }[] = [
  { id: 'yellow', label: 'Amarelo', swatch: 'bg-yellow-300', card: 'border-yellow-300/40 bg-yellow-300/10' },
  { id: 'orange', label: 'Laranja', swatch: 'bg-orange-400', card: 'border-orange-400/40 bg-orange-400/10' },
  { id: 'green', label: 'Verde', swatch: 'bg-emerald-400', card: 'border-emerald-400/40 bg-emerald-400/10' },
  { id: 'blue', label: 'Azul', swatch: 'bg-sky-400', card: 'border-sky-400/40 bg-sky-400/10' },
];
const LOOK = Object.fromEntries(COLORS.map((c) => [c.id, c])) as Record<NoteColor, (typeof COLORS)[number]>;
const NO_LINK = 'none';
const RECENT_CRS = 40;

const encode = (r: EntityRef | null) => (r && 'id' in r ? `${r.kind}:${r.id}` : NO_LINK);
function decode(v: string): EntityRef | null {
  const i = v.indexOf(':');
  if (i < 0) return null;
  return { kind: v.slice(0, i), id: v.slice(i + 1) } as EntityRef;
}

function ColorPicker({ value, onChange, name }: { value: NoteColor; onChange: (c: NoteColor) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label="Cor da nota" className="flex items-center gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          aria-label={`${c.label}${name ? ` (${name})` : ''}`}
          title={c.label}
          onClick={() => onChange(c.id)}
          className={`focus-ring grid h-7 w-7 place-items-center rounded-full tap:h-9 tap:w-9 ${value === c.id ? 'ring-2 ring-snow' : 'ring-1 ring-white/20'}`}
        >
          <span className={`block h-4 w-4 rounded-full ${c.swatch}`} />
        </button>
      ))}
    </div>
  );
}

/** Link picker options: initiatives, recent change requests and repositories. */
function useLinkOptions(extra: (EntityRef | null)[]): { options: [string, string][]; label: (r: EntityRef) => string } {
  const { index, snapshot } = useReadyData();
  const vocab = useVocabulary();
  return useMemo(() => {
    const crLabel = (id: string) => {
      const cr = index.cr.get(id);
      return cr ? `${vocab.changeRequestShort} #${cr.number} ${cr.title}` : id;
    };
    const names = new Map<string, string>();
    const groups: [string, string][] = [];
    const add = (ref: EntityRef, text: string) => {
      const k = encode(ref);
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
      if (ref?.kind === 'cr') add(ref, crLabel(ref.id));
    }
    const label = (r: EntityRef) => names.get(encode(r)) ?? 'Item vinculado';
    return { options: [[NO_LINK, 'Sem vínculo'], ...groups] as [string, string][], label };
  }, [index, snapshot, vocab, extra]);
}

const ICON_FOR: Record<string, 'target' | 'merge' | 'rack'> = { initiative: 'target', cr: 'merge', repo: 'rack' };

function NoteCard({ note, linkOptions, linkLabel }: { note: Note; linkOptions: [string, string][]; linkLabel: (r: EntityRef) => string }) {
  const { update, remove } = useNotesStore();
  const select = useUiStore((s) => s.select);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const look = LOOK[note.color];
  const id = useId();

  const save = () => {
    const clean = draft.trim();
    if (clean) update(note.id, { text: clean });
    else setDraft(note.text);
    setEditing(false);
  };

  return (
    <li className={`rounded-xl border p-2.5 ${look.card}`}>
      {editing ? (
        <div>
          <label htmlFor={id} className="sr-only">
            Texto da nota
          </label>
          <textarea
            id={id}
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            className="focus-ring w-full resize-none rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-base text-snow md:text-xs"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-fog" aria-live="polite">
              {draft.length}/{MAX_NOTE_LENGTH}
            </span>
            <span className="flex gap-1.5">
              <button type="button" onClick={() => { setDraft(note.text); setEditing(false); }} className="focus-ring rounded-lg bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-snow tap:min-h-11">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={!draft.trim()} className="focus-ring rounded-lg bg-forge px-2.5 py-1 text-xs font-bold text-ink-950 disabled:opacity-50 tap:min-h-11">
                Salvar
              </button>
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-snug break-words whitespace-pre-wrap text-snow">{note.text}</p>
      )}

      {note.ref && !editing && (
        <button
          type="button"
          onClick={() => select(note.ref)}
          aria-label={`Abrir item vinculado: ${linkLabel(note.ref)}`}
          className="focus-ring mt-1.5 flex max-w-full items-center gap-1 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-left text-[11px] font-semibold text-forge-bright hover:bg-white/[0.14]"
        >
          <Icon name={ICON_FOR[note.ref.kind] ?? 'target'} size={12} className="shrink-0" />
          <span className="truncate">{linkLabel(note.ref)}</span>
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ColorPicker value={note.color} name="nota" onChange={(c) => update(note.id, { color: c })} />
        <span className="flex gap-1.5">
          {!editing && (
            <button type="button" onClick={() => { setDraft(note.text); setEditing(true); }} className="focus-ring inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-2 py-1 text-xs font-semibold text-snow tap:min-h-11">
              <Icon name="draft" size={12} />
              Editar
            </button>
          )}
          <button type="button" onClick={() => remove(note.id)} aria-label="Excluir nota" className="focus-ring inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-2 py-1 text-xs font-semibold text-fail tap:min-h-11">
            <Icon name="x" size={12} />
            Excluir
          </button>
        </span>
      </div>
      <div className="mt-2">
        <FilterSelect
          label="Vínculo"
          value={encode(note.ref)}
          onChange={(v) => update(note.id, { ref: v === NO_LINK ? null : decode(v) })}
          options={linkOptions}
        />
      </div>
    </li>
  );
}

function NewNoteForm({ linkOptions }: { linkOptions: [string, string][] }) {
  const add = useNotesStore((s) => s.add);
  const full = useNotesStore((s) => s.notes.length >= MAX_NOTES);
  const [text, setText] = useState('');
  const [color, setColor] = useState<NoteColor>('yellow');
  const [link, setLink] = useState(NO_LINK);
  const id = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (full || !text.trim()) return;
    add(text, color, link === NO_LINK ? null : decode(link));
    setText('');
    setLink(NO_LINK);
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
      <label htmlFor={id} className="text-[11px] font-medium text-fog">
        Nova nota
      </label>
      <textarea
        id={id}
        value={text}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        disabled={full}
        placeholder={full ? `Limite de ${MAX_NOTES} notas atingido` : 'Escreva um lembrete para o time…'}
        onChange={(e) => setText(e.target.value)}
        className="focus-ring w-full resize-none rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 text-base text-snow disabled:opacity-50 md:text-xs"
      />
      <div className="flex items-center justify-between gap-2">
        <ColorPicker value={color} name="" onChange={setColor} />
        <span className="text-[11px] text-fog" aria-live="polite">
          {text.length}/{MAX_NOTE_LENGTH}
        </span>
      </div>
      <FilterSelect label="Vincular a (opcional)" value={link} onChange={setLink} options={linkOptions} />
      <button
        type="submit"
        disabled={full || !text.trim()}
        className="focus-ring inline-flex items-center gap-1 rounded-lg bg-forge px-3 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-forge-bright disabled:cursor-not-allowed disabled:opacity-50 tap:min-h-11"
      >
        <Icon name="plus" size={14} />
        Adicionar nota
      </button>
      {full && <p className="text-[11px] text-warn">Limite de {MAX_NOTES} notas atingido. Exclua uma nota para criar outra.</p>}
    </form>
  );
}

export function WhiteboardInspector() {
  const { index } = useReadyData();
  const scope = useScope();
  const now = useSnapshotNow();
  const vocab = useVocabulary();
  const select = useUiStore((s) => s.select);
  const notes = useNotesStore((s) => s.notes);

  const shipped = useMemo(
    () => listDeliveries(index, { ...scope, periodDays: 7, squadId: null }, { status: 'production' }),
    [index, scope],
  );
  const linkedRefs = useMemo(() => notes.map((n) => n.ref), [notes]);
  const { options, label } = useLinkOptions(linkedRefs);

  return (
    <>
      <InspectorHeader icon="note" eyebrow="Quadro" title="Quadro do time" subline="Entregas da semana e lembretes do time." target={{ kind: 'whiteboard' }} />

      <Section title="Entregue esta semana" aside={<span>{shipped.length}</span>}>
        {shipped.length === 0 && <Muted>Nada chegou em produção nos últimos 7 dias.</Muted>}
        {shipped.map((d) => (
          <ListRow
            key={d.cr.id}
            icon="rocket"
            title={d.cr.productSummary ?? d.cr.title}
            sub={`${vocab.changeRequestShort} #${d.cr.number} · ${d.repo.name} · ${relativeTime(d.lastActivityAt, now)}`}
            ariaLabel={`Abrir ${vocab.changeRequestShort} #${d.cr.number}`}
            onClick={() => select({ kind: 'cr', id: d.cr.id })}
          />
        ))}
      </Section>

      <Section title="Notas do time" aside={<span>{notes.length}/{MAX_NOTES}</span>}>
        <div className="space-y-2 px-2">
          {notes.length === 0 && <Muted>Nenhuma nota ainda. Crie a primeira abaixo.</Muted>}
          <ul className="space-y-2">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} linkOptions={options} linkLabel={label} />
            ))}
          </ul>
          <NewNoteForm linkOptions={options} />
        </div>
      </Section>

      <Notice>Notas salvas apenas neste navegador (local). Compartilhamento chega com o backend.</Notice>
      <div className="pb-4" />
    </>
  );
}
