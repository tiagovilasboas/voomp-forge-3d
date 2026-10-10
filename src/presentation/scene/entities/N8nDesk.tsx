import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AUTOMATION_YAW } from '../../animation/npc';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS, roundRect } from '../kit/canvasTexture';

const CYAN = '#38E1FF';
const ORANGE = '#FF8C32';
const CW = 1280;
const CH = 640;
/** Holographic panel size in world units. */
const PW = 2.8;
const PH = PW * (CH / CW);
const NODE_W = 210;
const NODE_H = 112;

type Glyph = 'clock' | 'branch' | 'ticket' | 'grid' | 'gear' | 'upload';
interface FlowNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  glyph: Glyph;
  color: string;
}

const NODES: FlowNode[] = [
  { id: 'cron', label: 'Cron', sub: '06:00', x: 130, y: 320, glyph: 'clock', color: ORANGE },
  { id: 'git', label: 'Git', sub: 'histórico', x: 450, y: 125, glyph: 'branch', color: CYAN },
  { id: 'jira', label: 'Jira', sub: 'tickets', x: 450, y: 320, glyph: 'ticket', color: CYAN },
  { id: 'sheet', label: 'Planilha', sub: 'planejamento', x: 450, y: 515, glyph: 'grid', color: CYAN },
  { id: 'ingest', label: 'Forge Ingest', sub: 'npm run ingest', x: 790, y: 320, glyph: 'gear', color: ORANGE },
  { id: 'publish', label: 'Publicar snapshot', sub: 'snapshot.json', x: 1100, y: 320, glyph: 'upload', color: CYAN },
];
const EDGES: Array<[string, string]> = [
  ['cron', 'git'],
  ['cron', 'jira'],
  ['cron', 'sheet'],
  ['git', 'ingest'],
  ['jira', 'ingest'],
  ['sheet', 'ingest'],
  ['ingest', 'publish'],
];

const node = (id: string) => NODES.find((n) => n.id === id)!;
type P = [number, number];
/** Cubic bezier in canvas coordinates, leaving the right side of a node and entering the left of the next. */
function curve(a: string, b: string): [P, P, P, P] {
  const from = node(a);
  const to = node(b);
  const p0: P = [from.x + NODE_W / 2, from.y];
  const p3: P = [to.x - NODE_W / 2, to.y];
  const k = (p3[0] - p0[0]) * 0.5;
  return [p0, [p0[0] + k, p0[1]], [p3[0] - k, p3[1]], p3];
}
const CURVES = EDGES.map(([a, b]) => curve(a, b));
function bezier(c: [P, P, P, P], t: number): P {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * c[0][0] + w[1] * c[1][0] + w[2] * c[2][0] + w[3] * c[3][0], w[0] * c[0][1] + w[1] * c[1][1] + w[2] * c[2][1] + w[3] * c[3][1]];
}
const toLocal = ([x, y]: P): [number, number] => [(x / CW - 0.5) * PW, (0.5 - y / CH) * PH];

function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (glyph) {
    case 'clock':
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.moveTo(0, -11);
      ctx.lineTo(0, 0);
      ctx.lineTo(10, 7);
      ctx.stroke();
      break;
    case 'branch':
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.lineTo(-10, 18);
      ctx.moveTo(-10, 4);
      ctx.quadraticCurveTo(-10, -8, 10, -8);
      ctx.stroke();
      for (const [x, y] of [[-10, -18], [-10, 18], [12, -9]]) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'ticket':
      roundRect(ctx, -18, -18, 36, 36, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-2, 7);
      ctx.lineTo(9, -7);
      ctx.stroke();
      break;
    case 'grid':
      roundRect(ctx, -20, -18, 40, 36, 5);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.moveTo(-7, -18);
      ctx.lineTo(-7, 18);
      ctx.moveTo(7, -18);
      ctx.lineTo(7, 18);
      ctx.stroke();
      break;
    case 'gear':
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
        ctx.stroke();
      }
      break;
    case 'upload':
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, -16);
      ctx.moveTo(-12, -4);
      ctx.lineTo(0, -16);
      ctx.lineTo(12, -4);
      ctx.moveTo(-18, 20);
      ctx.lineTo(18, 20);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawGraph(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(6,26,40,0.72)';
  roundRect(ctx, 6, 6, w - 12, h - 12, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56,225,255,0.7)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // faint dotted grid, like the n8n canvas
  ctx.fillStyle = 'rgba(143,233,255,0.14)';
  for (let x = 40; x < w; x += 40) for (let y = 40; y < h; y += 40) ctx.fillRect(x, y, 3, 3);

  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(143,233,255,0.6)';
  for (const [p0, p1, p2, p3] of CURVES) {
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    ctx.stroke();
  }
  for (const n of NODES) {
    const x = n.x - NODE_W / 2;
    const y = n.y - NODE_H / 2;
    ctx.fillStyle = 'rgba(14,34,48,0.96)';
    roundRect(ctx, x, y, NODE_W, NODE_H, 22);
    ctx.fill();
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 4;
    ctx.stroke();
    // connection ports
    ctx.fillStyle = '#8FE9FF';
    for (const px of [x, x + NODE_W]) {
      ctx.beginPath();
      ctx.arc(px, n.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `${n.color}26`;
    roundRect(ctx, x + 14, y + 16, 64, 80, 16);
    ctx.fill();
    drawGlyph(ctx, n.glyph, x + 46, n.y, n.color);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F5F5F5';
    ctx.font = FONTS.display(n.label.length > 12 ? 24 : 30, 700);
    ctx.fillText(n.label, x + 88, n.y - 14, NODE_W - 98);
    ctx.fillStyle = '#8FE9FF';
    ctx.font = FONTS.mono(20, 600);
    ctx.fillText(n.sub, x + 88, n.y + 22, NODE_W - 98);
  }
  ctx.fillStyle = ORANGE;
  ctx.font = FONTS.display(40, 700);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('n8n', 36, 66);
}

const planeGeo = new THREE.PlaneGeometry(1, 1);
const pulseGeo = new THREE.SphereGeometry(1, 10, 8);
const PULSE_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFFFFF').multiplyScalar(1.6), toneMapped: false, depthWrite: false });

/** n8n workstation: a sleek desk with a floating workflow graph and data pulses along its edges. */
export function N8nDesk({ position, reducedMotion }: { position: [number, number, number]; reducedMotion: boolean }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'automation' });
  const glow = selected ? 1 : hovered ? 0.75 : 0.35;
  const graph = useCanvasTexture(CW, CH, drawGraph, []);
  const pulses = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = pulses.current;
    if (!g) return;
    for (let i = 0; i < g.children.length; i++) {
      const t = reducedMotion ? 0.5 : (clock.elapsedTime * 0.28 + i * 0.37) % 1;
      const [x, y] = toLocal(bezier(CURVES[i], t));
      g.children[i].position.set(x, y, 0.012);
    }
  });

  const edge = selected || hovered ? '#FFFFFF' : CYAN;
  const lit = useMemo(() => mat.glow(edge, glow * 1.3 + 0.3), [edge, glow]);
  return (
    <group position={position} rotation={[0, AUTOMATION_YAW, 0]} {...handlers}>
      {/* invisible, generous hit volume */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[3.1, 2.4, 1.3]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* desk: slim graphite top on two blade legs, light strip along the front edge */}
      <Box position={[0, 0.78, 0]} size={[2.5, 0.07, 0.95]} material={mat.rackMetal()} />
      <Box position={[-1.1, 0.38, 0]} size={[0.09, 0.76, 0.8]} material={mat.steel()} />
      <Box position={[1.1, 0.38, 0]} size={[0.09, 0.76, 0.8]} material={mat.steel()} />
      <Box position={[0, 0.82, 0.465]} size={[2.5, 0.015, 0.025]} material={lit} shadows={false} />
      <Box position={[0, 0.36, -0.3]} size={[2.1, 0.5, 0.04]} material={mat.rackMetal()} />
      {/* emitter strip under the hologram */}
      <Box position={[0, 0.83, -0.15]} size={[0.9, 0.012, 0.18]} material={mat.glow(ORANGE, 1.1)} shadows={false} />
      {/* floating workflow graph */}
      <group position={[0, 2.0, -0.1]}>
        <mesh geometry={planeGeo} scale={[PW, PH, 1]}>
          <meshBasicMaterial map={graph} transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} opacity={0.82 + glow * 0.18} />
        </mesh>
        <group ref={pulses}>
          {CURVES.map((_, i) => (
            <mesh key={i} geometry={pulseGeo} material={PULSE_MAT} scale={0.026} />
          ))}
        </group>
      </group>
      <pointLight position={[0, 1.6, 0.6]} intensity={1.2 + glow * 2} distance={3.5} color={CYAN} />
    </group>
  );
}
