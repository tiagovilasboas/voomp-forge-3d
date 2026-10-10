import { useMemo } from 'react';
import { PALETTE } from '../../theme';
import type { WorldModel } from '../../world/worldModel';
import { makeFloorTexture } from '../kit/canvasTexture';
import { Box } from '../kit/Part';
import { mat } from '../kit/materials';

/** Lights, ground and the shared corridor. Dark room, warm accents, soft shadows. */
export function Environment({ world, shadows }: { world: WorldModel; shadows: boolean }) {
  const { min, max } = world.bounds;
  const width = max[0] - min[0] + 160;
  const depth = max[1] - min[1] + 160;
  const floorTex = useMemo(() => {
    const t = makeFloorTexture();
    t.repeat.set(width / 2, depth / 2);
    return t;
  }, [width, depth]);

  const cz = world.corridorZ;
  const corridorLen = max[0] - min[0] - 2;

  return (
    <>
      <color attach="background" args={[PALETTE.ink950]} />
      <fog attach="fog" args={[PALETTE.ink950, 90, 190]} />

      <hemisphereLight args={['#D5DCEA', '#16181F', 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[18, 32, 22]}
        intensity={2.2}
        color="#FFF1E2"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={110}
      />
      {/* cool rim light from the back for silhouette separation */}
      <directionalLight position={[-20, 14, -26]} intensity={0.7} color="#7F95C9" />
      {/* warm practical lights over each sector */}
      {world.sectors.map((s) => (
        <pointLight key={s.squadId} position={[s.center[0], 6, s.center[1]]} intensity={30} distance={18} decay={1.6} color={PALETTE.forgeBright} />
      ))}
      <pointLight position={[world.gate[0], 4, world.gate[1] + 1]} intensity={10} distance={12} decay={1.6} color={PALETTE.ok} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(min[0] + max[0]) / 2, 0, (min[1] + max[1]) / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={floorTex} roughness={0.95} metalness={0.05} />
      </mesh>

      {/* main corridor: the shared integration line all sectors flow into */}
      <Box position={[0, 0.03, cz]} size={[corridorLen, 0.06, 2.2]} material={mat.platform()} />
      <Box position={[0, 0.065, cz - 1.05]} size={[corridorLen, 0.01, 0.05]} material={mat.glow(PALETTE.forge, 0.5)} shadows={false} />
      <Box position={[0, 0.065, cz + 1.05]} size={[corridorLen, 0.01, 0.05]} material={mat.glow(PALETTE.forge, 0.5)} shadows={false} />
      {Array.from({ length: Math.floor(corridorLen / 2) }, (_, i) => (
        <Box
          key={i}
          position={[-corridorLen / 2 + 1 + i * 2, 0.065, cz]}
          size={[0.8, 0.01, 0.06]}
          material={mat.glow(PALETTE.fog, 0.25)}
          shadows={false}
        />
      ))}
    </>
  );
}
