import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Contributor, ContributorRole } from '@domain/entities';
import { PALETTE } from '../../theme';
import type { FigureLayout } from '../../world/worldModel';
import { sample, type CompiledScript } from '../../animation/script';
import { rigPose } from '../../animation/rig';
import { quirkAt, quirkOffsets, NO_QUIRK } from '../../animation/quirks';
import { useInteractive } from '../../interaction/useInteractive';
import { livePositions } from '../../interaction/livePositions';
import { Box, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS, roundRect } from '../kit/canvasTexture';
import { robotDesign, ROLE_TAG, type HeadShape } from '../kit/robotDesign';

interface RoleStyle {
  /** Accent light: face band, shoulder stripes, tag dot. */
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

const HEAD_SCALE: Record<HeadShape, [number, number, number]> = {
  capsule: [0.15, 0.17, 0.155],
  slim: [0.13, 0.18, 0.145],
  broad: [0.168, 0.15, 0.16],
};

/** Name tags appear once the camera is close enough to read them. */
const TAG_ZOOM = 34;

// Shared geometries (one GPU buffer for every robot).
const SPHERE = new THREE.SphereGeometry(1, 24, 18);
const CAPSULE = new THREE.CapsuleGeometry(1, 1, 6, 16);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
const CHEST = new THREE.CylinderGeometry(0.19, 0.14, 0.3, 28);
const CARBON = new THREE.MeshStandardMaterial({ color: '#15171B', roughness: 0.35, metalness: 0.7 });
const FACE_GLASS = new THREE.MeshPhysicalMaterial({ color: '#050608', roughness: 0.08, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 });

interface Props {
  layout: FigureLayout;
  person: Contributor;
  script: CompiledScript;
  dimmed: boolean;
  reducedMotion: boolean;
}

function NameTag({ name, role, accent }: { name: string; role: string; accent: string }) {
  const tex = useCanvasTexture(
    512,
    132,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(13,15,20,0.88)';
      roundRect(ctx, 4, 8, w - 8, h - 16, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(44, h / 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#F5F5F5';
      ctx.font = FONTS.display(44, 700);
      ctx.fillText(name, 72, h / 2 - 15);
      ctx.fillStyle = '#9DA3AE';
      ctx.font = FONTS.mono(26, 600);
      ctx.fillText(role.toUpperCase(), 72, h / 2 + 24);
    },
    [name, role, accent],
  );
  return (
    <spriteMaterial map={tex} toneMapped={false} depthTest={false} transparent />
  );
}

/**
 * Futuristic unisex humanoid robot. Its pose comes from the animation system;
 * this component only maps joint angles onto meshes. Purely illustrative.
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
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const device = useRef<THREE.Group>(null);
  const face = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Sprite>(null);

  const style = ROLE_STYLE[person.role ?? 'unknown'];
  const design = useMemo(() => robotDesign(person.id), [person.id]);
  const shell = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: design.finish.shell,
        roughness: design.finish.roughness,
        metalness: 0.15,
        clearcoat: design.finish.clearcoat,
        clearcoatRoughness: 0.12,
      }),
    [design],
  );
  useEffect(() => () => shell.dispose(), [shell]);
  const glow = mat.glow(style.accent, 1.6);
  const glowSoft = mat.glow(style.accent, 0.7);
  const [hx, hy, hz] = HEAD_SCALE[design.head];
  const firstName = person.displayName.split(' ')[0];

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    const pose = reducedMotion
      ? { position: layout.home, heading: Math.PI, action: 'idle' as const, elapsed: 0 }
      : sample(script, time);
    const rig = rigPose(pose.action, pose.elapsed, reducedMotion ? 0 : time);
    const quirk = reducedMotion ? NO_QUIRK : quirkOffsets(quirkAt(person.id, time, pose.action));
    if (root.current) {
      root.current.position.set(pose.position[0], 0, pose.position[1]);
      const current = root.current.rotation.y;
      const delta = Math.atan2(Math.sin(pose.heading - current), Math.cos(pose.heading - current));
      root.current.rotation.y = current + delta * (reducedMotion ? 1 : 0.18);
    }
    livePositions.set(person.id, pose.position);
    if (body.current) {
      body.current.position.y = rig.bob + quirk.bob;
      body.current.rotation.set(quirk.bodyPitch, 0, quirk.bodyRoll);
    }
    if (head.current) head.current.rotation.set(rig.headPitch, quirk.headYaw, quirk.headRoll);
    if (armL.current) armL.current.rotation.set(rig.armL + quirk.armLift, 0, rig.armSpread);
    if (armR.current) armR.current.rotation.set(rig.armR + quirk.armLift, 0, -rig.armSpread);
    if (legL.current) legL.current.rotation.x = rig.legL;
    if (legR.current) legR.current.rotation.x = rig.legR;
    // Knees bend only when the leg swings back, like a real gait.
    if (kneeL.current) kneeL.current.rotation.x = Math.max(0, -rig.legL) * 0.9;
    if (kneeR.current) kneeR.current.rotation.x = Math.max(0, -rig.legR) * 0.9;
    if (device.current) device.current.visible = rig.holdsDevice && style.device !== null && pose.action !== 'type';
    if (face.current) {
      // Light band blinks every few seconds and narrows into a smile when celebrating.
      const blink = !reducedMotion && (time + person.id.length) % 4.6 < 0.12;
      face.current.scale.y = pose.action === 'celebrate' ? 0.45 : blink ? 0.12 : 1;
    }
    if (tag.current) tag.current.visible = selected || hovered || (camera as THREE.OrthographicCamera).zoom > TAG_ZOOM;
  });

  const capsule = (r: number, len: number, y: number, m: THREE.Material) => (
    <mesh geometry={CAPSULE} material={m} position={[0, y, 0]} scale={[r, len / 2, r]} castShadow />
  );
  const ball = (r: number, y: number, m: THREE.Material = CARBON) => (
    <mesh geometry={SPHERE} material={m} position={[0, y, 0]} scale={r} castShadow />
  );

  return (
    <group ref={root} {...handlers} scale={dimmed ? 0.9 : 1}>
      {/* invisible, generous hit volume */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.6, 1.45, 0.5]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={body}>
        {/* legs: hip → knee → foot */}
        {[
          { hip: legL, knee: kneeL, x: -0.085 },
          { hip: legR, knee: kneeR, x: 0.085 },
        ].map(({ hip, knee, x }) => (
          <group key={x} ref={hip} position={[x, 0.62, 0]}>
            {ball(0.05, 0)}
            {capsule(0.056, 0.16, -0.13, shell)}
            <group ref={knee} position={[0, -0.27, 0]}>
              {ball(0.045, 0)}
              {capsule(0.048, 0.17, -0.14, shell)}
              <mesh geometry={SPHERE} material={CARBON} position={[0, -0.31, 0.035]} scale={[0.055, 0.035, 0.1]} castShadow />
            </group>
          </group>
        ))}

        {/* pelvis + abdomen (carbon) + chest (shell) */}
        <mesh geometry={SPHERE} material={shell} position={[0, 0.65, 0]} scale={[0.15, 0.07, 0.1]} castShadow />
        <mesh geometry={CYL} material={CARBON} position={[0, 0.74, 0]} scale={[0.085, 0.13, 0.07]} castShadow />
        <Box position={[0, 0.72, 0.07]} size={[0.1, 0.008, 0.004]} material={glowSoft} shadows={false} />
        <Box position={[0, 0.76, 0.07]} size={[0.1, 0.008, 0.004]} material={glowSoft} shadows={false} />
        <mesh geometry={CHEST} material={shell} position={[0, 0.94, 0]} scale={[1, 1, 0.72]} castShadow />
        {/* chest plate with signature LEDs */}
        <mesh geometry={SPHERE} material={FACE_GLASS} position={[0, 0.97, 0.085]} scale={[0.11, 0.07, 0.04]} />
        {design.signature.map((on, i) => (
          <Box
            key={i}
            position={[-0.048 + i * 0.024, 0.955, 0.124]}
            size={[0.012, 0.012, 0.004]}
            material={on ? glow : mat.glow('#2A2E36', 1)}
            shadows={false}
          />
        ))}

        {/* arms: shoulder → elbow (slightly bent) → hand */}
        {[
          { ref: armL, x: -0.225, right: false },
          { ref: armR, x: 0.225, right: true },
        ].map(({ ref, x, right }) => (
          <group key={x} ref={ref} position={[x, 1.03, 0]}>
            {ball(0.07, 0, shell)}
            <Box position={[right ? 0.05 : -0.05, 0.02, 0]} size={[0.006, 0.05, 0.05]} material={glowSoft} shadows={false} />
            {capsule(0.045, 0.15, -0.12, shell)}
            <group position={[0, -0.24, 0]} rotation={[-0.25, 0, 0]}>
              {ball(0.04, 0)}
              {capsule(0.042, 0.14, -0.11, shell)}
              <mesh geometry={SPHERE} material={CARBON} position={[0, -0.23, 0]} scale={[0.04, 0.055, 0.03]} castShadow />
              {right && (
                <group ref={device} position={[-0.1, -0.25, 0.1]} rotation={[-0.4, 0, 0]} visible={false}>
                  {style.device === 'tablet' && (
                    <>
                      <Box position={[0, 0, 0]} size={[0.26, 0.016, 0.18]} material={CARBON} />
                      <Box position={[0, 0.01, 0]} size={[0.22, 0.004, 0.14]} material={mat.glow(PALETTE.forgeBright, 0.8)} shadows={false} />
                    </>
                  )}
                  {style.device === 'card' && <Box position={[0, 0, 0]} size={[0.18, 0.008, 0.12]} material={mat.glow(PALETTE.ok, 0.7)} shadows={false} />}
                  {style.device === 'laptop' && <Box position={[0, 0, 0]} size={[0.28, 0.02, 0.2]} material={mat.steel()} />}
                </group>
              )}
            </group>
          </group>
        ))}

        {/* neck + head */}
        <mesh geometry={CYL} material={CARBON} position={[0, 1.12, 0]} scale={[0.038, 0.07, 0.038]} />
        <group ref={head} position={[0, 1.14, 0]}>
          <mesh geometry={SPHERE} material={shell} position={[0, hy * 0.85, 0]} scale={[hx, hy, hz]} castShadow />
          {/* black glass face */}
          <mesh geometry={SPHERE} material={FACE_GLASS} position={[0, hy * 0.8, hz * 0.22]} scale={[hx * 0.86, hy * 0.62, hz * 0.85]} />
          <group ref={face} position={[0, hy * 0.82, hz * 1.06]}>
            {design.face === 'band' && <Box position={[0, 0, 0]} size={[hx * 1.15, 0.018, 0.006]} material={glow} shadows={false} />}
            {design.face === 'dual' &&
              [-1, 1].map((s) => <Box key={s} position={[s * hx * 0.36, 0, 0]} size={[0.034, 0.03, 0.006]} material={glow} shadows={false} />)}
            {design.face === 'split' &&
              [-1, 1].map((s) => <Box key={s} position={[s * hx * 0.33, 0, 0]} size={[hx * 0.5, 0.016, 0.006]} material={glow} shadows={false} />)}
          </group>
        </group>
      </group>

      <sprite ref={tag} position={[0, 1.62, 0]} scale={[0.95, 0.245, 1]} renderOrder={10} visible={false}>
        <NameTag name={firstName} role={ROLE_TAG[person.role ?? 'unknown']} accent={style.accent} />
      </sprite>

      {(hovered || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.36, 0.44, 40]} />
          <meshBasicMaterial color={selected ? PALETTE.forge : PALETTE.snow} transparent opacity={selected ? 0.95 : 0.5} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
