import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SectorFeature } from '@config/world';
import { PALETTE } from '../../theme';
import type { Vec2 } from '../../world/worldModel';
import { Box, Cylinder, Decal, useCanvasTexture } from '../kit/Part';
import { useInteractive } from '../../interaction/useInteractive';
import { HOLO_CYAN, HoloMonitor, ProjectorRing, StatusOrb } from './holoProps';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

/** Static set dressing. Purely decorative, reused by every sector. */

/** Standing workstation with a holographic screen (facing +z). Clickable. */
export function Desk({ position, personId, seed, reducedMotion, yaw = 0 }: { position: Vec2; personId: string; seed: number; reducedMotion: boolean; yaw?: number }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'desk', id: personId });
  const [x, z] = position;
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]} {...handlers}>
      <Box position={[0, 0.98, 0]} size={[1.5, 0.05, 0.75]} material={mat.deskTop()} />
      <Box
        position={[0, 1.005, 0.3]}
        size={[1.46, 0.01, 0.08]}
        material={mat.glow(selected ? PALETTE.forgeBright : PALETTE.forge, selected ? 1.2 : hovered ? 0.8 : 0.35)}
        shadows={false}
      />
      <Box position={[-0.68, 0.49, 0]} size={[0.06, 0.98, 0.6]} material={mat.steel()} />
      <Box position={[0.68, 0.49, 0]} size={[0.06, 0.98, 0.6]} material={mat.steel()} />
      <HoloMonitor seed={seed} active={hovered || selected} selected={selected} reducedMotion={reducedMotion} />
    </group>
  );
}

/** Data board on the back wall. Content is drawn by the caller. */
export function Board({
  position,
  title,
  rows,
  state = 'idle',
  yaw = 0,
}: {
  position: Vec2;
  /** Room rotation. Rotated boards also print their face on the back so they stay readable from the default camera. */
  yaw?: number;
  state?: 'idle' | 'hover' | 'selected';
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
  const edgeGlow = state === 'selected' ? 1.6 : state === 'hover' ? 1.0 : 0.3;
  const [x, z] = position;
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <Box position={[0, 2.05, -0.06]} size={[3.3, 2.0, 0.08]} material={mat.rackMetal()} />
      <Decal texture={tex} position={[0, 2.05, -0.01]} size={[3.1, 1.82]} glow opacity={0.96} />
      {yaw !== 0 && <Decal texture={tex} position={[0, 2.05, -0.11]} size={[3.1, 1.82]} rotation={[0, Math.PI, 0]} glow opacity={0.96} />}
      <Box position={[0, 0.95, -0.06]} size={[0.08, 0.3, 0.08]} material={mat.steel()} />
      {/* frame glow: orange, stronger on hover / selection */}
      {[
        [0, 3.07, 3.36, 0.05],
        [0, 1.03, 3.36, 0.05],
      ].map(([px, py, sx, sy], i) => (
        <Box key={i} position={[px, py, 0]} size={[sx, sy, 0.03]} material={mat.glow(PALETTE.forge, edgeGlow)} shadows={false} />
      ))}
      {[-1.68, 1.68].map((px) => (
        <Box key={px} position={[px, 2.05, 0]} size={[0.05, 2.05, 0.03]} material={mat.glow(PALETTE.forge, edgeGlow)} shadows={false} />
      ))}
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

function MonitoringRoom({ alert, reducedMotion }: { alert: boolean; reducedMotion: boolean }) {
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
      <group position={[0, 0, 0.45]}>
        <StatusOrb alert={alert} reducedMotion={reducedMotion} />
      </group>
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

function CoordinationDesk({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group>
      <Box position={[0, 0.03, 0]} size={[3.8, 0.06, 2.6]} material={mat.graphite()} />
      <Cylinder position={[0, 0.48, 0]} radius={1.0} height={0.9} material={mat.rackMetal()} />
      <Cylinder position={[0, 0.94, 0]} radius={1.02} height={0.04} material={mat.glow(PALETTE.forge, 0.45)} />
      <Box position={[0, 1.5, -0.2]} size={[1.4, 0.8, 0.04]} material={mat.glass()} shadows={false} />
      <Box position={[0, 1.12, -0.2]} size={[1.4, 0.03, 0.05]} material={mat.glow(PALETTE.forgeBright, 0.8)} shadows={false} />
      <group position={[0, 0, 0.35]}>
        <ProjectorRing reducedMotion={reducedMotion} />
      </group>
    </group>
  );
}

export function FeatureProp({ feature, position, alert, reducedMotion, yaw = 0 }: { feature: SectorFeature; position: Vec2; alert: boolean; reducedMotion: boolean; yaw?: number }) {
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, yaw, 0]}>
      {feature === 'monitoring-room' && <MonitoringRoom alert={alert} reducedMotion={reducedMotion} />}
      {feature === 'architecture-room' && <ArchitectureRoom />}
      {feature === 'coordination-desk' && <CoordinationDesk reducedMotion={reducedMotion} />}
    </group>
  );
}

/** Holographic floor conduit: a translucent strip with a bright core, flush with the floor. */
const conduitGlass = new THREE.MeshBasicMaterial({ color: HOLO_CYAN, transparent: true, opacity: 0.16, toneMapped: false, depthWrite: false });
const conduitCore = new THREE.MeshBasicMaterial({ color: HOLO_CYAN, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });

export function CableTray({ from, to, y = 0.025 }: { from: Vec2; to: Vec2; y?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2];
  return (
    <group position={mid} rotation={[0, angle, 0]}>
      <Box position={[0, 0, 0]} size={[0.34, 0.01, len]} material={conduitGlass} shadows={false} />
      <Box position={[0, 0.008, 0]} size={[0.05, 0.01, len]} material={conduitCore} shadows={false} />
    </group>
  );
}
