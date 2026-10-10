import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec2 } from '../../world/worldModel';
import type { Draw } from '../kit/canvasTexture';
import { useCanvasTexture } from '../kit/Part';
import { drawPanelBase } from '../holo/holoDraw';
import { SIGN_YAW } from '../kit/orientation';

const PLANE = new THREE.PlaneGeometry(1, 1);
const EDGES = new THREE.EdgesGeometry(PLANE);

/** Shared holographic wall: glowing canvas plane on two posts, yaw facing the camera. */
export function HoloWall({
  position,
  size,
  canvas,
  draw,
  drawKey,
  hovered,
  selected,
  reducedMotion,
  handlers,
}: {
  position: Vec2;
  size: [number, number];
  canvas: [number, number];
  draw: Draw;
  drawKey: string;
  hovered: boolean;
  selected: boolean;
  reducedMotion: boolean;
  handlers: object;
}) {
  const group = useRef<THREE.Group>(null);
  const tex = useCanvasTexture(
    canvas[0],
    canvas[1],
    (ctx, w, h) => {
      drawPanelBase(ctx, w, h);
      draw(ctx, w, h);
    },
    [drawKey],
  );
  const [w, h] = size;
  const baseY = 0.5 + h / 2;
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = baseY + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.9 + position[0]) * 0.04);
  });
  const edge = selected ? '#FF8C32' : hovered ? '#FFFFFF' : '#38E1FF';
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, SIGN_YAW, 0]} {...handlers}>
      <mesh position={[-w / 2 + 0.2, 0.25, -0.04]} scale={[0.08, 0.5, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2A3340" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[w / 2 - 0.2, 0.25, -0.04]} scale={[0.08, 0.5, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2A3340" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={group} position={[0, baseY, 0]} renderOrder={10}>
        <mesh geometry={PLANE} scale={[w, h, 1]}>
          <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <lineSegments geometry={EDGES} position={[0, 0, 0.005]} scale={[w, h, 1]}>
          <lineBasicMaterial color={edge} toneMapped={false} transparent opacity={hovered || selected ? 1 : 0.85} />
        </lineSegments>
        {(hovered || selected) && (
          <mesh geometry={PLANE} position={[0, 0, -0.01]} scale={[w + 0.12, h + 0.12, 1]}>
            <meshBasicMaterial color={selected ? '#FF8C32' : '#38E1FF'} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}
