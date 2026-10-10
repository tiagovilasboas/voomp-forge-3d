import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { SectorFeature } from '@config/world';
import { PALETTE } from '../../theme';
import type { Vec2 } from '../../world/worldModel';
import { Box, Cylinder, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

/** Static set dressing. Purely decorative, reused by every sector. */

function codeScreen(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#0A0D12';
  ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 10; y < h - 6; y += 12) {
    let x = 10 + Math.floor(rand() * 3) * 14;
    const tokens = 2 + Math.floor(rand() * 4);
    for (let t = 0; t < tokens && x < w - 20; t++) {
      const len = 16 + rand() * 50;
      ctx.fillStyle = rand() > 0.75 ? PALETTE.forge : rand() > 0.5 ? '#5E6675' : '#C9CDD4';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, len, 5);
      x += len + 8;
    }
  }
  ctx.globalAlpha = 1;
}

/** Standing workstation with a monitor (facing +z). */
export function Desk({ position, seed }: { position: Vec2; seed: number }) {
  const screen = useCanvasTexture(256, 160, (ctx, w, h) => codeScreen(ctx, w, h, seed), [seed]);
  const [x, z] = position;
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 0.98, 0]} size={[1.5, 0.05, 0.75]} material={mat.deskTop()} />
      <Box position={[0, 1.005, 0.3]} size={[1.46, 0.01, 0.08]} material={mat.glow(PALETTE.forge, 0.35)} shadows={false} />
      <Box position={[-0.68, 0.49, 0]} size={[0.06, 0.98, 0.6]} material={mat.steel()} />
      <Box position={[0.68, 0.49, 0]} size={[0.06, 0.98, 0.6]} material={mat.steel()} />
      {/* monitor */}
      <Box position={[0, 1.08, -0.18]} size={[0.06, 0.16, 0.06]} material={mat.steel()} />
      <Box position={[0, 1.4, -0.2]} size={[0.92, 0.56, 0.05]} material={mat.rackMetal()} />
      <Decal texture={screen} position={[0, 1.4, -0.172]} size={[0.86, 0.5]} glow opacity={0.95} />
      {/* keyboard */}
      <Box position={[0, 1.015, 0.1]} size={[0.5, 0.02, 0.16]} material={mat.blade()} shadows={false} />
    </group>
  );
}

/** Data board on the back wall. Content is drawn by the caller. */
export function Board({
  position,
  title,
  rows,
}: {
  position: Vec2;
  title: string;
  rows: { label: string; value: number; color: string }[];
}) {
  const key = rows.map((r) => `${r.label}${r.value}`).join('|');
  const tex = useCanvasTexture(
    512,
    300,
    (ctx, w, h) => {
      ctx.fillStyle = '#0B0E13';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,106,0,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = PALETTE.forge;
      ctx.font = FONTS.mono(22, 700);
      ctx.fillText(title.toUpperCase(), 24, 44);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(24, 58, w - 48, 2);
      rows.forEach((r, i) => {
        const y = 104 + i * 58;
        ctx.fillStyle = '#9DA3AE';
        ctx.font = FONTS.display(26, 500);
        ctx.fillText(r.label, 24, y);
        ctx.fillStyle = r.color;
        ctx.font = FONTS.display(44, 700);
        const v = String(r.value);
        ctx.fillText(v, w - 30 - ctx.measureText(v).width, y + 4);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(24, y + 18, w - 48, 1);
      });
    },
    [title, key],
  );
  const [x, z] = position;
  return (
    <group position={[x, 0, z]}>
      <Box position={[0, 2.05, -0.06]} size={[3.3, 2.0, 0.08]} material={mat.rackMetal()} />
      <Decal texture={tex} position={[0, 2.05, -0.01]} size={[3.1, 1.82]} glow opacity={0.96} />
      <Box position={[0, 0.95, -0.06]} size={[0.08, 0.3, 0.08]} material={mat.steel()} />
    </group>
  );
}

function Hologram() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5;
  });
  return (
    <mesh ref={ref} position={[0, 1.55, 0]}>
      <icosahedronGeometry args={[0.45, 1]} />
      <meshBasicMaterial color={PALETTE.forgeBright} wireframe toneMapped={false} transparent opacity={0.85} />
    </mesh>
  );
}

function GlassRoom({ size, children }: { size: [number, number]; children?: React.ReactNode }) {
  const [w, d] = size;
  const h = 2.2;
  return (
    <group>
      <Box position={[0, 0.03, 0]} size={[w, 0.06, d]} material={mat.graphite()} />
      <Box position={[0, h / 2, -d / 2]} size={[w, h, 0.05]} material={mat.glass()} shadows={false} />
      <Box position={[-w / 2, h / 2, 0]} size={[0.05, h, d]} material={mat.glass()} shadows={false} />
      <Box position={[w / 2, h / 2, 0]} size={[0.05, h, d]} material={mat.glass()} shadows={false} />
      {[-w / 2, w / 2].map((x) =>
        [-d / 2, d / 2].map((z) => <Box key={`${x}${z}`} position={[x, h / 2, z]} size={[0.07, h, 0.07]} material={mat.steel()} />),
      )}
      <Box position={[0, h, -d / 2]} size={[w, 0.06, 0.08]} material={mat.glow(PALETTE.forge, 0.6)} shadows={false} />
      {children}
    </group>
  );
}

function MonitoringRoom() {
  const wall = useCanvasTexture(
    512,
    200,
    (ctx, w, h) => {
      ctx.fillStyle = '#0A0D12';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const x0 = 10 + i * 168;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(x0, 10, 154, h - 20);
        ctx.strokeStyle = i === 1 ? PALETTE.warn : PALETTE.ok;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) {
          const y = h / 2 + Math.sin(k * (0.7 + i * 0.3)) * 28 + (k % 5 === 0 ? -18 : 0);
          if (k === 0) ctx.moveTo(x0 + 8, y);
          else ctx.lineTo(x0 + 8 + k * 7, y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    },
    [],
  );
  return (
    <GlassRoom size={[4.2, 2.8]}>
      <Box position={[0, 1.45, -1.3]} size={[3.6, 1.1, 0.06]} material={mat.rackMetal()} />
      <Decal texture={wall} position={[0, 1.45, -1.26]} size={[3.5, 1.0]} glow opacity={0.95} />
      <Box position={[0, 0.5, -0.3]} size={[2.6, 0.9, 0.5]} material={mat.graphite()} />
      <Box position={[0, 0.96, -0.3]} size={[2.6, 0.03, 0.5]} material={mat.glow(PALETTE.forge, 0.25)} shadows={false} />
    </GlassRoom>
  );
}

function ArchitectureRoom() {
  return (
    <GlassRoom size={[4.2, 2.8]}>
      <Cylinder position={[0, 0.5, 0]} radius={0.85} height={0.9} material={mat.graphite()} />
      <Cylinder position={[0, 0.96, 0]} radius={0.86} height={0.04} material={mat.glow(PALETTE.forge, 0.4)} />
      <Hologram />
    </GlassRoom>
  );
}

function CoordinationDesk() {
  return (
    <group>
      <Box position={[0, 0.03, 0]} size={[3.8, 0.06, 2.6]} material={mat.graphite()} />
      <Cylinder position={[0, 0.48, 0]} radius={1.0} height={0.9} material={mat.rackMetal()} />
      <Cylinder position={[0, 0.94, 0]} radius={1.02} height={0.04} material={mat.glow(PALETTE.forge, 0.45)} />
      <Box position={[0, 1.5, -0.2]} size={[1.4, 0.8, 0.04]} material={mat.glass()} shadows={false} />
      <Box position={[0, 1.12, -0.2]} size={[1.4, 0.03, 0.05]} material={mat.glow(PALETTE.forgeBright, 0.8)} shadows={false} />
    </group>
  );
}

export function FeatureProp({ feature, position }: { feature: SectorFeature; position: Vec2 }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      {feature === 'monitoring-room' && <MonitoringRoom />}
      {feature === 'architecture-room' && <ArchitectureRoom />}
      {feature === 'coordination-desk' && <CoordinationDesk />}
    </group>
  );
}

/** Overhead cable tray with a faint glowing conduit. */
export function CableTray({ from, to, y = 3.4 }: { from: Vec2; to: Vec2; y?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2];
  return (
    <group position={mid} rotation={[0, angle, 0]}>
      <Box position={[0, 0, 0]} size={[0.32, 0.06, len]} material={mat.steel()} shadows={false} />
      <Box position={[0, 0.045, 0]} size={[0.06, 0.03, len]} material={mat.glow(PALETTE.forge, 0.35)} shadows={false} />
    </group>
  );
}
