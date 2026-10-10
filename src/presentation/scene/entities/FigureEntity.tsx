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
const HEAD_Y = 1.0;

// Shared geometries: one GPU buffer for every robot.
const SPHERE = new THREE.SphereGeometry(1, 28, 20);
const CAPSULE = new THREE.CapsuleGeometry(1, 1, 6, 16);
const RING = new THREE.TorusGeometry(1, 0.16, 10, 32);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
/** Curved screen patch on the front of the helmet (UVs span the whole patch). */
const SCREEN = new THREE.SphereGeometry(1, 32, 16, Math.PI / 2 - 0.85, 1.7, Math.PI / 2 - 0.62, 1.18);
const JOINT_DARK = new THREE.MeshStandardMaterial({ color: '#15171C', roughness: 0.28, metalness: 0.95 });

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
    const q = reducedMotion ? null : quirkAt(person.id, time, pose.action);
    const quirk = q ? quirkOffsets(q) : NO_QUIRK;

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
    if (head.current) head.current.rotation.set(rig.headPitch * 0.7, quirk.headYaw, quirk.headRoll);
    if (armL.current) armL.current.rotation.set(rig.armL + quirk.armLift, 0, rig.armSpread + 0.08);
    if (armR.current) armR.current.rotation.set(rig.armR + quirk.armLift, 0, -rig.armSpread - 0.08);
    if (legL.current) legL.current.rotation.x = rig.legL * 0.8;
    if (legR.current) legR.current.rotation.x = rig.legR * 0.8;
    if (device.current) device.current.visible = rig.holdsDevice && style.device !== null && pose.action !== 'type';

    const next = reducedMotion ? 'neutral' : expressionFor(pose.action, q?.quirk ?? null, time, seed);
    if (next !== expression.current) {
      expression.current = next;
      screen.map = faceTexture(next);
    }
    if (tag.current) tag.current.visible = selected || hovered || (camera as THREE.OrthographicCamera).zoom > TAG_ZOOM;
  });

  const capsule = (r: number, len: number, y: number, m: THREE.Material) => (
    <mesh geometry={CAPSULE} material={m} position={[0, y, 0]} scale={[r, len / 2, r]} castShadow />
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
            <mesh geometry={SPHERE} material={JOINT_DARK} scale={0.07} />
            {capsule(0.07, 0.07, -0.08, shell)}
            {ring(0.07, -0.16, cyan)}
            {capsule(0.078, 0.06, -0.24, shell)}
            <RoundedBox args={[0.17, 0.11, 0.25]} radius={0.045} smoothness={3} position={[0, -0.355, 0.03]} material={shell} castShadow />
            <Box position={[0, -0.38, 0.157]} size={[0.11, 0.022, 0.01]} material={accent} shadows={false} />
            <Box position={[0, -0.405, 0.03]} size={[0.15, 0.012, 0.22]} material={JOINT_DARK} shadows={false} />
          </group>
        ))}

        {/* torso: compact armour with emblem and signature LEDs */}
        <RoundedBox args={[0.26, 0.09, 0.19]} radius={0.04} smoothness={3} position={[0, 0.47, 0]} material={JOINT_DARK} />
        <RoundedBox args={[0.36, 0.32, 0.26]} radius={0.1} smoothness={4} position={[0, 0.64, 0]} material={shell} castShadow />
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
            <mesh geometry={SPHERE} material={shell} scale={0.075} castShadow />
            {ring(0.07, 0, accent, [0, 0, Math.PI / 2])}
            {capsule(0.05, 0.06, -0.09, shell)}
            {ring(0.052, -0.16, cyan)}
            <group position={[0, -0.16, 0]} rotation={[-0.2, 0, 0]}>
              {capsule(0.06, 0.05, -0.08, shell)}
              <RoundedBox args={[0.1, 0.1, 0.085]} radius={0.035} smoothness={3} position={[0, -0.17, 0.01]} material={JOINT_DARK} castShadow />
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
          <mesh geometry={SPHERE} material={shell} scale={[R * 1.08, R * 0.95, R]} castShadow />
          <mesh geometry={SCREEN} material={screen} scale={[R * 1.085, R * 0.955, R * 1.012]} />
          {/* screen bezel ring */}
          <mesh geometry={RING} material={JOINT_DARK} position={[0, 0, R * 0.62]} scale={[R * 0.86, R * 0.7, R * 0.5]} />
          {design.crest && (
            <RoundedBox args={[0.08, 0.05, R * 1.5]} radius={0.02} smoothness={2} position={[0, R * 0.92, -0.02]} material={shell} />
          )}
          {/* ear modules */}
          {[-1, 1].map((side) => (
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

      <sprite ref={tag} position={[0, 1.52, 0]} scale={[0.95, 0.245, 1]} renderOrder={10} visible={false}>
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
