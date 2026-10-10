import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCanvasTexture } from '../kit/Part';
import { drawPanelBase } from './holoDraw';
import type { Draw } from '../kit/canvasTexture';

const CW = 640;
const CH = 400;
const YAW = 0.62;

/**
 * Floating holographic panel: translucent canvas plane with a glowing frame.
 * Fixed yaw (faces the isometric camera, not a billboard). `drawKey` triggers redraws.
 */
export function HoloPanel({
  position,
  width = 3,
  draw,
  drawKey,
  reducedMotion,
  phase = 0,
}: {
  position: [number, number, number];
  width?: number;
  draw: Draw;
  drawKey: string;
  reducedMotion: boolean;
  phase?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const height = (width * CH) / CW;

  const tex = useCanvasTexture(
    CW,
    CH,
    (ctx, w, h) => {
      drawPanelBase(ctx, w, h);
      draw(ctx, w, h);
    },
    [drawKey],
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    born.current ??= t;
    const k = reducedMotion ? 1 : Math.min(1, (t - born.current) / 0.35);
    const ease = 1 - (1 - k) ** 3;
    g.scale.setScalar(Math.max(0.001, ease));
    g.position.y = position[1] + (reducedMotion ? 0 : Math.sin(t * 1.1 + phase) * 0.06);
    if (matRef.current) matRef.current.opacity = ease;
  });

  return (
    <group ref={group} position={position} rotation={[0, YAW, 0]} renderOrder={10}>
      <mesh scale={[width, height, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={matRef} map={tex} transparent opacity={reducedMotion ? 1 : 0} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[0, 0, 0.005]} scale={[width, height, 1]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(1, 1)]} />
        <lineBasicMaterial color="#38E1FF" toneMapped={false} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}
