import { useEffect, useRef, useState } from 'react';
import { HOLO } from '../ObjectScreen';
import { isOrderCorrect, type Puzzle } from './puzzles';

interface Props {
  puzzle: Puzzle;
  onDone: (correct: boolean) => void;
}

const btn = 'focus-ring w-full rounded-lg border px-3 py-2 text-left text-sm text-snow transition hover:bg-white/[0.1] tap:min-h-11';

/** Puzzle card shown over the paused playfield. Correct -> bonus, wrong -> explanation; both resume. */
export function PuzzleCard({ puzzle, onDone }: Props) {
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    (root?.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ?? root?.querySelector<HTMLElement>('button:not([disabled])'))?.focus({ preventScroll: true });
  }, [result]);

  const finishOrder = (next: number[]) => {
    setPicked(next);
    if (puzzle.kind === 'order' && next.length === puzzle.items.length) setResult(isOrderCorrect(puzzle, next));
  };

  return (
    <div
      ref={rootRef}
      className="scroll-thin absolute inset-0 z-10 grid place-items-center overflow-auto bg-ink-950/80 p-3 backdrop-blur-[2px]"
      role="group"
      aria-label="Quebra-cabeça"
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-ink-900/95 p-4"
        style={{ borderColor: `${HOLO}88`, boxShadow: `0 0 24px ${HOLO}33` }}
      >
        <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: HOLO }}>
          Quebra-cabeça
        </div>
        <p className="mt-1 mb-3 font-display text-sm font-bold text-snow">{puzzle.question}</p>

        {puzzle.kind === 'choice' && (
          <div className="grid gap-2">
            {puzzle.options.map((o, i) => (
              <button
                key={o}
                type="button"
                disabled={result !== null}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => {
                  setPicked([i]);
                  setResult(i === puzzle.answer);
                }}
                className={btn}
                style={{
                  borderColor:
                    result !== null && i === puzzle.answer ? '#5CF2A6' : result === false && picked[0] === i ? '#FF6B6B' : `${HOLO}44`,
                }}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {puzzle.kind === 'order' && (
          <>
            <ol className="mb-2 flex min-h-8 flex-wrap gap-1.5 text-xs text-fog" aria-label="Sua ordem">
              {picked.length === 0 && <li>Clique nas etapas na ordem certa.</li>}
              {picked.map((idx, n) => (
                <li key={idx} className="rounded border px-2 py-0.5 text-snow" style={{ borderColor: `${HOLO}66` }}>
                  {n + 1}. {puzzle.items[idx]}
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-2 gap-2">
              {puzzle.shown.map((idx, i) => (
                <button
                  key={idx}
                  type="button"
                  disabled={result !== null || picked.includes(idx)}
                  data-autofocus={i === 0 ? true : undefined}
                  onClick={() => finishOrder([...picked, idx])}
                  className={`${btn} disabled:opacity-40`}
                  style={{ borderColor: `${HOLO}44` }}
                >
                  {puzzle.items[idx]}
                </button>
              ))}
            </div>
            {result === null && picked.length > 0 && (
              <button type="button" onClick={() => setPicked(picked.slice(0, -1))} className="focus-ring mt-2 text-xs text-fog underline">
                Desfazer
              </button>
            )}
          </>
        )}

        {result !== null && (
          <div className="mt-3" role="status">
            <p className="text-sm font-semibold" style={{ color: result ? '#5CF2A6' : '#F6B94D' }}>
              {result ? 'Correto! +2000 pontos' : 'Não foi dessa vez.'}
            </p>
            <p className="mt-1 text-xs text-fog">{puzzle.explanation}</p>
            <button
              type="button"
              data-autofocus
              onClick={() => onDone(result)}
              className="focus-ring mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink-950 tap:min-h-11"
              style={{ background: HOLO }}
            >
              Continuar o jogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
