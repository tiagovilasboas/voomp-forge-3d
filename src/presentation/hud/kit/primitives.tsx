import type { ReactNode } from 'react';
import type { Look, IconName } from '../../theme';
import { Icon } from './Icon';

/** Reusable HUD primitives. Panels compose these; they never style from scratch. */

export function Card({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`hud-card animate-panel-in ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
      <h2 className="font-display text-[13px] font-semibold tracking-wide text-snow">{title}</h2>
      {aside}
    </header>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-forge-bright">{children}</div>;
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">
      <span>{children}</span>
      {aside}
    </div>
  );
}

/** Status chip: icon + text + colour, so meaning never depends on colour alone. */
export function StatusBadge({ look, compact = false, title }: { look: Look; compact?: boolean; title?: string }) {
  return (
    <span
      title={title ?? look.label}
      className={`inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${look.text}`}
    >
      <Icon name={look.icon} size={12} />
      {!compact && look.label}
    </span>
  );
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'forge' | 'demo' }) {
  const tones = {
    neutral: 'bg-white/[0.06] text-fog',
    forge: 'bg-forge/15 text-forge-bright',
    demo: 'bg-warn/15 text-warn border border-warn/30',
  };
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-fog">
        {icon && <Icon name={icon} size={12} />}
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-semibold leading-tight text-snow">{value}</div>
      {hint && <div className="text-[11px] text-fog">{hint}</div>}
    </div>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  active = false,
  className = '',
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-pressed={active || undefined}
      className={`focus-ring grid h-8 w-8 tap:h-11 tap:w-11 place-items-center rounded-lg text-fog transition hover:bg-white/[0.08] hover:text-snow ${active ? 'bg-forge/15 text-forge-bright' : ''} ${className}`}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-white/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`focus-ring rounded-md px-2.5 py-1 whitespace-nowrap tap:min-h-10 tap:px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            o.value === value ? 'bg-ink-700 text-snow shadow' : 'text-fog hover:text-snow'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'moon', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
      <Icon name={icon} size={20} className="text-idle" />
      <div className="text-sm font-semibold text-snow">{title}</div>
      {children && <div className="text-xs text-fog">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, color = 'bg-forge' }: { value: number; color?: string }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]" role="presentation">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}
