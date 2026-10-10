import type { ReactNode } from 'react';
import type { IconName } from '@presentation/theme';
import { Icon } from '@presentation/hud/kit/Icon';

interface ActivityRowProps {
  icon: IconName;
  title: string;
  subline: string;
  onOpen: () => void;
  /** Right-aligned action chip, e.g. "Ver" or "Acompanhar". */
  action?: { label: string; onClick: () => void; ariaLabel: string };
  badge?: ReactNode;
}

/** Queue row: icon square, title + 11px subline, optional badge and action chip. */
export function ActivityRow({ icon, title, subline, onOpen, action, badge }: ActivityRowProps) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.04]">
      <button type="button" onClick={onOpen} className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md text-left">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/5 text-fog">
          <Icon name={icon} size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-snow">{title}</span>
          <span className="block truncate text-[11px] text-fog">{subline}</span>
        </span>
        {badge}
      </button>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.ariaLabel}
          className="focus-ring shrink-0 rounded-md bg-forge/15 px-2 py-0.5 text-[11px] font-semibold text-forge-bright hover:bg-forge/25"
        >
          {action.label}
        </button>
      )}
    </li>
  );
}
