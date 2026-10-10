import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { Repository } from '@domain/entities';
import type { RepositoryHealth } from '@application/queries/repositoryHealth';
import { PALETTE, SIGNAL_LOOK } from '../../theme';
import type { RackLayout } from '../../world/worldModel';
import { yawFor } from '../../world/frame';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

/** Floating "!" marker for racks with an alert. */
function AlertSprite({ x, y }: { x: number; y: number }) {
  const tex = useCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.fail;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = FONTS.display(84, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', w / 2, h / 2 + 4);
    },
    [],
  );
  return (
    <sprite position={[x, y, 0.2]} scale={[0.5, 0.5, 0.5]}>
      <spriteMaterial map={tex} toneMapped={false} depthTest={false} />
    </sprite>
  );
}

const W = 1.5;
const H = 2.5;
const D = 1.1;
const BLADES_PER_MODULE = 2;
const MODULE_ORDER = ['changes', 'pipeline', 'deploy', 'commits'] as const;

interface Props {
  layout: RackLayout;
  repo: Repository;
  health: RepositoryHealth;
  /** Related to the highlighted initiative / selection. */
  highlighted: boolean;
  /** Outside the active squad filter. */
  dimmed: boolean;
  reducedMotion: boolean;
}

/**
 * Rack = repository. Four modules (2 blades each) light up with the signal of
 * one information area: changes, pipeline, deploy, commits. The beacon on top
 * summarises: red = alert, orange pulse = recent activity, grey = idle.
 */
export function RackEntity({ layout, repo, health, highlighted, dimmed, reducedMotion }: Props) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'repo', id: repo.id });
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);

  const beaconColor = health.alert ? PALETTE.fail : health.idle ? PALETTE.idle : health.hot ? PALETTE.forge : PALETTE.ok;

  const plate = useCanvasTexture(
    512,
    96,
    (ctx, w, h) => {
      ctx.fillStyle = '#0B0D11';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = health.idle ? '#6B7280' : PALETTE.forge;
      ctx.fillRect(0, 0, 10, h);
      ctx.fillStyle = '#F5F5F5';
      ctx.font = FONTS.display(38, 700);
      ctx.textBaseline = 'middle';
      const name = repo.name.length > 20 ? `${repo.name.slice(0, 19)}…` : repo.name;
      ctx.fillText(name, 26, h / 2 - 8);
      ctx.fillStyle = '#9DA3AE';
      ctx.font = FONTS.mono(18, 500);
      ctx.fillText(`${repo.language.toUpperCase()} · ${repo.defaultBranch}`, 26, h / 2 + 26);
    },
    [repo.name, repo.language, health.idle],
  );

  const moduleSignals = useMemo(
    () => MODULE_ORDER.map((id) => health.modules.find((m) => m.id === id)?.signal ?? 'unknown'),
    [health.modules],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beacon.current) {
      const pulse = reducedMotion ? 1 : health.alert ? (Math.sin(t * 5) > 0 ? 1.6 : 0.5) : health.hot ? 1 + Math.sin(t * 2.6) * 0.5 : 0.8;
      beacon.current.color.set(beaconColor).multiplyScalar(dimmed ? 0.35 : pulse);
    }
    if (halo.current) {
      const s = 1 + (reducedMotion ? 0 : Math.sin(t * 2.2) * 0.04);
      halo.current.scale.set(s, s, s);
    }
  });

  const [x, z] = layout.position;
  const frontZ = D / 2;

  return (
    <group position={[x, 0, z]} rotation={[0, yawFor(layout.facing), 0]} {...handlers}>
      {/* plinth + frame */}
      <Box position={[0, 0.06, 0]} size={[W + 0.12, 0.12, D + 0.12]} material={mat.rubber()} />
      {/* holographic glass body — translucent shell, status colour on edges */}
      <Box position={[0, H / 2 + 0.12, 0]} size={[W, H, D]} material={mat.rackGlass()} />
      {/* top glow strip in status colour */}
      <Box position={[0, H + 0.15, 0]} size={[W + 0.04, 0.04, D + 0.04]} material={mat.glow(beaconColor, dimmed ? 0.25 : 1.5)} shadows={false} />
      {/* 4 vertical corner trims */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <Box
            key={`c${sx}${sz}`}
            position={[sx * (W / 2 + 0.01), H / 2 + 0.12, sz * (D / 2 + 0.01)]}
            size={[0.04, H + 0.04, 0.04]}
            material={mat.glow(beaconColor, dimmed ? 0.18 : 1.0)}
            shadows={false}
          />
        ))
      )}
      <Box position={[0, H / 2 + 0.12, frontZ - 0.02]} size={[W - 0.18, H - 0.22, 0.04]} material={mat.rackInner()} shadows={false} />

      {/* blades + module LED strips */}
      {moduleSignals.map((signal, m) =>
        Array.from({ length: BLADES_PER_MODULE }, (_, b) => {
          const row = m * BLADES_PER_MODULE + b;
          const y = H + 0.12 - 0.32 - row * 0.27;
          const color = SIGNAL_LOOK[signal].color;
          return (
            <group key={`${m}-${b}`} position={[0, y, frontZ + 0.005]}>
              <Box position={[0, 0, 0]} size={[W - 0.26, 0.2, 0.05]} material={mat.blade()} shadows={false} />
              <Box
                position={[-W / 2 + 0.26, 0, 0.03]}
                size={[0.07, 0.07, 0.02]}
                material={mat.glow(color, dimmed ? 0.3 : signal === 'idle' ? 0.6 : 1.6)}
                shadows={false}
              />
              <Box position={[0.12, 0, 0.03]} size={[0.62, 0.025, 0.01]} material={mat.glow(color, dimmed ? 0.15 : 0.55)} shadows={false} />
              <Box position={[0.56, 0, 0.03]} size={[0.04, 0.04, 0.01]} material={mat.glow(PALETTE.forgeBright, dimmed ? 0.2 : 0.9)} shadows={false} />
            </group>
          );
        }),
      )}

      {/* tinted glass door */}
      <Box position={[0, H / 2 + 0.12, frontZ + 0.06]} size={[W - 0.06, H - 0.08, 0.02]} material={mat.glass()} shadows={false} />

      {/* name plate on the header */}
      <Decal texture={plate} position={[0, H + 0.36, frontZ + 0.01]} size={[W, W * (96 / 512)]} />
      {layout.facing < 0 && <Decal texture={plate} position={[0, H + 0.36, -frontZ - 0.01]} size={[W, W * (96 / 512)]} rotation={[0, Math.PI, 0]} />}
      <Box position={[0, H + 0.36, 0]} size={[W, 0.3, D]} material={mat.rackMetal()} />

      {/* beacon */}
      <mesh position={[W / 2 - 0.22, H + 0.6, 0.2]}>
        <cylinderGeometry args={[0.09, 0.11, 0.18, 16]} />
        <meshBasicMaterial ref={beacon} toneMapped={false} color={beaconColor} />
      </mesh>
      {health.alert && !dimmed && <AlertSprite y={H + 1.0} x={W / 2 - 0.22} />}

      {/* selection / hover / highlight feedback */}
      {(hovered || selected || highlighted) && (
        <>
          <mesh position={[0, H / 2 + 0.25, 0]} scale={[W + 0.04, H + 0.5, D + 0.04]}>
            <boxGeometry />
            <meshBasicMaterial visible={false} />
            <Edges color={selected ? PALETTE.forgeBright : highlighted ? PALETTE.warn : PALETTE.snow} lineWidth={selected ? 2.2 : 1.4} />
          </mesh>
          <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[1.15, 1.3, 48]} />
            <meshBasicMaterial color={selected ? PALETTE.forge : highlighted ? PALETTE.warn : PALETTE.snow} transparent opacity={selected ? 0.9 : 0.45} toneMapped={false} />
          </mesh>
        </>
      )}

    </group>
  );
}
