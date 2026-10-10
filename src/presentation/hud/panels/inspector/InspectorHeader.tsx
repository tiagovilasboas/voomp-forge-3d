import type { ReactNode } from 'react';
import type { EntityRef } from '../../../world/worldModel';
import { useUiStore } from '../../../state/uiStore';
import type { IconName } from '../../../theme';
import { Icon } from '../../kit/Icon';
import { Eyebrow, IconButton } from '../../kit/primitives';

interface InspectorHeaderProps {
  icon: IconName;
  /** Entity type · code, e.g. "Squad · SQ-A". */
  eyebrow: string;
  title: ReactNode;
  subline?: ReactNode;
  /** What "Centralizar" focuses. Omit to hide the button. */
  target?: EntityRef;
}

export function InspectorHeader({ icon, eyebrow, title, subline, target }: InspectorHeaderProps) {
  const commandCamera = useUiStore((s) => s.commandCamera);
  const select = useUiStore((s) => s.select);
  return (
    <header className="flex items-start gap-3 px-4 pt-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forge/15 text-forge">
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-display text-lg leading-tight font-bold break-words text-snow">{title}</h2>
        {subline && <div className="mt-0.5 text-xs text-fog">{subline}</div>}
      </div>
      <div className="flex shrink-0 gap-0.5">
        {target && <IconButton icon="target" label="Centralizar no mapa" onClick={() => commandCamera({ type: 'focus', ref: target })} className="" />}
        <button
          type="button"
          data-autofocus
          aria-label="Fechar painel (Esc)"
          title="Fechar (Esc)"
          onClick={() => select(null)}
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-fog transition hover:bg-white/[0.08] hover:text-snow"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </header>
  );
}
