import { useUiStore } from '@presentation/state/uiStore';
import { IconButton } from '@presentation/hud/kit/primitives';

/** Zoom stack for the 3D world. */
export function MapControls() {
  const commandCamera = useUiStore((s) => s.commandCamera);
  const openOverlay = useUiStore((s) => s.openOverlay);

  return (
    <div role="toolbar" aria-label="Controles do mapa" aria-orientation="vertical" className="hud-card flex flex-col gap-0.5 p-1">
      <IconButton icon="plus" label="Aproximar" onClick={() => commandCamera({ type: 'zoom', factor: 1.25 })} />
      <IconButton icon="minus" label="Afastar" onClick={() => commandCamera({ type: 'zoom', factor: 0.8 })} />
      <IconButton icon="rotate" label="Girar a visão" onClick={() => commandCamera({ type: 'rotate', radians: Math.PI / 8 })} />
      <IconButton icon="home" label="Visão geral do data center" onClick={() => commandCamera({ type: 'overview' })} />
      <IconButton icon="table" label="Abrir visão tabular" onClick={() => openOverlay('table')} />
    </div>
  );
}
