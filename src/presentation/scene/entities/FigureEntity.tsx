import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Contributor, ContributorRole } from '@domain/entities';
import { PALETTE } from '../../theme';
import type { FigureLayout } from '../../world/worldModel';
import { sample, type CompiledScript } from '../../animation/script';
import { rigPose } from '../../animation/rig';
import { useInteractive } from '../../interaction/useInteractive';
import { livePositions } from '../../interaction/livePositions';
import { Box } from '../kit/Part';
import { mat } from '../kit/materials';

interface Outfit {
  shirt: string;
  trim: string;
  pants: string;
  device: 'laptop' | 'tablet' | 'card' | null;
}

/** Role → outfit. Unknown role gets a neutral outfit: we never invent a function. */
const OUTFITS: Record<ContributorRole | 'unknown', Outfit> = {
  developer: { shirt: '#2A2F38', trim: PALETTE.forge, pants: '#1A1D23', device: 'laptop' },
  reviewer: { shirt: '#3B4656', trim: PALETTE.forgeBright, pants: '#1D2129', device: 'tablet' },
  'tech-lead': { shirt: '#1E2128', trim: PALETTE.warn, pants: '#2B2F37', device: 'tablet' },
  'product-manager': { shirt: '#D9D4CB', trim: PALETTE.forge, pants: '#2A2E36', device: 'card' },
  unknown: { shirt: '#4A505C', trim: '#9DA3AE', pants: '#22262E', device: null },
};

const SKIN = ['#E8C3A0', '#C99A72', '#9C6B4A', '#F1D3B6', '#B07D58', '#7A5236'];
const HAIR = ['#1B1714', '#3A2A1E', '#6B4A2E', '#121212', '#8A6A4A', '#2C2C33'];

function pick<T>(list: T[], seed: string, salt: number): T {
  let h = salt;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

interface Props {
  layout: FigureLayout;
  person: Contributor;
  script: CompiledScript;
  dimmed: boolean;
  reducedMotion: boolean;
}

/**
 * Block-built mini figure. Its pose comes from the animation system; this
 * component only maps joint angles onto meshes. Purely illustrative.
 */
export function FigureEntity({ layout, person, script, dimmed, reducedMotion }: Props) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'person', id: person.id });
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const device = useRef<THREE.Group>(null);

  const outfit = OUTFITS[person.role ?? 'unknown'];
  const look = useMemo(
    () => ({
      skin: mat.matte(pick(SKIN, person.id, 7)),
      hair: mat.matte(pick(HAIR, person.id, 13)),
      shirt: mat.matte(outfit.shirt),
      trim: mat.emissive(outfit.trim, 0.6),
      pants: mat.matte(outfit.pants),
      shoes: mat.rubber(),
      eye: mat.matte('#111317'),
    }),
    [person.id, outfit],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const pose = reducedMotion
      ? { position: layout.home, heading: Math.PI, action: 'idle' as const, elapsed: 0 }
      : sample(script, time);
    const rig = rigPose(pose.action, pose.elapsed, reducedMotion ? 0 : time);
    if (root.current) {
      root.current.position.set(pose.position[0], 0, pose.position[1]);
      // Smooth turning instead of snapping between segments.
      const current = root.current.rotation.y;
      const delta = Math.atan2(Math.sin(pose.heading - current), Math.cos(pose.heading - current));
      root.current.rotation.y = current + delta * Math.min(1, reducedMotion ? 1 : 0.18);
    }
    livePositions.set(person.id, pose.position);
    if (body.current) body.current.position.y = rig.bob;
    if (head.current) head.current.rotation.x = rig.headPitch;
    if (armL.current) armL.current.rotation.set(rig.armL, 0, rig.armSpread);
    if (armR.current) armR.current.rotation.set(rig.armR, 0, -rig.armSpread);
    if (legL.current) legL.current.rotation.x = rig.legL;
    if (legR.current) legR.current.rotation.x = rig.legR;
    if (device.current) device.current.visible = rig.holdsDevice && outfit.device !== null && pose.action !== 'type';
  });

  const ring = hovered || selected;

  return (
    <group ref={root} {...handlers} scale={dimmed ? 0.9 : 1}>
      {/* invisible, generous hit volume */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.6, 1.2, 0.5]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={body}>
        {/* legs (pivot at hip) */}
        <group ref={legL} position={[-0.085, 0.42, 0]}>
          <Box position={[0, -0.18, 0]} size={[0.15, 0.36, 0.17]} material={look.pants} />
          <Box position={[0, -0.39, 0.03]} size={[0.16, 0.07, 0.22]} material={look.shoes} />
        </group>
        <group ref={legR} position={[0.085, 0.42, 0]}>
          <Box position={[0, -0.18, 0]} size={[0.15, 0.36, 0.17]} material={look.pants} />
          <Box position={[0, -0.39, 0.03]} size={[0.16, 0.07, 0.22]} material={look.shoes} />
        </group>

        {/* hips + torso */}
        <Box position={[0, 0.45, 0]} size={[0.34, 0.08, 0.19]} material={look.pants} />
        <mesh position={[0, 0.66, 0]} castShadow material={look.shirt}>
          <cylinderGeometry args={[0.17, 0.2, 0.36, 4, 1]} />
        </mesh>
        <Box position={[0, 0.6, 0.142]} size={[0.06, 0.2, 0.01]} material={look.trim} shadows={false} />

        {/* arms (pivot at shoulder) */}
        <group ref={armL} position={[-0.235, 0.8, 0]}>
          <Box position={[0, -0.14, 0]} size={[0.1, 0.3, 0.12]} material={look.shirt} />
          <Box position={[0, -0.31, 0]} size={[0.09, 0.07, 0.1]} material={look.skin} />
        </group>
        <group ref={armR} position={[0.235, 0.8, 0]}>
          <Box position={[0, -0.14, 0]} size={[0.1, 0.3, 0.12]} material={look.shirt} />
          <Box position={[0, -0.31, 0]} size={[0.09, 0.07, 0.1]} material={look.skin} />
          <group ref={device} position={[-0.12, -0.36, 0.12]} rotation={[-0.4, 0, 0]} visible={false}>
            {outfit.device === 'tablet' && (
              <>
                <Box position={[0, 0, 0]} size={[0.26, 0.02, 0.19]} material={mat.rackMetal()} />
                <Box position={[0, 0.012, 0]} size={[0.22, 0.005, 0.15]} material={mat.glow(PALETTE.forgeBright, 0.8)} shadows={false} />
              </>
            )}
            {outfit.device === 'card' && <Box position={[0, 0, 0]} size={[0.18, 0.01, 0.13]} material={mat.glow(PALETTE.ok, 0.7)} shadows={false} />}
            {outfit.device === 'laptop' && <Box position={[0, 0, 0]} size={[0.28, 0.025, 0.2]} material={mat.steel()} />}
          </group>
        </group>

        {/* neck + head */}
        <Box position={[0, 0.87, 0]} size={[0.1, 0.05, 0.1]} material={look.skin} />
        <group ref={head} position={[0, 0.89, 0]}>
          <RoundedBox args={[0.27, 0.26, 0.25]} radius={0.05} smoothness={2} position={[0, 0.13, 0]} castShadow material={look.skin} />
          <RoundedBox args={[0.29, 0.09, 0.27]} radius={0.03} smoothness={2} position={[0, 0.27, -0.01]} material={look.hair} />
          <Box position={[0, 0.2, -0.11]} size={[0.29, 0.14, 0.05]} material={look.hair} shadows={false} />
          <Box position={[-0.06, 0.15, 0.126]} size={[0.035, 0.045, 0.005]} material={look.eye} shadows={false} />
          <Box position={[0.06, 0.15, 0.126]} size={[0.035, 0.045, 0.005]} material={look.eye} shadows={false} />
          {person.role === 'tech-lead' && (
            <Box position={[0.15, 0.13, 0]} size={[0.03, 0.12, 0.08]} material={mat.emissive(PALETTE.warn, 0.8)} shadows={false} />
          )}
        </group>
      </group>

      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.36, 0.44, 40]} />
          <meshBasicMaterial color={selected ? PALETTE.forge : PALETTE.snow} transparent opacity={selected ? 0.95 : 0.5} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
