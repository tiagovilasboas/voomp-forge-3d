import { lazy, Suspense, useEffect, useState } from 'react';
import { DemoDataSource } from '@infrastructure/demo/DemoDataSource';
import { useDataStore } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import { HudLayout } from '@presentation/hud/HudLayout';
import { TableView } from '@presentation/hud/views/TableView';
import { Icon } from '@presentation/hud/kit/Icon';

const ForgeCanvas = lazy(() => import('@presentation/scene/ForgeCanvas'));

const WELCOME_KEY = 'voomp-forge.welcome-seen';

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Composition root: picks the data source and mounts scene + HUD. */
export default function App() {
  const state = useDataStore((s) => s.state);
  const load = useDataStore((s) => s.load);
  const openOverlay = useUiStore((s) => s.openOverlay);
  const [webgl] = useState(supportsWebGL);

  useEffect(() => {
    void load(new DemoDataSource());
  }, [load]);

  useEffect(() => {
    if (state.status === 'ready' && !readFlag(WELCOME_KEY)) {
      openOverlay('welcome');
      try {
        localStorage.setItem(WELCOME_KEY, '1');
      } catch {
        /* storage unavailable: welcome simply shows again next time */
      }
    }
  }, [state.status, openOverlay]);

  if (state.status === 'error') {
    return (
      <main className="grid h-full place-items-center p-6">
        <div className="hud-card max-w-md p-6 text-center">
          <Icon name="alert" size={24} className="mx-auto text-fail" />
          <h1 className="mt-2 font-display text-lg font-semibold">Não foi possível carregar os dados</h1>
          <p className="mt-1 text-sm text-fog">{state.error}</p>
          <button
            type="button"
            onClick={() => void load(new DemoDataSource())}
            className="focus-ring mt-4 rounded-lg bg-forge px-4 py-2 text-sm font-semibold text-ink-950"
          >
            Voltar ao Demo Mode
          </button>
        </div>
      </main>
    );
  }

  if (state.status !== 'ready') {
    return (
      <main className="grid h-full place-items-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-forge/20 border-t-forge" />
          <p className="font-mono text-xs tracking-[0.2em] text-fog uppercase">Acendendo o data center…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full w-full">
      {webgl ? (
        <Suspense fallback={null}>
          <ForgeCanvas />
        </Suspense>
      ) : (
        <div className="absolute inset-0">
          <TableView embedded notice="WebGL indisponível neste dispositivo — exibindo a visão tabular com os mesmos dados." />
        </div>
      )}
      {webgl && <HudLayout />}
    </main>
  );
}
