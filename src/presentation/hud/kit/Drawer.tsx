import { useEffect, useRef, type ReactNode } from 'react';
import { trapTab } from './focus';
import { IconButton } from './primitives';

interface DrawerProps {
  open: boolean;
  label: string;
  onClose: () => void;
  /** Overlay mode: dims the world behind and behaves as a modal dialog. */
  overlay?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Left-hand drawer for tablets. Docked (no scrim) in landscape, overlay with scrim in portrait.
 * Not mounted while closed; focus moves in when the user opens it and returns to the opener on close.
 */
export function Drawer({ open, label, onClose, overlay = false, className = '', children }: DrawerProps) {
  const ref = useRef<HTMLElement>(null);
  const wasOpen = useRef(open);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    // Only a user-initiated open moves focus; a drawer that starts open (landscape) must not grab it.
    if (!wasOpen.current) ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    wasOpen.current = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && ref.current?.contains(document.activeElement)) {
        e.preventDefault();
        closeRef.current();
      } else if (overlay) trapTab(e, ref.current);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener?.isConnected && ref.current === null) opener.focus?.({ preventScroll: true });
    };
  }, [open, overlay]);

  useEffect(() => {
    if (!open) wasOpen.current = false;
  }, [open]);

  if (!open) return null;
  return (
    <>
      {overlay && <div aria-hidden="true" onPointerDown={onClose} className="fixed inset-0 z-20 bg-ink-950/50" />}
      <aside
        ref={ref}
        id="left-drawer"
        role={overlay ? 'dialog' : 'complementary'}
        aria-modal={overlay || undefined}
        aria-label={label}
        className={`animate-drawer-in z-30 flex flex-col ${className}`}
      >
        <div className="flex shrink-0 items-center justify-between pb-1.5 pl-1">
          <h2 className="font-mono text-[10px] font-semibold tracking-[0.14em] text-fog uppercase">{label}</h2>
          <IconButton icon="close" label={`Fechar ${label}`} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </aside>
    </>
  );
}
