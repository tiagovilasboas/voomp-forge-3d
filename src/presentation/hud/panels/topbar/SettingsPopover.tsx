import { useId } from 'react';
import { useUiStore, type Quality } from '@presentation/state/uiStore';
import { IconButton, Segmented } from '@presentation/hud/kit/primitives';
import { usePopover } from './usePopover';

export function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-[13px] text-snow">
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`focus-ring relative h-5 w-9 shrink-0 rounded-full tap:before:absolute tap:before:-inset-3 tap:before:content-[''] transition ${checked ? 'bg-forge' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-snow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}

export function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring w-full rounded-lg px-2 py-1.5 tap:min-h-11 text-left text-[13px] text-snow hover:bg-white/[0.06]"
    >
      {label}
    </button>
  );
}

/** Display preferences (motion, graphics quality). Shared by the popover and the phone "Mais" sheet. */
export function SettingsPanel() {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);
  const quality = useUiStore((s) => s.quality);
  const setQuality = useUiStore((s) => s.setQuality);
  return (
    <>
      <SwitchRow label="Movimento reduzido" checked={reducedMotion} onChange={setReducedMotion} />
      <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-[13px] text-snow">
        Qualidade gráfica
        <Segmented<Quality>
          label="Qualidade gráfica"
          value={quality}
          onChange={setQuality}
          options={[
            { value: 'high', label: 'Alta' },
            { value: 'low', label: 'Leve' },
          ]}
        />
      </div>
    </>
  );
}

/** Display preferences and shortcuts to the secondary views. */
export function SettingsPopover() {
  const { open, setOpen, ref } = usePopover();
  const openOverlay = useUiStore((s) => s.openOverlay);

  const openView = (overlay: 'welcome' | 'table') => {
    setOpen(false);
    openOverlay(overlay);
  };

  return (
    <div ref={ref} className="relative">
      <IconButton icon="gear" label="Configurações" onClick={() => setOpen(!open)} active={open} />
      {open && (
        <div role="dialog" aria-label="Configurações" className="hud-card absolute top-full right-0 z-40 mt-2 w-64 p-2">
          <SettingsPanel />
          <div className="my-1 border-t border-white/[0.07]" />
          <MenuButton label="Rever boas-vindas" onClick={() => openView('welcome')} />
          <MenuButton label="Visão tabular" onClick={() => openView('table')} />
        </div>
      )}
    </div>
  );
}
