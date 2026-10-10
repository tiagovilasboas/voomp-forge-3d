import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { WorldModel } from '../../world/worldModel';
import { yawFor } from '../../world/frame';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS, makeCanvasTexture } from '../kit/canvasTexture';
import { N8nDesk } from './N8nDesk';
import { NpcBot } from './NpcBot';

const PLATFORM_H = 0.14;
const CYAN = '#38E1FF';
const ORANGE = '#FF8C32';
const WALL_H = 3.6;

/** Shared module-level resources (geometries, materials, textures built once). */
const shared = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  let v = shared.get(key) as T | undefined;
  if (v === undefined) {
    v = make();
    shared.set(key, v);
  }
  return v;
}
const holoMat = (color: string, opacity: number, additive = true) =>
  once(
    `holo:${color}:${opacity}:${additive}`,
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
  );
const lineMat = (color: string, opacity: number) =>
  once(`line:${color}:${opacity}`, () => new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false }));
const planeGeo = () => once('plane', () => new THREE.PlaneGeometry(1, 1));
const planeEdges = () => once('planeEdges', () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)));
const torusGeo = (r: number, t = 0.02) => once(`torus:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 6, 56));
const sphereGeo = () => once('sphere', () => new THREE.SphereGeometry(1, 16, 12));
const noRaycast = () => null;

/** Subtle hexagonal grid for the hub floor. */
const hexTexture = () =>
  once('hexTex', () => {
    const tex = makeCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const r = 32;
      const hh = Math.sqrt(3) * r;
      ctx.lineWidth = 1;
      for (let row = -1; row * hh < h + hh; row++) {
        for (let col = -1; col * r * 1.5 < w + r * 2; col++) {
          const x = col * r * 1.5;
          const y = row * hh + (col % 2 ? hh / 2 : 0);
          ctx.strokeStyle = 'rgba(56,225,255,0.12)';
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (k) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });

/** Particle cloud positions, generated once. */
const PARTICLE_COUNT = 70;
const particleGeo = () =>
  once('particles', () => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(PARTICLE_COUNT * 3);
    let s = 17;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      p[i * 3] = (rand() - 0.5) * 14;
      p[i * 3 + 1] = 0.6 + rand() * 2.8;
      p[i * 3 + 2] = (rand() - 0.5) * 11;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  });
const particleMat = () =>
  once('particleMat', () => new THREE.PointsMaterial({ color: CYAN, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, sizeAttenuation: true }));

/** Glass wall with thin glowing frame. Axis-aligned along x (rotY=0) or z. */
function GlassWall({ position, length, rotY = 0 }: { position: [number, number, number]; length: number; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={planeGeo()} material={holoMat('#3FB6D8', 0.07, false)} position={[0, WALL_H / 2, 0]} scale={[length, WALL_H, 1]} raycast={noRaycast} />
      <Box position={[0, 0.05, 0]} size={[length, 0.1, 0.12]} material={mat.rackMetal()} />
      <Box position={[0, WALL_H, 0]} size={[length, 0.05, 0.08]} material={mat.glow(CYAN, 1.4)} shadows={false} />
      <Box position={[0, 0.12, 0]} size={[length, 0.03, 0.1]} material={mat.glow(ORANGE, 1.1)} shadows={false} />
      {Array.from({ length: Math.floor(length / 4) + 1 }, (_, i) => (
        <Box key={i} position={[-length / 2 + i * (length / Math.floor(length / 4)), WALL_H / 2, 0]} size={[0.07, WALL_H, 0.07]} material={mat.glow(CYAN, 0.9)} shadows={false} />
      ))}
    </group>
  );
}

/** Slow drifting particles over the hub. The floor rings were removed. */
function Floaters({ reducedMotion }: { reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    if (points.current) points.current.rotation.y = clock.elapsedTime * 0.03;
  });
  return <points ref={points} geometry={particleGeo()} material={particleMat()} raycast={noRaycast} />;
}

/** Terminal kiosk: pedestal, tilted holographic screen with scrolling prompt, holographic keyboard. */
function TerminalKiosk({ position, yaw, reducedMotion }: { position: [number, number, number]; yaw: number; reducedMotion: boolean }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'terminal' });
  const glow = selected ? 1 : hovered ? 0.75 : 0.35;
  const scroll = useMemo(() => {
    const t = makeCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const lines = [
        'forge@hub:~$ status',
        '> repos .......... ok',
        '> pipelines ...... ok',
        '> knowledge ...... synced',
        'forge@hub:~$ ask "o que mudou?"',
        '> indexando mudanças...',
        '> 12 CRs, 4 deploys',
        'forge@hub:~$ docs --recent',
        '> spec.md  adr-014.md',
        '> runbook.md',
        'forge@hub:~$ health --all',
        '> ci ............. green',
        '> staging ........ ok',
        '> prod ........... ok',
        'forge@hub:~$ _',
        '',
      ];
      ctx.font = FONTS.mono(26, 600);
      lines.forEach((l, i) => {
        ctx.fillStyle = l.startsWith('forge') ? ORANGE : '#BFEFFF';
        ctx.fillText(l, 18, 30 + i * 32);
      });
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 0.5);
    return t;
  }, []);
  useEffect(() => () => scroll.dispose(), [scroll]);
  const header = useCanvasTexture(
    512,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = 'rgba(56,225,255,0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = CYAN;
      ctx.font = FONTS.mono(30, 700);
      ctx.fillText('● ● ●   HUB IA // TERMINAL', 16, 42);
    },
    [],
  );
  const cursor = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!reducedMotion) scroll.offset.y = 0.5 - ((t * 0.035) % 0.5);
    else scroll.offset.y = 0.5;
    if (cursor.current) cursor.current.visible = reducedMotion || Math.floor(t * 2) % 2 === 0;
  });

  return (
    <group position={position} rotation={[0, yaw, 0]} {...handlers}>
      {/* base + pedestal */}
      <mesh position={[0, 0.06, 0]} material={mat.rackMetal()} scale={[1.9, 0.12, 1.5]} geometry={once('boxg', () => new THREE.BoxGeometry(1, 1, 1))} receiveShadow />
      <Box position={[0, 0.58, -0.25]} size={[0.32, 0.9, 0.26]} material={mat.steel()} />
      <Box position={[0, 0.15, 0]} size={[1.75, 0.03, 1.35]} material={mat.glow(selected || hovered ? '#FFFFFF' : CYAN, glow * 1.3 + 0.3)} shadows={false} />
      <Box position={[0, 0.2, 0.3]} size={[0.9, 0.18, 0.5]} material={mat.rackMetal()} />
      {/* tilted screen */}
      <group position={[0, 1.7, -0.3]} rotation={[-0.28, 0, 0]}>
        <mesh geometry={planeGeo()} material={holoMat('#06202E', 0.78, false)} scale={[1.7, 1.1, 1]} />
        <mesh geometry={planeGeo()} position={[0, 0.5, 0.005]} scale={[1.62, 0.12, 1]} material={holoMat(CYAN, 0.9, false)}>
          <meshBasicMaterial map={header} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh geometry={planeGeo()} position={[0, -0.06, 0.006]} scale={[1.6, 0.9, 1]}>
          <meshBasicMaterial map={scroll} transparent opacity={0.95} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={cursor} geometry={planeGeo()} material={holoMat(ORANGE, 1, false)} position={[-0.7, -0.44, 0.008]} scale={[0.05, 0.08, 1]} />
        <lineSegments geometry={planeEdges()} material={lineMat(selected ? '#FFFFFF' : CYAN, 0.6 + glow * 0.4)} scale={[1.7, 1.1, 1]} />
        <Box position={[0, 0, -0.03]} size={[1.76, 1.16, 0.04]} material={mat.rackMetal()} shadows={false} />
      </group>
      {/* holographic keyboard */}
      <group position={[0, 0.74, 0.35]} rotation={[-0.15, 0, 0]}>
        <mesh geometry={planeGeo()} material={holoMat(CYAN, 0.12 + glow * 0.15)} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 0.42, 1]} />
        <lineSegments geometry={planeEdges()} material={lineMat(CYAN, 0.9)} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 0.42, 1]} />
        {[-0.12, 0, 0.12].map((z) => (
          <lineSegments key={z} geometry={planeEdges()} material={lineMat(CYAN, 0.5)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, z]} scale={[1.14, 0.1, 1]} />
        ))}
      </group>
      <mesh geometry={torusGeo(0.7, 0.012)} material={holoMat(CYAN, 0.5 + glow * 0.4)} position={[0, 0.17, 0.05]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

/** Classic pinball silhouette with hologram playfield and backbox. */
function PinballCabinet({ position, yaw, reducedMotion }: { position: [number, number, number]; yaw: number; reducedMotion: boolean }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'pinball' });
  const glow = selected ? 1 : hovered ? 0.7 : 0.3;
  const ball = useRef<THREE.Mesh>(null);
  const flipL = useRef<THREE.Mesh>(null);
  const flipR = useRef<THREE.Mesh>(null);
  // bumpers ref removed
  const FW = 1.3;
  const FL = 2.3;

  const backbox = useCanvasTexture(
    512,
    320,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(56,225,255,0.12)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = CYAN;
      ctx.textAlign = 'center';
      ctx.font = FONTS.display(74, 700);
      ctx.fillText('FORGE', w / 2, 130);
      ctx.fillStyle = ORANGE;
      ctx.fillText('PINBALL', w / 2, 215);
      ctx.fillStyle = '#BFEFFF';
      ctx.font = FONTS.mono(26, 600);
      ctx.fillText('HI-SCORE 000 042 000', w / 2, 275);
    },
    [],
  );
  const field = useCanvasTexture(
    256,
    448,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(56,225,255,0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      // lanes
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? ORANGE : CYAN;
        ctx.beginPath();
        ctx.arc(46 + i * 55, 40, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56,225,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(46 + i * 55, 56);
        ctx.lineTo(46 + i * 55, 130);
        ctx.stroke();
      }
      // inlane guides
      ctx.strokeStyle = 'rgba(56,225,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(10, 300);
      ctx.lineTo(80, 400);
      ctx.moveTo(w - 10, 300);
      ctx.lineTo(w - 80, 400);
      ctx.stroke();
      // arrows
      ctx.fillStyle = 'rgba(255,140,50,0.8)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(128, 245 + i * 14);
        ctx.lineTo(116, 262 + i * 14);
        ctx.lineTo(140, 262 + i * 14);
        ctx.fill();
      }
    },
    [],
  );

  useFrame(({ clock }) => {
    const t = reducedMotion ? 1.3 : clock.elapsedTime;
    const b = ball.current;
    if (b) {
      // scripted figure-8 through the bumpers, local playfield coords (x across, y along)
      b.position.x = Math.sin(t * 1.3) * 0.38;
      b.position.y = 0.1 + (Math.sin(t * 0.65) * 0.5 + 0.5) * 0.9 - 0.15 + Math.cos(t * 1.9) * 0.1;
    }
    const flip = reducedMotion ? 0 : Math.max(0, Math.sin(t * 2.2)) ** 6;
    if (flipL.current) flipL.current.rotation.z = 0.5 - flip * 0.6;
    if (flipR.current) flipR.current.rotation.z = -0.5 + flip * 0.6;
    // bumpers animation removed
  });

  const tilt = -0.32;
  return (
    <group position={position} rotation={[0, yaw, 0]} {...handlers}>
      {/* legs + body */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} position={[sx * (FW / 2 + 0.02), 0.45, sz * (FL / 2 - 0.1)]} size={[0.1, 0.9, 0.1]} material={mat.steel()} />))}
      <Box position={[-(FW / 2 + 0.05), 1.0, 0]} size={[0.1, 0.3, FL]} material={mat.rackMetal()} />
      <Box position={[FW / 2 + 0.05, 1.0, 0]} size={[0.1, 0.3, FL]} material={mat.rackMetal()} />
      <Box position={[0, 0.9, FL / 2 - 0.05]} size={[FW, 0.3, 0.1]} material={mat.rackMetal()} />
      <Box position={[0, 0.86, -FL / 2 + 0.05]} size={[FW, 0.5, 0.1]} material={mat.rackMetal()} />
      <Box position={[0, 0.98, FL / 2 + 0.005]} size={[FW + 0.22, 0.05, 0.02]} material={mat.glow(selected || hovered ? '#FFFFFF' : ORANGE, 1.3)} shadows={false} />
      <Box position={[-(FW / 2 + 0.11), 1.12, 0]} size={[0.03, 0.04, FL]} material={mat.glow(CYAN, 1.4)} shadows={false} />
      <Box position={[FW / 2 + 0.11, 1.12, 0]} size={[0.03, 0.04, FL]} material={mat.glow(CYAN, 1.4)} shadows={false} />
      {/* angled playfield (tilted up toward the backbox at -z) */}
      <group position={[0, 1.15, 0]} rotation={[-Math.PI / 2 - tilt, 0, 0]}>
        <mesh geometry={planeGeo()} material={holoMat('#38E1FF', 0.12 + glow * 0.12)} scale={[FW, FL, 1]} />
        <mesh geometry={planeGeo()} scale={[FW, FL, 1]} position={[0, 0, 0.004]}>
          <meshBasicMaterial map={field} transparent opacity={0.9} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <lineSegments geometry={planeEdges()} material={lineMat(CYAN, 1)} scale={[FW, FL, 1]} />
        {/* playfield local: +y is toward the backbox */}
        {/* bumpers removed */}
        <mesh ref={flipL} geometry={once('boxg', () => new THREE.BoxGeometry(1, 1, 1))} material={mat.glow(ORANGE, 1.4)} position={[-0.2, -0.82, 0.02]} rotation={[0, 0, 0.5]} scale={[0.34, 0.06, 0.04]} />
        <mesh ref={flipR} geometry={once('boxg', () => new THREE.BoxGeometry(1, 1, 1))} material={mat.glow(ORANGE, 1.4)} position={[0.2, -0.82, 0.02]} rotation={[0, 0, -0.5]} scale={[0.34, 0.06, 0.04]} />
        <mesh ref={ball} geometry={sphereGeo()} material={mat.glow('#FFFFFF', 2)} position={[0, 0, 0.05]} scale={0.04} />
        <pointLight position={[0, 0, 0.3]} intensity={0.8} distance={3} color={CYAN} />
      </group>
      {/* backbox hologram */}
      <group position={[0, 1.95, -FL / 2 + 0.05]}>
        <Box position={[0, 0, -0.06]} size={[FW + 0.2, 1.1, 0.06]} material={mat.rackMetal()} />
        <mesh geometry={planeGeo()} material={holoMat('#0A3A52', 0.5, false)} scale={[FW + 0.1, 1, 1]} />
        <mesh geometry={planeGeo()} scale={[FW + 0.1, (FW + 0.1) * 0.625, 1]} position={[0, 0, 0.004]}>
          <meshBasicMaterial map={backbox} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <lineSegments geometry={planeEdges()} material={lineMat(CYAN, 1)} scale={[FW + 0.1, 1, 1]} />
      </group>
    </group>
  );
}

/** HUB IA: knowledge vault, terminal and holographic pinball inside a glass-walled room. */
export function AiHubRoom({ world, reducedMotion }: { world: WorldModel; reducedMotion: boolean }) {
  const { center, size, terminal, pinball, automation, facing } = world.aiHub;
  const yaw = yawFor(facing);
  const [cx, cz] = center;
  const [w, d] = size;
  const { hovered, selected, handlers } = useInteractive({ kind: 'hub' });
  const trim = selected ? '#FFFFFF' : hovered ? '#CFF6FF' : CYAN;

  const sign = useCanvasTexture(
    1024,
    256,
    (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = CYAN;
      ctx.font = FONTS.display(170, 700);
      ctx.fillText('HUB IA', 20, ch / 2 - 20);
      ctx.fillStyle = ORANGE;
      ctx.fillRect(24, ch - 52, 220, 8);
      ctx.fillStyle = '#C8D2DC';
      ctx.font = FONTS.mono(36, 500);
      ctx.fillText('Conhecimento · Terminal · Fliperama', 24, ch - 24);
    },
    [],
  );
  const hex = useMemo(() => {
    const t = hexTexture().clone();
    t.repeat.set(w / 5, d / 5);
    t.needsUpdate = true;
    return t;
  }, [w, d]);
  useEffect(() => () => hex.dispose(), [hex]);

  return (
    <group>
      <group position={[cx, 0, cz]} rotation={[0, yaw, 0]} {...handlers}>
        <mesh position={[0, PLATFORM_H / 2, 0]} scale={[w, PLATFORM_H, d]} receiveShadow material={mat.platform()}>
          <boxGeometry />
          {(hovered || selected) && <Edges color={trim} lineWidth={selected ? 2 : 1} />}
        </mesh>
        {/* cyan trims on three sides, orange accent along the front */}
        <Box position={[0, PLATFORM_H + 0.005, d / 2 - 0.04]} size={[w, 0.012, 0.06]} material={mat.glow(trim, 1.1)} shadows={false} />
        <Box position={[0, PLATFORM_H + 0.005, d / 2 - 0.16]} size={[w, 0.012, 0.03]} material={mat.glow(ORANGE, 0.9)} shadows={false} />
        <Box position={[-w / 2 + 0.04, PLATFORM_H + 0.005, 0]} size={[0.06, 0.012, d]} material={mat.glow(trim, 0.8)} shadows={false} />
        <Box position={[w / 2 - 0.04, PLATFORM_H + 0.005, 0]} size={[0.06, 0.012, d]} material={mat.glow(trim, 0.8)} shadows={false} />
        <Box position={[0, PLATFORM_H + 0.005, -d / 2 + 0.04]} size={[w, 0.012, 0.06]} material={mat.glow(trim, 0.8)} shadows={false} />
        {/* hex holographic floor */}
        <mesh position={[0, PLATFORM_H + 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[w - 0.6, d - 0.6, 1]} geometry={planeGeo()} raycast={noRaycast}>
          <meshBasicMaterial map={hex} transparent opacity={0.22} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* painted sign */}
        <group position={[0, PLATFORM_H + 0.01, d / 2 - 1.5]} rotation={[0, yaw, 0]}>
          <Decal texture={sign} position={[0, 0, 0]} size={[8.4, 2.1]} rotation={[-Math.PI / 2, 0, 0]} opacity={0.95} />
        </group>
      </group>

      <group position={[cx, PLATFORM_H, cz]} rotation={[0, yaw, 0]}>
        <GlassWall position={[0, 0, -d / 2 + 0.1]} length={w} />
        <GlassWall position={[-w / 2 + 0.1, 0, 0]} length={d} rotY={Math.PI / 2} />
        <GlassWall position={[w / 2 - 0.1, 0, 0]} length={d} rotY={Math.PI / 2} />
        <Floaters reducedMotion={reducedMotion} />
        <pointLight position={[0, 4.5, 0]} intensity={14} distance={16} decay={1.6} color={CYAN} />
      </group>

      <group position={[0, PLATFORM_H, 0]}>
        <TerminalKiosk position={[terminal[0], 0, terminal[1]]} yaw={yaw} reducedMotion={reducedMotion} />
        <PinballCabinet position={[pinball[0], 0, pinball[1]]} yaw={yaw} reducedMotion={reducedMotion} />
        <N8nDesk position={[automation[0], 0, automation[1]]} yaw={yaw} reducedMotion={reducedMotion} />
        <NpcBot world={world} reducedMotion={reducedMotion} />
      </group>
    </group>
  );
}
