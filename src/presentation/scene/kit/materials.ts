import * as THREE from 'three';
import { PALETTE } from '../../theme';

/**
 * Shared, cached materials. Reusing instances keeps draw-call state changes
 * low and makes the whole world restylable from one place.
 */
const cache = new Map<string, THREE.Material>();

function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

export const mat = {
  /** Matte black rack metal — kept for the plinth/header trim. */
  rackMetal: () => cached('rackMetal', () => new THREE.MeshStandardMaterial({ color: '#16191F', roughness: 0.55, metalness: 0.65 })),
  /** Translucent holographic glass shell for the rack body. */
  rackGlass: () =>
    cached(
      'rackGlass',
      () =>
        new THREE.MeshStandardMaterial({
          color: '#0B1422',
          roughness: 0.06,
          metalness: 0.45,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
    ),
  rackInner: () => cached('rackInner', () => new THREE.MeshStandardMaterial({ color: '#0C0E12', roughness: 0.8, metalness: 0.3 })),
  blade: () => cached('blade', () => new THREE.MeshStandardMaterial({ color: '#23272F', roughness: 0.6, metalness: 0.5 })),
  graphite: () => cached('graphite', () => new THREE.MeshStandardMaterial({ color: PALETTE.ink700, roughness: 0.75, metalness: 0.25 })),
  steel: () => cached('steel', () => new THREE.MeshStandardMaterial({ color: '#3A404B', roughness: 0.4, metalness: 0.8 })),
  floor: () => cached('floor', () => new THREE.MeshStandardMaterial({ color: '#111419', roughness: 0.92, metalness: 0.1 })),
  platform: () => cached('platform', () => new THREE.MeshStandardMaterial({ color: '#171A21', roughness: 0.85, metalness: 0.2 })),
  wall: () => cached('wall', () => new THREE.MeshStandardMaterial({ color: '#12151B', roughness: 0.9, metalness: 0.15 })),
  glass: () =>
    cached(
      'glass',
      () =>
        new THREE.MeshStandardMaterial({
          color: '#1B2230',
          roughness: 0.08,
          metalness: 0.3,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
    ),
  deskTop: () => cached('deskTop', () => new THREE.MeshStandardMaterial({ color: '#2B3039', roughness: 0.55, metalness: 0.35 })),
  rubber: () => cached('rubber', () => new THREE.MeshStandardMaterial({ color: '#0A0B0E', roughness: 0.95 })),
  /** Unlit glow (feeds bloom). Colour per key. */
  glow: (color: string, intensity = 1) =>
    cached(`glow:${color}:${intensity}`, () => {
      const c = new THREE.Color(color).multiplyScalar(intensity);
      return new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    }),
  /** Lit surface with emissive accent. */
  emissive: (color: string, intensity = 1.2) =>
    cached(
      `emissive:${color}:${intensity}`,
      () => new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: intensity, roughness: 0.5 }),
    ),
  matte: (color: string) => cached(`matte:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05 })),
};

/** Shared unit geometries, scaled per mesh. */
const geoCache = new Map<string, THREE.BufferGeometry>();
export const geo = {
  box: () => geoCache.get('box') ?? (geoCache.set('box', new THREE.BoxGeometry(1, 1, 1)), geoCache.get('box')!),
  cylinder: () =>
    geoCache.get('cyl') ?? (geoCache.set('cyl', new THREE.CylinderGeometry(0.5, 0.5, 1, 20)), geoCache.get('cyl')!),
  plane: () => geoCache.get('plane') ?? (geoCache.set('plane', new THREE.PlaneGeometry(1, 1)), geoCache.get('plane')!),
};
