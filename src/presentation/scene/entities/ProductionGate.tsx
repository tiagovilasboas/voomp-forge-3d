import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { PALETTE } from '../../theme';
import type { Vec2 } from '../../world/worldModel';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

function useSignTexture(title: string, value: number, sub: string, color: string) {
  return useCanvasTexture(
    512,
    160,
    (ctx, w, h) => {
      ctx.fillStyle = '#0A0D11';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(0, h - 8, w, 8);
      ctx.font = FONTS.display(54, 700);
      ctx.fillText(title, 24, 70);
      ctx.fillStyle = '#9DA3AE';
      ctx.font = FONTS.mono(22, 500);
      ctx.fillText(sub, 24, 118);
      ctx.fillStyle = '#F5F5F5';
      ctx.font = FONTS.display(72, 700);
      const v = String(value);
      ctx.fillText(v, w - 28 - ctx.measureText(v).width, 96);
    },
    [title, value, sub, color],
  );
}

/**
 * Portão de produção = deployment confirmed in production. Only successful
 * production deployments light it up — merges never reach it.
 */
export function ProductionGate({
  gate,
  dock,
  productionCount,
  stagingCount,
  reducedMotion,
}: {
  gate: Vec2;
  dock: Vec2;
  productionCount: number;
  stagingCount: number;
  reducedMotion: boolean;
}) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'gate' });
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const chevrons = useRef<(THREE.Group | null)[]>([]);
  const gateSign = useSignTexture('PRODUÇÃO', productionCount, 'DEPLOYS CONFIRMADOS', PALETTE.ok);
  const dockSign = useSignTexture('STAGING', stagingCount, 'DEPLOYS EM HOMOLOGAÇÃO', PALETTE.warn);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beam.current) {
      // Stronger pulse when the gate is lit (a production deploy has landed).
      const base = productionCount ? 0.3 : 0.08;
      const amp = productionCount ? 0.22 : 0;
      beam.current.opacity = reducedMotion ? base + amp * 0.5 : base + (Math.sin(t * 1.6) + 1) * 0.5 * amp;
    }
    chevrons.current.forEach((c, i) => {
      if (!c) return;
      // Chevrons drift along +z to signal flow direction; frozen when reduced-motion.
      c.position.z = reducedMotion ? 0.12 : 0.12 + Math.sin(t * 2 + i) * 0.18;
    });
  });

  const lit = productionCount > 0;
  const hl = hovered || selected;

  return (
    <group {...handlers}>
      {/* corridor apron */}
      <Box position={[(gate[0] + dock[0]) / 2, 0.02, gate[1] - 0.2]} size={[Math.abs(gate[0] - dock[0]) + 6, 0.04, 4.2]} material={mat.platform()} />

      {/* production arch — thin emissive frame instead of solid metal mass */}
      <group position={[gate[0], 0, gate[1]]}>
        <Box position={[0, 0.06, 0]} size={[4.4, 0.12, 2.2]} material={mat.graphite()} />
        {/* pillars: thin emissive edges (0.08 wide) */}
        <Box position={[-1.9, 1.6, 0]} size={[0.08, 3.2, 0.08]} material={mat.glow(PALETTE.ok, 1.0)} shadows={false} />
        <Box position={[1.9, 1.6, 0]} size={[0.08, 3.2, 0.08]} material={mat.glow(PALETTE.ok, 1.0)} shadows={false} />
        {/* lintel: thin emissive edge, no solid mass */}
        <Box position={[0, 3.2, 0]} size={[3.88, 0.08, 0.08]} material={mat.glow(PALETTE.ok, 1.0)} shadows={false} />
        {/* existing fine inner edges — state-reactive glow */}
        <Box position={[-1.64, 1.6, 0]} size={[0.03, 3.0, 0.5]} material={mat.glow(lit ? PALETTE.ok : PALETTE.idle, hl ? 1.8 : 1.2)} shadows={false} />
        <Box position={[1.64, 1.6, 0]} size={[0.03, 3.0, 0.5]} material={mat.glow(lit ? PALETTE.ok : PALETTE.idle, hl ? 1.8 : 1.2)} shadows={false} />
        <Decal texture={gateSign} position={[0, 3.35, 0.41]} size={[2.6, 0.8]} glow />
        {/* translucent mint portal */}
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[3.2, 3.1, 0.05]} />
          <meshBasicMaterial ref={beam} color={PALETTE.ok} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
        </mesh>
        {/* flow-direction chevrons — three mint arrows drifting along +z */}
        {[0.6, 1.6, 2.6].map((y, i) => (
          <group key={y} ref={(el) => { chevrons.current[i] = el; }} position={[0, y, 0.12]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.22, 0.4, 3]} />
              <meshBasicMaterial color={PALETTE.ok} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
        ))}
      </group>

      {/* staging dock */}
      <group position={[dock[0], 0, dock[1]]}>
        <Box position={[0, 0.07, 0]} size={[3.6, 0.14, 2.4]} material={mat.graphite()} />
        <Box position={[0, 0.145, 1.17]} size={[3.6, 0.02, 0.06]} material={mat.glow(PALETTE.warn, 0.9)} shadows={false} />
        <Box position={[-1.6, 1.0, -0.9]} size={[0.14, 2.0, 0.14]} material={mat.steel()} />
        <Box position={[1.6, 1.0, -0.9]} size={[0.14, 2.0, 0.14]} material={mat.steel()} />
        <Box position={[0, 2.0, -0.9]} size={[3.6, 0.7, 0.14]} material={mat.rackMetal()} />
        <Decal texture={dockSign} position={[0, 2.0, -0.82]} size={[2.2, 0.68]} glow />
      </group>
    </group>
  );
}
