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

interface RoleStyle {
  /** Accent light: antenna, eyes, chest strip. */
  accent: string;
  device: 'laptop' | 'tablet' | 'card' | null;
}

/** Role → accent. Unknown role stays neutral grey: a function is never invented. */
const ROLE_STYLE: Record<ContributorRole | 'unknown', RoleStyle> = {
  developer: { accent: PALETTE.forge, device: 'laptop' },
  reviewer: { accent: PALETTE.forgeBright, device: 'tablet' },
  'tech-lead': { accent: PALETTE.warn, device: 'tablet' },
  'product-manager': { accent: PALETTE.snow, device: 'card' },
  unknown: { accent: PALETTE.fog, device: null },
};

/** Neutral shell finishes, varied per person (no skin tones, no gender cues). */
const SHELLS = ['#2B3038', '#3A404A', '#C9CDD3', '#B9AE9C', '#4A4F58', '#8E949E'];

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

const JOINT = new THREE.SphereGeometry(1, 12, 10);
const LIMB = new THREE.CylinderGeometry(1, 1, 1, 12);

/**
 * Unisex block robot. Its pose comes from the animation system; this component
 * only maps joint angles onto meshes. Purely illustrative.
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
  const eyes = useRef<THREE.Group>(null);
  const antenna = useRef<THREE.MeshBasicMaterial>(null);

  const style = ROLE_STYLE[person.role ?? 'unknown'];
  const look = useMemo(() => {
    const shell = pick(SHELLS, person.id, 11);
    const light = new THREE.Color(shell).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
    return {
      shell: new THREE.MeshStandardMaterial({ color: shell, roughness: 0.42, metalness: 0.55 }),
      frame: mat.rackMetal(),
      joint: mat.steel(),
      visor: new THREE.MeshStandardMaterial({ color: '#07090C', roughness: 0.15, metalness: 0.6 }),
      accentGlow: mat.glow(style.accent, 1.4),
      accentSoft: mat.emissive(style.accent, 0.5),
      trim: light ? mat.rackMetal() : mat.steel(),
    };
  }, [person.id, style.accent]);

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
      root.current.rotation.y = current + delta * (reducedMotion ? 1 : 0.18);
    }
    livePositions.set(person.id, pose.position);
    if (body.current) body.current.position.y = rig.bob;
    if (head.current) head.current.rotation.x = rig.headPitch;
    if (armL.current) armL.current.rotation.set(rig.armL, 0, rig.armSpread);
    if (armR.current) armR.current.rotation.set(rig.armR, 0, -rig.armSpread);
    if (legL.current) legL.current.rotation.x = rig.legL;
    if (legR.current) legR.current.rotation.x = rig.legR;
    if (device.current) device.current.visible = rig.holdsDevice && style.device !== null && pose.action !== 'type';
    if (eyes.current) {
      // Blink every few seconds; happy squint while celebrating.
      const blink = !reducedMotion && (time + person.id.length) % 4.2 < 0.12;
      eyes.current.scale.y = pose.action === 'celebrate' ? 0.35 : blink ? 0.1 : 1;
    }
    if (antenna.current) {
      const k = reducedMotion ? 1 : 0.7 + Math.sin(time * 3 + person.id.length) * 0.5;
      antenna.current.color.set(style.accent).multiplyScalar(dimmed ? 0.3 : 1 + k);
    }
  });

  const limb = (len: number, r: number, m: THREE.Material, y: number) => (
    <mesh geometry={LIMB} material={m} position={[0, y, 0]} scale={[r, len, r]} castShadow />
  );
  const joint = (r: number, y: number) => <mesh geometry={JOINT} material={look.joint} position={[0, y, 0]} scale={r} castShadow />;

  return (
    <group ref={root} {...handlers} scale={dimmed ? 0.9 : 1}>
      {/* invisible, generous hit volume */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.6, 1.25, 0.5]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={body}>
        {/* legs (pivot at hip) */}
        {[
          { ref: legL, x: -0.09 },
          { ref: legR, x: 0.09 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 0.42, 0]}>
            {joint(0.055, 0)}
            {limb(0.3, 0.05, look.frame, -0.17)}
            <RoundedBox args={[0.15, 0.08, 0.22]} radius={0.03} smoothness={2} position={[0, -0.37, 0.03]} material={look.shell} castShadow />
          </group>
        ))}

        {/* pelvis + torso */}
        <RoundedBox args={[0.3, 0.09, 0.18]} radius={0.03} smoothness={2} position={[0, 0.46, 0]} material={look.frame} />
        <RoundedBox args={[0.38, 0.36, 0.25]} radius={0.07} smoothness={3} position={[0, 0.69, 0]} material={look.shell} castShadow />
        <RoundedBox args={[0.24, 0.16, 0.02]} radius={0.02} smoothness={2} position={[0, 0.71, 0.126]} material={look.visor} />
        <Box position={[0, 0.71, 0.138]} size={[0.16, 0.025, 0.005]} material={look.accentGlow} shadows={false} />
        <Box position={[-0.05, 0.665, 0.138]} size={[0.03, 0.03, 0.005]} material={look.accentSoft} shadows={false} />
        <Box position={[0.0, 0.665, 0.138]} size={[0.03, 0.03, 0.005]} material={look.trim} shadows={false} />
        <Box position={[0.05, 0.665, 0.138]} size={[0.03, 0.03, 0.005]} material={look.accentSoft} shadows={false} />

        {/* arms (pivot at shoulder) */}
        {[
          { ref: armL, x: -0.245, side: -1 },
          { ref: armR, x: 0.245, side: 1 },
        ].map(({ ref, x, side }) => (
          <group key={x} ref={ref} position={[x, 0.82, 0]}>
            {joint(0.065, 0)}
            {limb(0.26, 0.042, look.frame, -0.15)}
            <mesh geometry={JOINT} material={look.shell} position={[0, -0.32, 0]} scale={[0.06, 0.055, 0.06]} castShadow />
            {side === 1 && (
              <group ref={device} position={[-0.12, -0.36, 0.12]} rotation={[-0.4, 0, 0]} visible={false}>
                {style.device === 'tablet' && (
                  <>
                    <Box position={[0, 0, 0]} size={[0.26, 0.02, 0.19]} material={mat.rackMetal()} />
                    <Box position={[0, 0.012, 0]} size={[0.22, 0.005, 0.15]} material={mat.glow(PALETTE.forgeBright, 0.8)} shadows={false} />
                  </>
                )}
                {style.device === 'card' && <Box position={[0, 0, 0]} size={[0.18, 0.01, 0.13]} material={mat.glow(PALETTE.ok, 0.7)} shadows={false} />}
                {style.device === 'laptop' && <Box position={[0, 0, 0]} size={[0.28, 0.025, 0.2]} material={mat.steel()} />}
              </group>
            )}
          </group>
        ))}

        {/* neck + head */}
        {limb(0.06, 0.05, look.joint, 0.9)}
        <group ref={head} position={[0, 0.93, 0]}>
          <RoundedBox args={[0.34, 0.27, 0.28]} radius={0.08} smoothness={3} position={[0, 0.14, 0]} material={look.shell} castShadow />
          {/* visor + eyes */}
          <RoundedBox args={[0.27, 0.14, 0.03]} radius={0.03} smoothness={2} position={[0, 0.15, 0.135]} material={look.visor} />
          <group ref={eyes} position={[0, 0.155, 0.152]}>
            <Box position={[-0.06, 0, 0]} size={[0.045, 0.05, 0.005]} material={look.accentGlow} shadows={false} />
            <Box position={[0.06, 0, 0]} size={[0.045, 0.05, 0.005]} material={look.accentGlow} shadows={false} />
          </group>
          {/* ear modules */}
          <mesh geometry={LIMB} material={look.frame} position={[-0.18, 0.14, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.045, 0.03, 0.045]} />
          <mesh geometry={LIMB} material={look.frame} position={[0.18, 0.14, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.045, 0.03, 0.045]} />
          {/* antenna */}
          {limb(0.1, 0.008, look.joint, 0.33)}
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.028, 12, 10]} />
            <meshBasicMaterial ref={antenna} color={style.accent} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {(hovered || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.36, 0.44, 40]} />
          <meshBasicMaterial color={selected ? PALETTE.forge : PALETTE.snow} transparent opacity={selected ? 0.95 : 0.5} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
