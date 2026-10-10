import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { useReadyData } from '../state/dataStore';
import { useUiStore } from '../state/uiStore';
import { Environment } from './stage/Environment';
import { CameraRig } from './stage/CameraRig';
import { Effects } from './stage/Effects';
import { ForgeScene } from './ForgeScene';

/**
 * Scene engine entry point. Quality "high" enables shadows + bloom; the
 * performance monitor drops to "low" automatically on weaker devices.
 */
export default function ForgeCanvas() {
  const { world } = useReadyData();
  const quality = useUiStore((s) => s.quality);
  const setQuality = useUiStore((s) => s.setQuality);
  const setHover = useUiStore((s) => s.setHover);
  const [dpr, setDpr] = useState(quality === 'high' ? 1.75 : 1);
  const high = quality === 'high';

  return (
    <Canvas
      orthographic
      shadows={high ? 'percentage' : false}
      dpr={[1, dpr]}
      camera={{ position: [40, 40, 50], zoom: 18, near: -200, far: 600 }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => setHover(null)}
      aria-label="Data center 3D da Voomp Forge. Use a visão tabular para navegar pelos mesmos dados sem 3D."
      role="img"
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setQuality('low');
        }}
      />
      <Environment world={world} shadows={high} />
      <ForgeScene />
      <CameraRig world={world} />
      {high && <Effects />}
    </Canvas>
  );
}
