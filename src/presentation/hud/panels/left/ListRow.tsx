import type { ReactNode } from 'react';

/** Clickable row shared by the left-column cards. `selected` draws the orange left border. */
export function ListRow({
  onClick,
  selected = false,
  children,
  label,
}: {
  onClick: () => void;
  selected?: boolean;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={selected || undefined}
      className={`focus-ring block w-full border-l-2 px-4 py-2 tap:min-h-11 text-left transition hover:bg-white/[0.05] ${
        selected ? 'border-forge bg-forge/[0.07]' : 'border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
