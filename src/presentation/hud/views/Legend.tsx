import { SIGNAL_LOOK } from '../../theme';
import { useUiStore } from '../../state/uiStore';
import { Icon } from '../kit/Icon';

/** Footer legend: what each rack signal means, plus the way into the accessible table view. */
export function Legend() {
  const openOverlay = useUiStore((s) => s.openOverlay);
  return (
    <div className="hud-card flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5" role="group" aria-label="Legenda dos sinais">
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {Object.entries(SIGNAL_LOOK).map(([signal, look]) => (
          <li key={signal} className={`flex items-center gap-1 text-[11px] whitespace-nowrap ${look.text}`}>
            <Icon name={look.icon} size={12} />
            <span className="text-fog">{look.label}</span>
          </li>
        ))}
      </ul>
      <span className="h-4 w-px bg-white/10" aria-hidden="true" />
      <button
        type="button"
        onClick={() => openOverlay('table')}
        className="focus-ring flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-snow hover:bg-white/[0.08]"
      >
        <Icon name="table" size={12} />
        Visão tabular
      </button>
    </div>
  );
}
