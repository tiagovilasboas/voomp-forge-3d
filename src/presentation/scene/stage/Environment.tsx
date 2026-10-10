import { useMemo } from 'react';
import { LAYOUT } from '@config/world';
import { PALETTE } from '../../theme';
import type { WorldModel } from '../../world/worldModel';
import { makeFloorTexture } from '../kit/canvasTexture';
import { Box } from '../kit/Part';
import { mat } from '../kit/materials';
import { GroundGrid } from './GroundGrid';

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
  const corridorX = (min[0] + max[0]) / 2;
  const [hubX, hubZ] = world.aiHub.center;
  const corridorW = LAYOUT.corridorWidth;
  const shadowHalf = Math.max(max[0] - min[0], max[1] - min[1]) * 0.62;

  return (
    <>
      <color attach="background" args={[PALETTE.ink950]} />
      {/* Light radial haze at the horizon: starts far past the rooms so labels
          and the central bloom stay crisp, then dissolves the grid edge. */}
      <fog attach="fog" args={[PALETTE.ink950, 120, 240]} />

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
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
      {/* cool rim light from the back for silhouette separation */}
      <directionalLight position={[-20, 14, -26]} intensity={1.0} color="#C5CDD6" />

      {/* warm practical lights over each sector: a key plus a lower, warmer
          area-fill so sectors read as bright as the hub in the overview. */}
      {world.sectors.map((s) => (
        <group key={s.squadId}>
          <pointLight position={[s.center[0], 6, s.center[1]]} intensity={22} distance={18} decay={1.6} color={PALETTE.forgeBright} />
          <pointLight position={[s.center[0], 3.5, s.center[1]]} intensity={18} distance={16} decay={1.6} color={PALETTE.forge} />
        </group>
      ))}

      <pointLight position={[hubX, 6, hubZ]} intensity={20} distance={20} decay={1.6} color={PALETTE.forgeBright} />
      <pointLight position={[hubX, 3.5, hubZ + 2]} intensity={8} distance={14} decay={1.6} color="#38E1FF" />
      <pointLight position={[world.gate[0], 4, world.gate[1] + 1]} intensity={10} distance={12} decay={1.6} color={PALETTE.ok} />

      <GroundGrid world={world} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(min[0] + max[0]) / 2, 0, (min[1] + max[1]) / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={floorTex} roughness={0.95} metalness={0.05} />
      </mesh>
      {/* main corridor: the shared integration line all sectors flow into */}
      <Box position={[corridorX, 0.03, cz]} size={[corridorLen, 0.06, corridorW]} material={mat.platform()} />
      <Box position={[corridorX, 0.065, cz - corridorW / 2 + 0.1]} size={[corridorLen, 0.01, 0.05]} material={mat.glow(PALETTE.forge, 0.5)} shadows={false} />
      <Box position={[corridorX, 0.065, cz + corridorW / 2 - 0.1]} size={[corridorLen, 0.01, 0.05]} material={mat.glow(PALETTE.forge, 0.5)} shadows={false} />
      {/* one scooter lane per row */}
      {[-1, 1].map((side) => (
        <Box key={side} position={[corridorX, 0.065, cz + side * LAYOUT.laneOffset]} size={[corridorLen, 0.01, 0.04]} material={mat.glow(PALETTE.fog, 0.18)} shadows={false} />
      ))}
      {Array.from({ length: Math.floor(corridorLen / 2) }, (_, i) => (
        <Box
          key={i}
          position={[corridorX - corridorLen / 2 + 1 + i * 2, 0.065, cz]}
          size={[0.8, 0.01, 0.06]}
          material={mat.glow(PALETTE.fog, 0.25)}
          shadows={false}
        />
      ))}
    </>
  );
}
