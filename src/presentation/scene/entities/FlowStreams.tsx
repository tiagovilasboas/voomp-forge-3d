import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { DeliveryEvent, DeliveryEventKind } from '@application/queries/events';
import { PALETTE } from '../../theme';
import type { Vec2, WorldModel } from '../../world/worldModel';
import { flowPath, pathLength, pointAt } from '../../world/flowPaths';

const FLOW_COLOR: Record<DeliveryEventKind, string> = {
  merged: PALETTE.forge,
  deployed_staging: PALETTE.warn,
  deployed_production: PALETTE.ok,
  pipeline_failed: PALETTE.fail,
};

const PULSES_PER_FLOW = 3;
const SPEED = 2.6; // units per second
/** Flows are light trails painted on the floor, not floating tubes. */
/** Just above the room platforms (0.14) so trails stay visible inside rooms. */
const LINE_Y = 0.155;
const PULSE_Y = 0.16;

interface Flow {
  id: string;
  repoId: string;
  path: Vec2[];
  length: number;
  color: THREE.Color;
  phase: number;
}

/**
 * Fluxo luminoso = engineering event. One instanced mesh draws every pulse;
 * the lit lane under each flow is the "caminho iluminado" relating rack and destination.
 */
export function FlowStreams({
  world,
  events,
  focusRepoIds,
  reducedMotion,
}: {
  world: WorldModel;
  events: DeliveryEvent[];
  /** When set, flows from other repos are dimmed. */
  focusRepoIds: Set<string> | null;
  reducedMotion: boolean;
}) {
  const flows = useMemo<Flow[]>(() => {
    // One flow per (repo, kind): repeated events strengthen it rather than duplicating lanes.
    const seen = new Map<string, Flow>();
    events.forEach((e, i) => {
      const key = `${e.repoId}:${e.kind}`;
      if (seen.has(key)) return;
      const path = flowPath(world, e.repoId, e.kind);
      if (!path) return;
      seen.set(key, { id: key, repoId: e.repoId, path, length: pathLength(path), color: new THREE.Color(FLOW_COLOR[e.kind]), phase: (i * 0.37) % 1 });
    });
    return [...seen.values()];
  }, [world, events]);

  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = flows.length * PULSES_PER_FLOW;
  // Flat discs: rotate once so every pulse lies on the floor.
  const dummy = useMemo(() => {
    const d = new THREE.Object3D();
    d.rotation.x = -Math.PI / 2;
    return d;
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    flows.forEach((f, i) => {
      const dim = focusRepoIds && !focusRepoIds.has(f.repoId) ? 0.12 : 2.2;
      for (let p = 0; p < PULSES_PER_FLOW; p++) m.setColorAt(i * PULSES_PER_FLOW + p, f.color.clone().multiplyScalar(dim));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [flows, focusRepoIds]);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    flows.forEach((f, i) => {
      for (let p = 0; p < PULSES_PER_FLOW; p++) {
        const travel = reducedMotion ? (p + 0.5) / PULSES_PER_FLOW : ((t * SPEED) / f.length + f.phase + p / PULSES_PER_FLOW) % 1;
        const [x, z] = pointAt(f.path, travel, f.length);
        // Pulses swell in the middle of their trip and shrink on arrival.
        const s = reducedMotion ? 0.1 : 0.08 + Math.sin(travel * Math.PI) * 0.06;
        dummy.position.set(x, PULSE_Y, z);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        m.setMatrixAt(i * PULSES_PER_FLOW + p, dummy.matrix);
      }
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {flows.map((f) => (
        <Line
          key={f.id}
          points={f.path.map(([x, z]) => [x, LINE_Y, z] as [number, number, number])}
          color={f.color}
          lineWidth={focusRepoIds?.has(f.repoId) ? 2 : 1}
          transparent
          opacity={focusRepoIds && !focusRepoIds.has(f.repoId) ? 0.05 : 0.35}
          toneMapped={false}
        />
      ))}
      {count > 0 && (
        <instancedMesh key={count} ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial toneMapped={false} transparent opacity={0.8} depthWrite={false} />
        </instancedMesh>
      )}
    </group>
  );
}
