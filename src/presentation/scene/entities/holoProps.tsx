import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box } from '../kit/Part';
import { mat } from '../kit/materials';
import { makeCanvasTexture } from '../kit/canvasTexture';
import { HoloPanel } from '../holo/HoloPanel';
import { HOLO, drawTitle, holoFonts } from '../holo/holoDraw';

/** Decorative holographic props. Shared geometry/materials, canvas textures made once. */

export const HOLO_CYAN = '#38E1FF';
export const HOLO_ALERT = '#FF4D4D';

const shared = new Map<string, unknown>();
function once<T>(key: string, make: () => T): T {
  let v = shared.get(key) as T | undefined;
  if (v === undefined) {
    v = make();
    shared.set(key, v);
  }
  return v;
}

const glass = (color: string, opacity: number, additive = false) =>
  once(`glass:${color}:${opacity}:${additive}`, () =>
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
const line = (color: string, opacity: number) =>
  once(`line:${color}:${opacity}`, () => new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false }));

const planeGeo = () => once('plane', () => new THREE.PlaneGeometry(1, 1));
const planeEdges = () => once('planeEdges', () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)));
const coneGeo = () => once('cone', () => new THREE.CylinderGeometry(0.5, 0.08, 1, 20, 1, true));
const ringGeo = (r: number) => once(`ring:${r}`, () => new THREE.TorusGeometry(r, 0.012, 6, 48));
const orbGeo = () => once('orb', () => new THREE.IcosahedronGeometry(0.34, 1));
const orbCoreGeo = () => once('orbCore', () => new THREE.SphereGeometry(0.2, 14, 10));

/** Static keyboard outline: a thin glowing key grid. */
const keyboardTex = () =>
  once('kbTex', () =>
    makeCanvasTexture(256, 96, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = HOLO_CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.globalAlpha = 0.75;
      const rows = 4;
      const cols = 14;
      const kw = (w - 16) / cols;
      const kh = (h - 16) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === rows - 1 && (c < 3 || c > 10)) continue;
          ctx.strokeRect(8 + c * kw + 1.5, 8 + r * kh + 1.5, kw - 3, kh - 3);
        }
      }
    }),
  );

/** Scrolling code lines (tileable vertically). */
function drawCode(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.clearRect(0, 0, w, h);
  let s = seed + 7;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 8; y < h - 4; y += 12) {
    let x = 12 + Math.floor(rand() * 3) * 14;
    const tokens = 2 + Math.floor(rand() * 4);
    for (let t = 0; t < tokens && x < w - 24; t++) {
      const len = 14 + rand() * 54;
      ctx.fillStyle = rand() > 0.8 ? '#FF8C32' : rand() > 0.5 ? '#38E1FF' : '#BFEFFF';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, len, 4);
      x += len + 7;
    }
  }
}

/** Floating holographic monitor + projector base + holographic keyboard. */
export function HoloMonitor({ seed, active, selected, reducedMotion }: { seed: number; active: boolean; selected: boolean; reducedMotion: boolean }) {
  const tex = useMemo(() => {
    const t = makeCanvasTexture(256, 256, (ctx, w, h) => drawCode(ctx, w, h, seed));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 0.5);
    return t;
  }, [seed]);
  useEffect(() => () => tex.dispose(), [tex]);
  const codeMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), [tex]);
  useEffect(() => () => codeMat.dispose(), [codeMat]);
  useEffect(() => {
    codeMat.opacity = selected ? 1 : active ? 0.98 : 0.8;
  }, [codeMat, active, selected]);

  useFrame((_, dt) => {
    if (reducedMotion) return;
    tex.offset.y = (tex.offset.y - dt * 0.03) % 1;
  });

  const edge = selected ? '#FFFFFF' : HOLO_CYAN;
  return (
    <group>
      {/* projector base + light cone */}
      <Box position={[0, 1.015, -0.14]} size={[0.28, 0.025, 0.1]} material={mat.rackMetal()} shadows={false} />
      <Box position={[0, 1.03, -0.14]} size={[0.2, 0.006, 0.05]} material={mat.glow(HOLO_CYAN, 1.2)} shadows={false} />
      <mesh geometry={coneGeo()} material={glass(HOLO_CYAN, active ? 0.14 : 0.07, true)} position={[0, 1.15, -0.17]} scale={[0.5, 0.25, 0.1]} />
      {/* screen */}
      <group position={[0, 1.43, -0.2]} rotation={[-0.08, 0, 0]}>
        <mesh geometry={planeGeo()} material={glass('#06303E', active ? 0.5 : 0.36)} scale={[0.92, 0.54, 1]} />
        <mesh geometry={planeGeo()} material={codeMat} position={[0, 0, 0.004]} scale={[0.84, 0.46, 1]} />
        <lineSegments geometry={planeEdges()} material={line(edge, active ? 1 : 0.8)} scale={[0.92, 0.54, 1]} position={[0, 0, 0.006]} />
        {(active || selected) && <lineSegments geometry={planeEdges()} material={line(edge, 0.35)} scale={[0.97, 0.59, 1]} position={[0, 0, 0.006]} />}
      </group>
      {/* holographic keyboard */}
      <mesh
        geometry={planeGeo()}
        position={[0, 1.03, 0.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.52, 0.19, 1]}
        material={once(`kbMat:${active}`, () => new THREE.MeshBasicMaterial({ map: keyboardTex(), transparent: true, opacity: active ? 1 : 0.7, depthWrite: false, toneMapped: false }))}
      />
    </group>
  );
}

/** Slowly rotating status orb; red on alert, cyan otherwise. */
export function StatusOrb({ alert, reducedMotion }: { alert: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const color = alert ? HOLO_ALERT : HOLO_CYAN;
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    if (reducedMotion) return;
    g.rotation.y += dt * 0.5;
    g.position.y = 1.55 + Math.sin(clock.elapsedTime * 1.2) * 0.05;
  });
  return (
    <group>
      <mesh position={[0, 1.0, 0]} geometry={ringGeo(0.3)} material={glass(color, 0.8)} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh position={[0, 1.2, 0]} geometry={coneGeo()} material={glass(color, 0.07, true)} scale={[0.6, 0.4, 0.6]} />
      <group ref={ref} position={[0, 1.55, 0]}>
        <mesh geometry={orbGeo()} material={once(`orbW:${color}`, () => new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false }))} />
        <mesh geometry={orbCoreGeo()} material={glass(color, alert ? 0.45 : 0.25, true)} />
        <mesh geometry={ringGeo(0.46)} material={glass(color, 0.6)} rotation={[Math.PI / 2.4, 0, 0]} />
      </group>
    </group>
  );
}

/** Projector disc with a floating ring of 3 small panels (coordination desk). */
export function ProjectorRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && !reducedMotion) ref.current.rotation.y += dt * 0.35;
  });
  const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  return (
    <group>
      <Box position={[0, 0.97, 0]} size={[0.5, 0.01, 0.5]} material={mat.glow(HOLO_CYAN, 0.6)} shadows={false} />
      <mesh position={[0, 0.98, 0]} geometry={ringGeo(0.34)} material={glass(HOLO_CYAN, 0.9)} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh position={[0, 1.4, 0]} geometry={coneGeo()} material={glass(HOLO_CYAN, 0.06, true)} scale={[0.9, 0.85, 0.9]} />
      <group ref={ref} position={[0, 1.5, 0]}>
        {angles.map((a, i) => (
          <group key={i} position={[Math.sin(a) * 0.62, Math.sin(i * 1.7) * 0.06, Math.cos(a) * 0.62]} rotation={[0, a, 0]}>
            <mesh geometry={planeGeo()} material={glass('#06303E', 0.4)} scale={[0.42, 0.28, 1]} />
            <lineSegments geometry={planeEdges()} material={line(HOLO_CYAN, 0.9)} scale={[0.42, 0.28, 1]} />
            <mesh geometry={planeGeo()} material={glass(HOLO_CYAN, 0.35)} position={[0, 0.02, 0.003]} scale={[0.3, 0.03, 1]} />
            <mesh geometry={planeGeo()} material={glass(HOLO_CYAN, 0.22)} position={[-0.03, -0.04, 0.003]} scale={[0.22, 0.03, 1]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Small info totem for the corridor: squad code + name. */
export function InfoTotem({ position, code, name, accent, reducedMotion }: { position: [number, number, number]; code: string; name: string; accent: string; reducedMotion: boolean }) {
  return (
    <group position={[position[0], 0, position[2]]}>
      <Box position={[0, 0.03, 0]} size={[0.5, 0.06, 0.5]} material={mat.rackMetal()} shadows={false} />
      <mesh position={[0, 0.07, 0]} geometry={ringGeo(0.2)} material={glass(HOLO_CYAN, 0.9)} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh position={[0, 0.7, 0]} geometry={coneGeo()} material={glass(HOLO_CYAN, 0.05, true)} scale={[0.55, 1.2, 0.55]} />
      <HoloPanel
        position={[0, position[1], 0]}
        width={1.5}
        reducedMotion={reducedMotion}
        phase={position[0]}
        drawKey={`${code}:${name}:${accent}`}
        draw={(ctx, w) => {
          drawTitle(ctx, w, 'SETOR');
          ctx.fillStyle = accent;
          ctx.font = holoFonts.display(170, 700);
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(code, 40, 250);
          ctx.fillStyle = HOLO.ink;
          ctx.font = holoFonts.display(52, 600);
          ctx.fillText(name.toUpperCase().slice(0, 18), 40, 330);
        }}
      />
    </group>
  );
}

