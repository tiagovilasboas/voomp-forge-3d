import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { geo, mat } from './materials';
import { makeCanvasTexture, type Draw } from './canvasTexture';

type V3 = [number, number, number];

/** A unit box scaled into place — the basic brick of every prop. */
export function Box({
  position,
  size,
  material = mat.graphite(),
  rotation,
  shadows = true,
}: {
  position: V3;
  size: V3;
  material?: THREE.Material;
  rotation?: V3;
  shadows?: boolean;
}) {
  return (
    <mesh
      geometry={geo.box()}
      material={material}
      position={position}
      rotation={rotation}
      scale={size}
      castShadow={shadows}
      receiveShadow={shadows}
    />
  );
}

export function Cylinder({ position, radius, height, material = mat.steel() }: { position: V3; radius: number; height: number; material?: THREE.Material }) {
  return <mesh geometry={geo.cylinder()} material={material} position={position} scale={[radius * 2, height, radius * 2]} castShadow />;
}

/** Canvas texture that is redrawn when `deps` change and disposed on unmount. */
export function useCanvasTexture(width: number, height: number, draw: Draw, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(() => makeCanvasTexture(width, height, draw), deps);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** A flat textured plane (sign, screen, floor decal). */
export function Decal({
  texture,
  position,
  size,
  rotation = [0, 0, 0],
  glow = false,
  opacity = 1,
}: {
  texture: THREE.Texture;
  position: V3;
  size: [number, number];
  rotation?: V3;
  glow?: boolean;
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} scale={[size[0], size[1], 1]} geometry={geo.plane()}>
      {glow ? (
        <meshBasicMaterial map={texture} transparent opacity={opacity} toneMapped={false} depthWrite={false} />
      ) : (
        <meshStandardMaterial map={texture} transparent opacity={opacity} roughness={0.6} depthWrite={false} />
      )}
    </mesh>
  );
}
