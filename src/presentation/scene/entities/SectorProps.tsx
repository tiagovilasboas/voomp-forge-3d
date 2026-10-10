import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../../theme';
import type { SectorLayout } from '../../world/worldModel';
import { toWorld } from '../../world/frame';
import { Box, Cylinder, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';

interface Props {
  layout: SectorLayout;
  openPRCount: number;
  reducedMotion: boolean;
}

const PLATFORM_H = 0.14;

// ---------------------------------------------------------------------------
// HoloMapTable — flat surface with a dot-grid proportional to open PR count
// ---------------------------------------------------------------------------
function HoloMapTable({ pos, openPRCount }: { pos: [number, number, number]; openPRCount: number }) {
  const count = Math.min(8, openPRCount);
  const tex = useCanvasTexture(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = 'rgba(10,18,32,0.88)';
      ctx.fillRect(0, 0, w, h);
      // scanlines
      ctx.fillStyle = 'rgba(56,225,255,0.07)';
      for (let y = 0; y < h; y += 10) ctx.fillRect(0, y, w, 2);
      // dot grid: 4×2, lit dots = open PRs
      const spacing = 28;
      const cols = 4;
      const rows = 2;
      const ox = (w - (cols - 1) * spacing) / 2;
      const oy = (h - (rows - 1) * spacing) / 2;
      for (let i = 0; i < cols * rows; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const active = i < count;
        ctx.beginPath();
        ctx.arc(ox + col * spacing, oy + row * spacing, active ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = active ? PALETTE.forgeBright : 'rgba(56,225,255,0.15)';
        ctx.fill();
      }
      // border
      ctx.strokeStyle = 'rgba(56,225,255,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    },
    [count],
  );

  return (
    <group position={pos}>
      <Box position={[0, 0, 0]} size={[2.0, 0.06, 1.2]} material={mat.platform()} />
      <Box position={[0, 0.04, 0]} size={[2.02, 0.008, 1.22]} material={mat.glow(PALETTE.forgeBright, 0.45)} shadows={false} />
      {/* holo screen */}
      <mesh position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.85, 1.05]} />
        <meshBasicMaterial map={tex} transparent opacity={0.82} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* legs */}
      {([-0.8, 0.8] as const).flatMap((x) =>
        ([-0.44, 0.44] as const).map((z) => (
          <Box key={`${x}${z}`} position={[x, -0.13, z]} size={[0.05, 0.2, 0.05]} material={mat.steel()} shadows={false} />
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// DataCrystal — slowly rotating octahedron
// ---------------------------------------------------------------------------
function DataCrystal({ pos, reducedMotion }: { pos: [number, number, number]; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && !reducedMotion) ref.current.rotation.y = clock.elapsedTime * 0.55;
  });
  return (
    <group position={pos}>
      <Box position={[0, 0, 0]} size={[0.5, 0.07, 0.5]} material={mat.platform()} />
      <Box position={[0, 0.04, 0]} size={[0.52, 0.008, 0.52]} material={mat.glow('#38E1FF', 0.45)} shadows={false} />
      <mesh ref={ref} position={[0, 0.6, 0]}>
        <octahedronGeometry args={[0.36]} />
        <meshStandardMaterial
          color="#0A1F30"
          emissive="#38E1FF"
          emissiveIntensity={0.7}
          roughness={0.06}
          metalness={0.4}
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// HoloPedestal — cylinder with a spinning holographic ring
// ---------------------------------------------------------------------------
function HoloPedestal({ pos, reducedMotion }: { pos: [number, number, number]; reducedMotion: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current && !reducedMotion) {
      ringRef.current.rotation.y = clock.elapsedTime * 0.75;
      ringRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.38) * 0.28;
    }
  });
  return (
    <group position={pos}>
      <Cylinder position={[0, 0.38, 0]} radius={0.27} height={0.76} material={mat.platform()} />
      <Cylinder position={[0, 0.77, 0]} radius={0.29} height={0.03} material={mat.glow('#38E1FF', 0.5)} />
      <mesh ref={ringRef} position={[0, 1.22, 0]}>
        <torusGeometry args={[0.46, 0.032, 8, 32]} />
        <meshStandardMaterial color="#38E1FF" emissive="#38E1FF" emissiveIntensity={1.3} roughness={0.08} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// SectorProps — 3 landmarks in the rear half of each squad room
// ---------------------------------------------------------------------------
/**
 * Holographic props placed in the empty rear half of a squad sector.
 * Positions are computed from the room layout so they always sit inside the
 * room regardless of facing or width. None carry per-person data —
 * openPRCount is the room-level aggregate from the data store.
 */
export function SectorProps({ layout, openPRCount, reducedMotion }: Props) {
  const [w] = layout.size;
  // Convert room-local [lx, lz] → world [x, PLATFORM_H, z].
  // Local z is negative = rear of the room (away from the corridor).
  const at = ([lx, lz]: [number, number]): [number, number, number] => {
    const [wx, wz] = toWorld(layout.center, layout.facing, [lx, lz]);
    return [wx, PLATFORM_H, wz];
  };

  return (
    <>
      <HoloMapTable pos={at([-w * 0.22, -4.2])} openPRCount={openPRCount} />
      <DataCrystal pos={at([0, -5.0])} reducedMotion={reducedMotion} />
      <HoloPedestal pos={at([w * 0.22, -4.2])} reducedMotion={reducedMotion} />
    </>
  );
}
