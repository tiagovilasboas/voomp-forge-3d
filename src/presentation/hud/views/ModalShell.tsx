import { useEffect, useId, useRef, type ReactNode } from 'react';
import { FOCUSABLE, trapTab } from '../kit/focus';
import { IconButton } from '../kit/primitives';

interface ModalShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Chips or badges shown next to the title. */
  badges?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Centered modal: backdrop blur, Esc and close button, focus moves in on open,
 * Tab stays inside, focus returns to the opener on close.
 */
export function ModalShell({ title, subtitle, badges, onClose, closeLabel = 'Fechar', className = 'max-w-5xl h-[86vh]', children }: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();

    // Capture phase + stopPropagation: Esc closes only the modal, never the inspector behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      trapTab(e, dialog);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-0 backdrop-blur-sm md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`hud-card animate-panel-in flex max-h-full w-full flex-col overflow-hidden bg-ink-900 max-md:h-full! max-md:max-w-none! max-md:rounded-none! ${className}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 md:px-5 md:pt-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="font-display text-xl font-bold text-snow">
                {title}
              </h2>
              {badges}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-fog">{subtitle}</p>}
          </div>
          <IconButton icon="close" label={closeLabel} onClick={onClose} />
        </header>
        {children}
      </div>
    </div>
  );
}
