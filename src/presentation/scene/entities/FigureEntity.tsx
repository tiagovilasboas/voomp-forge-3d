import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Contributor, ContributorRole } from '@domain/entities';
import { PALETTE } from '../../theme';
import type { FigureLayout } from '../../world/worldModel';
import { sample, type CompiledScript } from '../../animation/script';
import { rigPose } from '../../animation/rig';
import { quirkAt, quirkOffsets, NO_QUIRK } from '../../animation/quirks';
import { expressionFor, type Expression } from '../../animation/expression';
import { useInteractive } from '../../interaction/useInteractive';
import { livePositions } from '../../interaction/livePositions';
import { Box, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS, roundRect } from '../kit/canvasTexture';
import { faceTexture } from '../kit/faceTextures';
import { ROBOT_STYLE, robotDesign, ROLE_TAG } from '../kit/robotDesign';

interface RoleStyle {
  /** Accent light: joint rings, boot strips, chest emblem, tag dot. */
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

/** Name tags appear once the camera is close enough to read them. */
const TAG_ZOOM = 34;
const R = ROBOT_STYLE.proportions.headRadius;
const HEAD_Y = 0.97;

// Shared geometries: one GPU buffer for every robot.
const RING = new THREE.TorusGeometry(1, 0.16, 10, 32);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
/** Curved screen patch on the front of the helmet (UVs span the whole patch). */
const SCREEN = new THREE.PlaneGeometry(1, 1);
const JOINT_DARK = new THREE.MeshStandardMaterial({ color: '#16181D', roughness: 0.55, metalness: 0.45 });

const HOLO_CYAN = '#38E1FF';
const HOLO_ORANGE = '#FF8C32';
const holo = (color: string, opacity: number, intensity = 1.3) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, toneMapped: false, depthWrite: false });
const SCOOTER_DECK = holo(HOLO_CYAN, 0.55);
const SCOOTER_ACCENT = holo(HOLO_ORANGE, 0.9, 1.6);
const SCOOTER_WHEEL = holo(HOLO_CYAN, 0.8, 1.8);
/** Light trail: a few stretched quads behind the scooter, fading out. */
const TRAIL = [0.42, 0.3, 0.2, 0.12, 0.06].map((o) => holo(HOLO_CYAN, o, 1.6));
const WHEEL_GEO = new THREE.TorusGeometry(0.075, 0.018, 8, 20);

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
      ctx.fillStyle = 'rgba(8,16,26,0.82)';
      roundRect(ctx, 4, 8, w - 8, h - 16, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,225,255,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(44, h / 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#F5F5F5';
      ctx.font = FONTS.display(46, 700);
      ctx.fillText(name, 72, h / 2 - 15);
      ctx.fillStyle = '#8FE9FF';
      ctx.font = FONTS.mono(26, 600);
      ctx.fillText(role.toUpperCase(), 72, h / 2 + 25);
    },
    [name, role, accent],
  );
  return <spriteMaterial map={tex} toneMapped={false} depthTest={false} transparent />;
}

/**
 * Chibi android: big helmet with an LED face screen, compact armoured body,
 * glowing joint rings. The pose comes from the animation system; this
 * component only maps joint angles and expressions onto meshes.
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
  const scooter = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Sprite>(null);
  const expression = useRef<Expression>('neutral');

  const style = ROLE_STYLE[person.role ?? 'unknown'];
  const design = useMemo(() => robotDesign(person.id), [person.id]);
  const shell = useMemo(
    () => new THREE.MeshStandardMaterial({ color: design.finish.shell, roughness: design.finish.roughness, metalness: design.finish.metalness }),
    [design],
  );
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ map: faceTexture('neutral'), toneMapped: false }), []);
  useEffect(() => () => {
    shell.dispose();
    screen.dispose();
  }, [shell, screen]);

  const accent = mat.glow(style.accent, dimmed ? 0.4 : 1.5);
  const cyan = mat.glow(ROBOT_STYLE.ringSecondary, dimmed ? 0.3 : 1.2);
  const seed = person.id.length * 1.37;
  const firstName = person.displayName.split(' ')[0];

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    const pose = reducedMotion
      ? { position: layout.home, heading: Math.PI, action: 'idle' as const, elapsed: 0 }
      : sample(script, time);
    const rig = rigPose(pose.action, pose.elapsed, reducedMotion ? 0 : time);
    const riding = pose.action === 'ride';
    const q = reducedMotion || riding ? null : quirkAt(person.id, time, pose.action);
    const quirk = q ? quirkOffsets(q) : NO_QUIRK;

    if (root.current) {
      root.current.position.set(pose.position[0], 0, pose.position[1]);
      const current = root.current.rotation.y;
      const delta = Math.atan2(Math.sin(pose.heading - current), Math.cos(pose.heading - current));
      root.current.rotation.y = current + delta * (reducedMotion ? 1 : 0.18);
    }
    livePositions.set(person.id, pose.position);
    if (body.current) {
      body.current.position.y = rig.bob + quirk.bob + (riding ? 0.08 : 0);
      body.current.rotation.set(quirk.bodyPitch + rig.lean, 0, quirk.bodyRoll);
    }
    if (head.current) head.current.rotation.set(rig.headPitch * 0.7, quirk.headYaw, quirk.headRoll);
    if (armL.current) armL.current.rotation.set(rig.armL + quirk.armLift, 0, rig.armSpread + 0.08);
    if (armR.current) armR.current.rotation.set(rig.armR + quirk.armLift, 0, -rig.armSpread - 0.08);
    if (legL.current) legL.current.rotation.x = rig.legL * 0.8;
    if (legR.current) legR.current.rotation.x = rig.legR * 0.8;
    if (scooter.current) scooter.current.visible = riding;
    if (device.current) device.current.visible = rig.holdsDevice && style.device !== null && pose.action !== 'type';

    const next = reducedMotion ? 'neutral' : expressionFor(pose.action, q?.quirk ?? null, time, seed);
    if (next !== expression.current) {
      expression.current = next;
      screen.map = faceTexture(next);
    }
    if (tag.current) tag.current.visible = selected || hovered || (camera as THREE.OrthographicCamera).zoom > TAG_ZOOM;
  });

  /** Chamfered block limb segment (faceted look, no capsules). */
  const capsule = (r: number, len: number, y: number, m: THREE.Material) => (
    <RoundedBox args={[r * 2, len + r * 1.6, r * 1.8]} radius={0.018} smoothness={2} position={[0, y, 0]} material={m} castShadow />
  );
  const ring = (r: number, y: number, m: THREE.Material, rot: [number, number, number] = [Math.PI / 2, 0, 0]) => (
    <mesh geometry={RING} material={m} position={[0, y, 0]} rotation={rot} scale={r} />
  );

  return (
    <group ref={root} {...handlers} scale={dimmed ? 0.9 : 1}>
      {/* invisible, generous hit volume */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.7, 1.35, 0.6]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* floor ring, like a holographic stand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.34, 0.37, 48]} />
        <meshBasicMaterial color={ROBOT_STYLE.ringSecondary} transparent opacity={dimmed ? 0.12 : 0.45} toneMapped={false} />
      </mesh>

      <group ref={body}>
        {/* legs: short and sturdy, chunky boots with a light strip */}
        {[
          { ref: legL, x: -0.1 },
          { ref: legR, x: 0.1 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 0.42, 0]}>
            <Box position={[0, 0, 0]} size={[0.12, 0.08, 0.12]} material={JOINT_DARK} />
            {capsule(0.07, 0.07, -0.08, shell)}
            {ring(0.07, -0.16, cyan)}
            {capsule(0.078, 0.06, -0.24, shell)}
            <RoundedBox args={[0.17, 0.11, 0.25]} radius={0.02} smoothness={2} position={[0, -0.355, 0.03]} material={shell} castShadow />
            <Box position={[0, -0.38, 0.157]} size={[0.11, 0.022, 0.01]} material={accent} shadows={false} />
            <Box position={[0, -0.405, 0.03]} size={[0.15, 0.012, 0.22]} material={JOINT_DARK} shadows={false} />
          </group>
        ))}

        {/* torso: compact armour with emblem and signature LEDs */}
        <RoundedBox args={[0.26, 0.09, 0.19]} radius={0.02} smoothness={2} position={[0, 0.47, 0]} material={JOINT_DARK} />
        <RoundedBox args={[0.36, 0.32, 0.26]} radius={0.035} smoothness={2} position={[0, 0.64, 0]} material={shell} castShadow />
        {/* asymmetric side panel stripe (left side only) */}
        <Box position={[-0.181, 0.66, 0.02]} size={[0.006, 0.2, 0.12]} material={accent} shadows={false} />
        <Box position={[0.12, 0.76, 0.1]} size={[0.08, 0.025, 0.06]} material={JOINT_DARK} />
        <RoundedBox args={[0.14, 0.12, 0.03]} radius={0.03} smoothness={2} position={[0, 0.68, 0.125]} material={JOINT_DARK} />
        {/* forge emblem: an anvil-ish chevron of light */}
        <Box position={[0, 0.7, 0.142]} size={[0.08, 0.016, 0.004]} material={accent} shadows={false} />
        <Box position={[0, 0.674, 0.142]} size={[0.045, 0.016, 0.004]} material={accent} shadows={false} />
        {design.signature.map((on, i) => (
          <Box
            key={i}
            position={[-0.044 + i * 0.022, 0.585, 0.13]}
            size={[0.011, 0.011, 0.004]}
            material={on ? cyan : mat.glow('#1E2430', 1)}
            shadows={false}
          />
        ))}

        {/* arms: shoulder ring → upper arm → elbow ring → forearm → mitten hand */}
        {[
          { ref: armL, x: -0.235, right: false },
          { ref: armR, x: 0.235, right: true },
        ].map(({ ref, x, right }) => (
          <group key={x} ref={ref} position={[x, 0.73, 0]}>
            <RoundedBox args={[0.13, 0.12, 0.13]} radius={0.025} smoothness={2} material={shell} castShadow />
            {!right && (
              <>
                <RoundedBox args={[0.16, 0.05, 0.17]} radius={0.015} smoothness={2} position={[-0.015, 0.075, 0]} rotation={[0, 0, 0.25]} material={JOINT_DARK} castShadow />
                <Box position={[-0.02, 0.1, 0.087]} size={[0.11, 0.012, 0.004]} material={accent} shadows={false} />
              </>
            )}
            {capsule(0.05, 0.06, -0.09, shell)}
            {ring(0.052, -0.16, cyan)}
            <group position={[0, -0.16, 0]} rotation={[-0.2, 0, 0]}>
              {capsule(0.06, 0.05, -0.08, shell)}
              <RoundedBox args={[0.1, 0.1, 0.085]} radius={0.018} smoothness={2} position={[0, -0.17, 0.01]} material={JOINT_DARK} castShadow />
              {right && (
                <group ref={device} position={[-0.11, -0.2, 0.11]} rotation={[-0.45, 0, 0]} visible={false}>
                  {style.device === 'tablet' && (
                    <>
                      <Box position={[0, 0, 0]} size={[0.27, 0.01, 0.19]} material={mat.glow(ROBOT_STYLE.ringSecondary, 0.35)} shadows={false} />
                      <Box position={[0, 0.008, 0]} size={[0.23, 0.004, 0.15]} material={mat.glow(ROBOT_STYLE.eyeColor, 1.1)} shadows={false} />
                    </>
                  )}
                  {style.device === 'card' && <Box position={[0, 0, 0]} size={[0.19, 0.006, 0.13]} material={mat.glow(ROBOT_STYLE.eyeColor, 0.9)} shadows={false} />}
                  {style.device === 'laptop' && <Box position={[0, 0, 0]} size={[0.28, 0.02, 0.2]} material={mat.steel()} />}
                </group>
              )}
            </group>
          </group>
        ))}

        {/* neck + helmet */}
        <mesh geometry={CYL} material={JOINT_DARK} position={[0, 0.8, 0]} scale={[0.07, 0.06, 0.07]} />
        <group ref={head} position={[0, HEAD_Y, 0]}>
          <RoundedBox args={[R * 1.95, R * 1.75, R * 1.75]} radius={0.085} smoothness={4} material={shell} castShadow />
          {/* forehead plate, slightly off-centre for character */}
          <RoundedBox args={[R * 0.9, R * 0.22, 0.03]} radius={0.01} smoothness={2} position={[R * 0.25, R * 0.72, R * 0.875]} material={JOINT_DARK} />
          {/* bezel + flat LED screen */}
          <RoundedBox args={[R * 1.78, R * 1.22, 0.03]} radius={0.04} smoothness={2} position={[0, -0.02, R * 0.875]} material={JOINT_DARK} />
          <mesh geometry={SCREEN} material={screen} position={[0, -0.02, R * 0.875 + 0.017]} scale={[R * 1.62, R * 1.08, 1]} />
          {/* side antenna (right only) */}
          <group position={[R * 0.78, R * 0.85, -R * 0.3]} rotation={[0, 0, -0.35]}>
            <Box position={[0, 0.07, 0]} size={[0.018, 0.14, 0.018]} material={JOINT_DARK} />
            <Box position={[0, 0.15, 0]} size={[0.035, 0.035, 0.035]} material={accent} shadows={false} />
          </group>
          {design.crest && (
            <RoundedBox args={[0.08, 0.04, R * 1.4]} radius={0.012} smoothness={2} position={[-R * 0.35, R * 0.86, -0.02]} material={JOINT_DARK} />
          )}
          {/* ear modules */}
          <Box position={[R * 1.04, -0.02, 0]} size={[0.025, R * 0.8, R * 0.9]} material={JOINT_DARK} />
          {[-1].map((side) => (
            <group key={side} position={[side * R * 1.06, -0.01, 0]} rotation={[0, 0, (side * Math.PI) / 2]}>
              {design.ear === 'ring' && (
                <>
                  <mesh geometry={CYL} material={JOINT_DARK} scale={[0.085, 0.05, 0.085]} />
                  <mesh geometry={RING} material={side > 0 ? accent : cyan} position={[0, side > 0 ? -0.03 : 0.03, 0]} scale={0.072} />
                </>
              )}
              {design.ear === 'fin' && (
                <>
                  <mesh geometry={CYL} material={JOINT_DARK} scale={[0.06, 0.05, 0.06]} />
                  <Box position={[0, side > 0 ? -0.04 : 0.04, -0.03]} size={[0.02, 0.05, 0.16]} material={accent} shadows={false} />
                </>
              )}
              {design.ear === 'pod' && (
                <>
                  <mesh geometry={CYL} material={shell} scale={[0.075, 0.07, 0.075]} />
                  <mesh geometry={CYL} material={cyan} position={[0, side > 0 ? -0.037 : 0.037, 0]} scale={[0.05, 0.008, 0.05]} />
                </>
              )}
            </group>
          ))}
        </group>
      </group>

      {/* holographic scooter: only shown while riding (toggled in useFrame) */}
      <group ref={scooter} visible={false}>
        <Box position={[0, 0.055, 0]} size={[0.26, 0.03, 0.82]} material={SCOOTER_DECK} shadows={false} />
        <Box position={[0, 0.072, 0]} size={[0.22, 0.004, 0.76]} material={SCOOTER_ACCENT} shadows={false} />
        <Box position={[0, 0.4, 0.4]} size={[0.035, 0.7, 0.035]} material={SCOOTER_DECK} shadows={false} />
        <Box position={[0, 0.74, 0.4]} size={[0.44, 0.035, 0.035]} material={SCOOTER_ACCENT} shadows={false} />
        {[0.38, -0.38].map((z) => (
          <mesh key={z} geometry={WHEEL_GEO} material={SCOOTER_WHEEL} position={[0, 0.075, z]} rotation={[0, Math.PI / 2, 0]} />
        ))}
        {TRAIL.map((m, i) => (
          <mesh key={i} material={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -0.62 - i * 0.3]}>
            <planeGeometry args={[0.2 - i * 0.025, 0.32]} />
          </mesh>
        ))}
      </group>

      <sprite ref={tag} position={[0, 1.38, 0]} scale={[0.95, 0.245, 1]} renderOrder={10} visible={false}>
        <NameTag name={firstName} role={ROLE_TAG[person.role ?? 'unknown']} accent={style.accent} />
      </sprite>

      {(hovered || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.4, 0.47, 48]} />
          <meshBasicMaterial color={selected ? PALETTE.forge : PALETTE.snow} transparent opacity={selected ? 0.95 : 0.5} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
