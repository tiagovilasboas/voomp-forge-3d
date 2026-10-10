import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useUiStore } from '../../state/uiStore';
import type { IconName } from '../../theme';
import { FOCUSABLE, trapTab } from '../kit/focus';
import { Icon } from '../kit/Icon';

export const HOLO = '#38E1FF';

interface ObjectScreenProps {
  icon: IconName;
  title: ReactNode;
  /** Small line under the title (e.g. squad or period). */
  subtitle?: ReactNode;
  /** Extra header content (chips, tabs) placed before the close button. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The flat, readable version of an interactive 3D object: a large centered holographic panel
 * (full-screen sheet on phones) that zooms in from the screen centre. Closing deselects, which
 * sends the camera back. Esc closes unless the target opted out with `data-no-esc-close`
 * (inline editors handle Esc themselves).
 */
export function ObjectScreen({ icon, title, subtitle, actions, children, className = '' }: ObjectScreenProps) {
  const select = useUiStore((s) => s.select);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const opts: KeyframeAnimationOptions = { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' };
    dialogRef.current?.animate?.([{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'scale(1)' }], opts);
    backdropRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], opts);
  }, [reducedMotion]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    (dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (ui.overlay !== null || ui.tourStep !== null) return;
      if (e.key === 'Escape') {
        if ((e.target as HTMLElement | null)?.closest?.('[data-no-esc-close]')) return;
        e.preventDefault();
        e.stopPropagation();
        ui.select(null);
        return;
      }
      trapTab(e, dialog);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener && document.body.contains(opener)) opener.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 grid place-items-center bg-ink-950/55 backdrop-blur-[2px] md:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && select(null)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          border: `1px solid ${HOLO}8c`,
          boxShadow: `0 0 0 1px ${HOLO}22, 0 0 36px ${HOLO}33, inset 0 0 48px ${HOLO}14`,
        }}
        className={`flex h-dvh w-screen flex-col overflow-hidden bg-ink-950/90 backdrop-blur-xl max-md:rounded-none md:h-[min(720px,86dvh)] md:w-[min(1100px,92vw)] md:rounded-2xl ${className}`}
      >
        <header
          className="flex items-center gap-3 border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 md:pt-3"
          style={{ borderColor: `${HOLO}33`, background: `linear-gradient(180deg, ${HOLO}14, transparent)` }}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ color: HOLO, background: `${HOLO}1f` }}>
            <Icon name={icon} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-display text-base leading-tight font-bold text-snow md:text-lg">
              {title}
            </h2>
            {subtitle && <div className="truncate text-[11px] text-fog">{subtitle}</div>}
          </div>
          {actions}
          <button
            type="button"
            data-autofocus
            onClick={() => select(null)}
            aria-label="Fechar (Esc)"
            title="Fechar (Esc)"
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-snow transition hover:bg-white/[0.12] tap:min-h-11"
          >
            <Icon name="close" size={14} />
            Fechar
            <kbd className="hidden rounded border border-white/15 px-1 font-mono text-[10px] text-fog md:inline">Esc</kbd>
          </button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  );
}
