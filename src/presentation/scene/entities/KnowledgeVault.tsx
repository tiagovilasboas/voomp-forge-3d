import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { KnowledgeDocument } from '@domain/entities';
import type { RackLayout, Vec2 } from '../../world/worldModel';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

/** Knowledge has its own hue so it never reads as a delivery status. */
export const KNOWLEDGE = '#A5A8F0';
const TOWER_RADIUS = 2.1;
const LEVEL_H = 0.55;
const CRYSTAL = new THREE.OctahedronGeometry(0.16, 0);

interface Placed {
  doc: KnowledgeDocument;
  local: [number, number, number];
}

function Crystal({ placed, lit, dimmed, reducedMotion }: { placed: Placed; lit: boolean; dimmed: boolean; reducedMotion: boolean }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'document', id: placed.doc.id });
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const seed = placed.doc.id.length;

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const on = lit || hovered || selected;
    m.rotation.y = reducedMotion ? 0.4 : t * (on ? 1.2 : 0.35) + seed;
    m.position.y = placed.local[1] + (reducedMotion ? 0 : Math.sin(t * 1.6 + seed) * (on ? 0.05 : 0.015));
    material.color.set(KNOWLEDGE).multiplyScalar(on ? 2.2 : dimmed ? 0.25 : 0.7);
  });

  return (
    <mesh
      ref={ref}
      geometry={CRYSTAL}
      material={material}
      position={placed.local}
      scale={selected ? 1.35 : hovered ? 1.2 : 1}
      {...handlers}
    />
  );
}

/**
 * Arquivo de conhecimento: glass towers (one per knowledge space) holding one
 * data crystal per document. Documents linked to the current focus light up
 * and beam to the racks they document.
 */
export function KnowledgeVault({
  position,
  yaw = 0,
  documents,
  litDocIds,
  racks,
  reducedMotion,
}: {
  position: Vec2;
  /** Room rotation (0 or π). */
  yaw?: number;
  documents: KnowledgeDocument[];
  /** Null = no focus (everything at rest). */
  litDocIds: Set<string> | null;
  racks: RackLayout[];
  reducedMotion: boolean;
}) {
  const [vx, vz] = position;
  const cosYaw = Math.round(Math.cos(yaw));

  const { towers, placed } = useMemo(() => {
    const spaces = [...new Set(documents.map((d) => d.space))].sort();
    const towers = spaces.map((space, i) => {
      const angle = spaces.length === 1 ? 0 : -0.9 + (1.8 * i) / (spaces.length - 1);
      return { space, x: Math.sin(angle) * TOWER_RADIUS, z: -Math.cos(angle) * TOWER_RADIUS * 0.55 };
    });
    const placed: Placed[] = [];
    for (const tower of towers) {
      documents
        .filter((d) => d.space === tower.space)
        .forEach((doc, level) => placed.push({ doc, local: [tower.x, 0.55 + level * LEVEL_H, tower.z] }));
    }
    return { towers, placed };
  }, [documents]);

  const sign = useCanvasTexture(
    768,
    160,
    (ctx, w, h) => {
      ctx.fillStyle = '#0B0D12';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = KNOWLEDGE;
      ctx.fillRect(0, h - 8, w, 8);
      ctx.font = FONTS.display(52, 700);
      ctx.fillText('ARQUIVO DE CONHECIMENTO', 28, 72);
      ctx.fillStyle = '#9DA3AE';
      ctx.font = FONTS.mono(24, 500);
      ctx.fillText(`${documents.length} DOCUMENTOS · SPECS · ADRS · RUNBOOKS`, 28, 122);
    },
    [documents.length],
  );

  const beams = useMemo(() => {
    if (!litDocIds) return [];
    return placed
      .filter((p) => litDocIds.has(p.doc.id))
      .flatMap((p) =>
        p.doc.repositoryIds
          .map((repoId) => racks.find((r) => r.repoId === repoId))
          .filter((r): r is RackLayout => Boolean(r))
          .map((rack) => {
            const from = new THREE.Vector3(vx + p.local[0] * cosYaw, p.local[1], vz + p.local[2] * cosYaw);
            const to = new THREE.Vector3(rack.position[0], 3.2, rack.position[1]);
            const mid = from.clone().lerp(to, 0.5).setY(Math.max(from.y, to.y) + 2.5);
            return { key: `${p.doc.id}-${repoId(rack)}`, points: new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(32) };
          }),
      );
  }, [litDocIds, placed, racks, vx, vz, cosYaw]);

  const dimmed = litDocIds !== null;

  return (
    <group>
      <group position={[vx, 0, vz]} rotation={[0, yaw, 0]}>
        {/* round plinth with a glowing rim */}
        <mesh position={[0, 0.06, 0]} receiveShadow material={mat.platform()}>
          <cylinderGeometry args={[3.1, 3.2, 0.12, 48]} />
        </mesh>
        <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.95, 3.05, 64]} />
          <meshBasicMaterial color={KNOWLEDGE} toneMapped={false} transparent opacity={0.7} />
        </mesh>
        {/* sign */}
        <Box position={[0, 3.4, -1.9]} size={[3.2, 0.7, 0.08]} material={mat.rackMetal()} />
        <Decal texture={sign} position={[0, 3.4, -1.85]} size={[3.1, 0.65]} glow />
        {/* glass towers */}
        {towers.map((t) => (
          <group key={t.space} position={[t.x, 0, t.z]}>
            <Box position={[0, 1.55, 0]} size={[0.62, 2.9, 0.62]} material={mat.glass()} shadows={false} />
            <Box position={[0, 0.16, 0]} size={[0.7, 0.08, 0.7]} material={mat.rackMetal()} />
            <Box position={[0, 3.02, 0]} size={[0.7, 0.06, 0.7]} material={mat.glow(KNOWLEDGE, 0.6)} shadows={false} />
            {Array.from({ length: 5 }, (_, l) => (
              <Box key={l} position={[0, 0.34 + l * LEVEL_H, 0]} size={[0.56, 0.02, 0.56]} material={mat.steel()} shadows={false} />
            ))}
          </group>
        ))}
        {placed.map((p) => (
          <Crystal
            key={p.doc.id}
            placed={p}
            lit={litDocIds?.has(p.doc.id) ?? false}
            dimmed={dimmed}
            reducedMotion={reducedMotion}
          />
        ))}
      </group>
      {beams.map((b) => (
        <Line key={b.key} points={b.points} color={KNOWLEDGE} lineWidth={0.6} transparent opacity={0.1} toneMapped={false} dashed dashSize={0.18} gapSize={0.55} />
      ))}
    </group>
  );
}

const repoId = (r: RackLayout) => r.repoId;
