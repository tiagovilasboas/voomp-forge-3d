import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useReadyData } from '../../../state/dataStore';
import { useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import { useVocabulary } from '../../views/viewHooks';
import { HOLO, ObjectScreen } from '../ObjectScreen';
import { BANNER, complete, runCommand, type Tone, type TermLine } from './commands';

const TONE: Record<Tone, string> = {
  out: '#BFEFFF',
  dim: '#5F8A99',
  ok: '#5CF2A6',
  warn: '#F6B94D',
  err: '#FF6B6B',
  accent: HOLO,
};

const CSS = `
@keyframes term-caret { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
@keyframes term-scan { from { background-position: 0 0 } to { background-position: 0 4px } }
.term-scan { background-image: repeating-linear-gradient(0deg, rgba(56,225,255,0.07) 0 1px, transparent 1px 3px); animation: term-scan 0.4s linear infinite; }
.term-caret { animation: term-caret 1s steps(1) infinite; }
@media (prefers-reduced-motion: reduce) { .term-scan, .term-caret { animation: none } }
`;

interface Entry {
  prompt?: string;
  line: TermLine;
}

/** Hub IA terminal: deterministic queries over the snapshot, no AI. */
export function TerminalScreen() {
  const { index } = useReadyData();
  const scope = useScope();
  const vocabulary = useVocabulary();
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const [entries, setEntries] = useState<Entry[]>(() => BANNER.map((line) => ({ line })));
  const [value, setValue] = useState('');
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const draft = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [entries]);

  const clear = useCallback(() => setEntries(BANNER.map((line) => ({ line }))), []);

  const submit = useCallback(() => {
    const input = value.trim();
    setValue('');
    cursor.current = -1;
    if (!input) return;
    if (history.current[history.current.length - 1] !== input) history.current.push(input);
    const result = runCommand(input, { index, scope, vocabulary });
    if (result.action === 'clear') return clear();
    setEntries((prev) => [
      ...prev,
      { prompt: input, line: { text: input, tone: 'out' } },
      ...result.lines.map((line) => ({ line })),
    ]);
    if (result.action) useUiStore.getState().select(result.action);
  }, [value, index, scope, vocabulary, clear]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setValue((v) => complete(v));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      if (cursor.current === -1) {
        draft.current = value;
        cursor.current = h.length - 1;
      } else cursor.current = Math.max(0, cursor.current - 1);
      setValue(h[cursor.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cursor.current === -1) return;
      const h = history.current;
      if (cursor.current >= h.length - 1) {
        cursor.current = -1;
        setValue(draft.current);
      } else {
        cursor.current += 1;
        setValue(h[cursor.current]);
      }
    } else if (e.key.toLowerCase() === 'l' && e.ctrlKey) {
      e.preventDefault();
      clear();
    }
  };

  return (
    <ObjectScreen icon="search" title="Hub IA · Terminal" subtitle="Consultas determinísticas ao snapshot — sem IA">
      <style>{CSS}</style>
      <div
        className="relative flex h-full min-h-0 flex-col bg-[#03080b] font-mono text-[13px] leading-relaxed"
        style={{ color: TONE.out, textShadow: `0 0 6px ${HOLO}55` }}
        onClick={() => !window.getSelection()?.toString() && inputRef.current?.focus()}
      >
        {!reducedMotion && <div aria-hidden className="term-scan pointer-events-none absolute inset-0 z-10" />}
        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4 py-3" role="log" aria-live="polite" aria-label="Saída do terminal">
          {entries.map((e, i) => (
            <div key={i} className="break-words whitespace-pre-wrap" style={{ color: TONE[e.line.tone] }}>
              {e.prompt !== undefined ? (
                <>
                  <span style={{ color: HOLO }}>forge&gt; </span>
                  {e.prompt}
                </>
              ) : (
                e.line.text || ' '
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="relative z-20 flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: `${HOLO}33` }}>
          <span style={{ color: HOLO }} aria-hidden>
            forge&gt;
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Comando"
            placeholder="ajuda"
            className="term-caret-input min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#2d5563] md:text-[13px]"
            style={{ color: TONE.out, caretColor: HOLO, caretShape: 'block' } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={clear}
            className="focus-ring shrink-0 rounded border px-2 py-1 text-[11px] tap:min-h-11"
            style={{ borderColor: `${HOLO}55`, color: HOLO }}
            title="Limpar (Ctrl+L)"
          >
            Limpar
          </button>
        </div>
      </div>
    </ObjectScreen>
  );
}
