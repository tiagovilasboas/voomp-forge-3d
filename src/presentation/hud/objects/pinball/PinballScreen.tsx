import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useReadyData } from '../../../state/dataStore';
import { useScope } from '../../../state/selectors';
import { useUiStore } from '../../../state/uiStore';
import { useVocabulary } from '../../views/viewHooks';
import { HOLO, ObjectScreen } from '../ObjectScreen';
import {
  advance, ballInPlungerLane, clearEvents, createSim, EV_BUMPER, EV_DRAIN, EV_LANE, EV_LANES_DONE, EV_TARGET, evKind, FIELD_H, FIELD_W,
  launch, setFlippers, type Sim,
} from './physics';
import { PuzzleCard } from './PuzzleCard';
import { buildPuzzles, STAGE_NAMES } from './puzzles';
import { draw, TRAIL_LEN } from './render';

type Phase = 'playing' | 'paused' | 'puzzle' | 'over';
const BEST_KEY = 'forge.pinball.best';
const START_BALLS = 3;
const PUZZLE_BONUS = 2000;
const LANES_BONUS = 5000;

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeBest(v: number) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable: best score is simply not kept */
  }
}

const GAME_KEYS = new Set(['arrowleft', 'arrowright', 'arrowdown', ' ', 'z', 'm']);
const LEFT_KEYS = new Set(['arrowleft', 'z']);
const RIGHT_KEYS = new Set(['arrowright', 'm']);
const PLUNGER_KEYS = new Set([' ', 'arrowdown']);

/** Playable holographic pinball. Physics is pure (physics.ts); this component only wires input, loop and HUD. */
export function PinballScreen() {
  const { index } = useReadyData();
  const scope = useScope();
  const vocab = useVocabulary();
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const puzzles = useMemo(() => buildPuzzles(index, scope, vocab), [index, scope, vocab]);

  const [phase, setPhaseState] = useState<Phase>('playing');
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(START_BALLS);
  const [best, setBest] = useState(readBest);
  const [puzzleIdx, setPuzzleIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [progress, setProgress] = useState(0);

  const phaseRef = useRef<Phase>('playing');
  const g = useRef({
    sim: createSim() as Sim,
    left: false,
    right: false,
    charging: false,
    charge: 0,
    score: 0,
    balls: START_BALLS,
    best: 0,
    puzzleCursor: 0,
    shake: 0,
    trail: new Float32Array(TRAIL_LEN * 2),
    trailHead: 0,
    waiting: true,
    progress: 0,
    toastTimer: 0 as number,
  });
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const puzzlesRef = useRef(puzzles);
  puzzlesRef.current = puzzles;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: FIELD_W, h: FIELD_H });

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const flash = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(g.current.toastTimer);
    g.current.toastTimer = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const addScore = useCallback((n: number) => {
    g.current.score += n;
    setScore(g.current.score);
  }, []);

  const finishGame = useCallback(() => {
    const s = g.current;
    if (s.score > s.best) {
      s.best = s.score;
      writeBest(s.best);
      setBest(s.best);
    }
    setPhase('over');
  }, [setPhase]);

  // Fit the portrait playfield into the available box.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const scale = Math.min(box.clientWidth / FIELD_W, box.clientHeight / FIELD_H);
      if (scale > 0) setFit({ w: Math.floor(FIELD_W * scale), h: Math.floor(FIELD_H * scale) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    g.current.best = readBest();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(fit.w * dpr);
    canvas.height = Math.round(fit.h * dpr);
    ctx.setTransform(canvas.width / FIELD_W, 0, 0, canvas.height / FIELD_H, 0, 0);
  }, [fit]);

  // Main loop: fixed-step physics inside a requestAnimationFrame render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const s = g.current;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const handleEvents = () => {
      const { sim } = s;
      for (let i = 0; i < sim.eventCount; i++) {
        const code = sim.events[i];
        switch (evKind(code)) {
          case EV_BUMPER:
            addScore(100);
            break;
          case EV_LANE:
            addScore(500);
            break;
          case EV_LANES_DONE:
            addScore(LANES_BONUS);
            flash(`Entrega em produção! +${LANES_BONUS}`);
            s.shake = 1;
            break;
          case EV_TARGET: {
            const deck = puzzlesRef.current;
            if (deck.length > 0 && phaseRef.current === 'playing') {
              setPuzzleIdx(s.puzzleCursor++ % deck.length);
              s.left = s.right = s.charging = false;
              s.charge = 0;
              setFlippers(sim, false, false);
              setPhase('puzzle');
            }
            break;
          }
          case EV_DRAIN:
            s.balls -= 1;
            setBalls(s.balls);
            if (s.balls <= 0) finishGame();
            else flash('Bola perdida');
            break;
        }
        if (phaseRef.current !== 'playing') break;
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { sim } = s;
      if (phaseRef.current === 'playing') {
        if (s.charging) s.charge = Math.min(1, s.charge + dt);
        setFlippers(sim, s.left, s.right);
        clearEvents(sim);
        acc = advance(sim, acc + dt);
        handleEvents();
        const wait = ballInPlungerLane(sim);
        if (wait !== s.waiting) {
          s.waiting = wait;
          setWaiting(wait);
        }
        if (sim.laneProgress !== s.progress) {
          s.progress = sim.laneProgress;
          setProgress(s.progress);
        }
        s.shake = Math.max(0, s.shake - dt * 2.5);
      } else {
        acc = 0;
      }
      s.trail[s.trailHead * 2] = sim.ball.x;
      s.trail[s.trailHead * 2 + 1] = sim.ball.y;
      s.trailHead = (s.trailHead + 1) % TRAIL_LEN;
      draw(ctx, sim, {
        trail: s.trail,
        trailHead: s.trailHead,
        showTrail: !reducedRef.current,
        charge: s.charge,
        shake: reducedRef.current ? 0 : s.shake,
        pulse: 0.5 + 0.5 * Math.sin(now / 220),
      });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(s.toastTimer);
    };
  }, [addScore, flash, finishGame, setPhase, fit]);

  const release = useCallback(() => {
    const s = g.current;
    if (s.charging) {
      s.charging = false;
      if (phaseRef.current === 'playing') launch(s.sim, Math.max(0.35, s.charge));
      s.charge = 0;
    }
  }, []);

  // Keyboard. Escape and Tab are never handled here: the Object Screen owns them.
  useEffect(() => {
    const ignoreTarget = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!GAME_KEYS.has(k) || e.ctrlKey || e.metaKey || e.altKey || ignoreTarget(e)) return;
      if (phaseRef.current === 'puzzle' || phaseRef.current === 'over') return; // let the card's buttons work
      e.preventDefault(); // no page scroll, no button activation
      if (e.repeat || phaseRef.current !== 'playing') return;
      const s = g.current;
      if (LEFT_KEYS.has(k)) s.left = true;
      else if (RIGHT_KEYS.has(k)) s.right = true;
      else if (PLUNGER_KEYS.has(k)) s.charging = true;
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!GAME_KEYS.has(k)) return;
      const s = g.current;
      if (LEFT_KEYS.has(k)) s.left = false;
      else if (RIGHT_KEYS.has(k)) s.right = false;
      else if (PLUNGER_KEYS.has(k)) {
        if (phaseRef.current === 'playing') e.preventDefault();
        release();
      }
    };
    const onBlur = () => {
      const s = g.current;
      s.left = s.right = false;
      s.charging = false;
      s.charge = 0;
      if (phaseRef.current === 'playing') {
        phaseRef.current = 'paused';
        setPhaseState('paused');
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    // Keep keyboard focus off the close button so Space never activates it.
    const t = window.setTimeout(() => rootRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [release]);

  const resume = () => {
    if (phaseRef.current === 'paused') setPhase('playing');
    rootRef.current?.focus({ preventScroll: true });
  };
  const togglePause = () => (phaseRef.current === 'playing' ? setPhase('paused') : resume());

  const restart = () => {
    const s = g.current;
    s.sim = createSim();
    s.score = 0;
    s.balls = START_BALLS;
    s.left = s.right = s.charging = false;
    s.charge = 0;
    s.progress = 0;
    s.waiting = true;
    setScore(0);
    setBalls(START_BALLS);
    setProgress(0);
    setWaiting(true);
    setPhase('playing');
    rootRef.current?.focus({ preventScroll: true });
  };

  const onPuzzleDone = (correct: boolean) => {
    if (correct) {
      addScore(PUZZLE_BONUS);
      flash(`Quebra-cabeça resolvido! +${PUZZLE_BONUS}`);
    }
    setPuzzleIdx(null);
    setPhase('playing');
    rootRef.current?.focus({ preventScroll: true });
  };

  const hold = (side: 'left' | 'right' | 'plunger') => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      if (phaseRef.current !== 'playing') return;
      if (side === 'plunger') g.current.charging = true;
      else g.current[side] = true;
    },
    onPointerUp: () => {
      if (side === 'plunger') release();
      else g.current[side] = false;
    },
    onPointerCancel: () => {
      if (side === 'plunger') release();
      else g.current[side] = false;
    },
  });

  const puzzle = puzzleIdx !== null ? puzzles[puzzleIdx] : null;
  const touchBtn = 'focus-ring touch-none select-none rounded-xl border px-4 py-3 text-sm font-bold text-snow active:bg-white/20 tap:min-h-14';

  return (
    <ObjectScreen
      icon="target"
      title="Hub IA · Pinball"
      subtitle="Acenda as 5 etapas em ordem e resolva os quebra-cabeças"
      actions={
        <button
          type="button"
          onClick={togglePause}
          disabled={phase === 'puzzle' || phase === 'over'}
          className="focus-ring rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-snow disabled:opacity-40 tap:min-h-11"
        >
          {phase === 'paused' ? 'Continuar' : 'Pausar'}
        </button>
      }
    >
      <div ref={rootRef} tabIndex={-1} className="flex h-full min-h-0 flex-col bg-[#03080b] outline-none" style={{ color: HOLO }}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-2 font-mono text-xs" style={{ borderColor: `${HOLO}33` }}>
          <span aria-label={`Pontos ${score}`}>
            PONTOS <b className="text-sm text-snow">{score.toLocaleString('pt-BR')}</b>
          </span>
          <span aria-label={`Bolas restantes ${balls}`}>BOLAS {'●'.repeat(Math.max(0, balls))}{'○'.repeat(Math.max(0, START_BALLS - balls))}</span>
          <span>
            ETAPA <b className="text-snow">{progress}/5</b>
            {progress < 5 && <span className="text-fog"> · próxima: {STAGE_NAMES[progress]}</span>}
          </span>
          <span className="text-fog">RECORDE {best.toLocaleString('pt-BR')}</span>
        </div>

        <div ref={boxRef} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden p-2">
          <canvas ref={canvasRef} style={{ width: fit.w, height: fit.h }} role="img" aria-label="Mesa de pinball holográfica" />

          {toast && (
            <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-lg border bg-ink-950/90 px-3 py-1.5 text-center text-sm font-bold text-snow" style={{ borderColor: HOLO }} role="status">
              {toast}
            </div>
          )}
          {phase === 'playing' && waiting && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-ink-950/80 px-3 py-1 text-center text-xs text-snow">
              Segure Espaço (ou ↓) e solte para lançar · ←/→ ou Z/M: flippers
            </div>
          )}
          {phase === 'paused' && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/70">
              <button type="button" onClick={resume} className="focus-ring rounded-lg px-4 py-2 text-sm font-bold text-ink-950" style={{ background: HOLO }}>
                Pausado · Continuar
              </button>
            </div>
          )}
          {phase === 'over' && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-ink-950/80 p-4 text-center">
              <div>
                <p className="font-display text-lg font-bold text-snow">Fim de jogo</p>
                <p className="text-sm">{score.toLocaleString('pt-BR')} pontos · recorde local {best.toLocaleString('pt-BR')}</p>
                <button type="button" data-autofocus onClick={restart} className="focus-ring mt-3 rounded-lg px-4 py-2 text-sm font-bold text-ink-950 tap:min-h-11" style={{ background: HOLO }}>
                  Jogar de novo
                </button>
              </div>
            </div>
          )}
          {puzzle && <PuzzleCard key={puzzle.id + score} puzzle={puzzle} onDone={onPuzzleDone} />}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 border-t p-2 pb-3" style={{ borderColor: `${HOLO}33` }}>
          <button type="button" aria-label="Flipper esquerdo" className={touchBtn} style={{ borderColor: `${HOLO}66` }} {...hold('left')}>
            ◀ Esq.
          </button>
          <button type="button" aria-label="Lançar bola" className={touchBtn} style={{ borderColor: '#FF8C32' }} {...hold('plunger')}>
            Lançar
          </button>
          <button type="button" aria-label="Flipper direito" className={touchBtn} style={{ borderColor: `${HOLO}66` }} {...hold('right')}>
            Dir. ▶
          </button>
        </div>
      </div>
    </ObjectScreen>
  );
}
