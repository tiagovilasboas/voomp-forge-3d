import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { trapTab } from './focus';
import { IconButton } from './primitives';

export type Snap = 'peek' | 'full';

const HEIGHT: Record<Snap, string> = {
  peek: '35dvh',
  full: 'min(90dvh, calc(100dvh - var(--mobile-nav-h) - 12px))',
};
const DRAG_THRESHOLD = 48;
const TAP_SLOP = 6;

/** Open sheets, topmost last: Esc closes only the one on top. */
const stack: symbol[] = [];

interface BottomSheetProps {
  /** Accessible name; also the visible title when `showTitle` is set. */
  label: string;
  showTitle?: boolean;
  initialSnap?: Snap;
  onClose: () => void;
  /** Reports whether the sheet is expanded to `full` (the parent can hide floating controls). */
  onSnapChange?: (snap: Snap) => void;
  children: ReactNode;
}

/**
 * Phone bottom sheet above the bottom navigation. Snaps: `peek` (35vh, the world stays interactive)
 * and `full` (90vh, modal with backdrop). The handle drags (pointer events) or toggles on tap/Enter.
 */
export function BottomSheet({ label, showTitle = false, initialSnap = 'peek', onClose, onSnapChange, children }: BottomSheetProps) {
  const [snap, setSnap] = useState<Snap>(initialSnap);
  const [dragY, setDragY] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(Symbol('sheet'));
  const start = useRef<{ y: number; moved: boolean } | null>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const changeRef = useRef(onSnapChange);
  changeRef.current = onSnapChange;
  const modal = snap === 'full';

  useEffect(() => {
    changeRef.current?.(snap);
  }, [snap]);
  useEffect(() => () => changeRef.current?.('peek'), []);

  useEffect(() => {
    const mine = id.current;
    stack.push(mine);
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      stack.splice(stack.indexOf(mine), 1);
      if (opener?.isConnected) opener.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && stack[stack.length - 1] === id.current) {
        e.preventDefault();
        closeRef.current();
      } else if (modal) trapTab(e, ref.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const toggle = () => setSnap((s) => (s === 'peek' ? 'full' : 'peek'));

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, moved: false };
    setDragY(0);
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dy) > TAP_SLOP) start.current.moved = true;
    setDragY(dy);
  };
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    setDragY(null);
    if (!s) return;
    const dy = e.clientY - s.y;
    if (!s.moved) return toggle();
    if (dy < -DRAG_THRESHOLD) setSnap('full');
    else if (dy > DRAG_THRESHOLD) {
      if (snap === 'full') setSnap('peek');
      else onClose();
    }
  };

  const dragging = dragY !== null && start.current?.moved;
  const style: CSSProperties = {
    height: dragging && dragY! < 0 ? `min(${HEIGHT.full}, calc(${HEIGHT[snap]} + ${-dragY!}px))` : HEIGHT[snap],
    transform: dragging && dragY! > 0 ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : undefined,
    bottom: 'var(--mobile-nav-h)',
  };

  return (
    <>
      {modal && <div aria-hidden="true" onPointerDown={() => setSnap('peek')} className="fixed inset-x-0 top-0 z-30 bg-ink-950/60 backdrop-blur-[2px]" style={{ bottom: 'var(--mobile-nav-h)' }} />}
      <div
        ref={ref}
        role="dialog"
        aria-modal={modal}
        aria-label={showTitle ? undefined : label}
        aria-labelledby={showTitle ? titleId : undefined}
        tabIndex={-1}
        style={style}
        className="hud-card animate-sheet-in fixed inset-x-0 z-30 flex flex-col overflow-hidden rounded-b-none bg-ink-900 transition-[height] duration-200 outline-none"
      >
        <button
          type="button"
          aria-label={snap === 'peek' ? 'Expandir painel' : 'Recolher painel'}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            start.current = null;
            setDragY(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') setSnap('full');
            if (e.key === 'ArrowDown') setSnap('peek');
          }}
          className="focus-ring grid h-6 w-full shrink-0 touch-none place-items-center"
        >
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-white/25" />
        </button>
        {showTitle && (
          <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2">
            <h2 id={titleId} className="font-display text-base font-bold text-snow">
              {label}
            </h2>
            <IconButton icon="close" label={`Fechar ${label}`} onClick={onClose} />
          </header>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </>
  );
}
