import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import * as THREE from 'three';
import { useUiStore } from '../../state/uiStore';
import type { FocusTarget, WorldModel } from '../../world/worldModel';
import { focusFor, focusForRepos, overviewFocus } from '../../world/buildWorld';
import { useReadyData } from '../../state/dataStore';
import { livePositions } from '../../interaction/livePositions';

const { ACTION } = CameraControlsImpl;

/** Isometric-ish framing: looking from the front-right, ~55° down. */
const AZIMUTH = 0.62;
const POLAR = 0.98;
const AZIMUTH_RANGE = 0.75;
/** Screen pixels covered by the inspector on the right; focused items shift left of it. */
const INSPECTOR_PX = 340;

interface SavedView {
  target: THREE.Vector3;
  zoom: number;
  azimuth: number;
}

/**
 * Camera system: drag = pan, right-drag = limited rotation, wheel/pinch = zoom.
 * Reacts to camera commands from the UI store (focus, overview, back, zoom, rotate).
 */
export function CameraRig({ world }: { world: WorldModel }) {
  const controls = useRef<CameraControlsImpl>(null);
  const { index } = useReadyData();
  const { size } = useThree();
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const command = useUiStore((s) => s.camera);
  const saved = useRef<SavedView | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const fitZoom = (f: FocusTarget, panelOpen: boolean) => {
    const { width, height } = sizeRef.current;
    const usableW = width > 900 && panelOpen ? width - 640 : width;
    return Math.max(4, Math.min(120, Math.min(usableW, height * 0.8) / (f.radius * 2)));
  };

  /** Moves so `f` sits in the free area of the screen (left of the inspector when it is open). */
  const frame = (f: FocusTarget, panelOpen: boolean, animate: boolean) => {
    const c = controls.current;
    if (!c) return;
    const zoom = fitZoom(f, panelOpen);
    const wide = sizeRef.current.width > 900;
    const shiftPx = panelOpen && wide ? INSPECTOR_PX / 2 : 0;
    const az = c.azimuthAngle;
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
    const target = new THREE.Vector3(f.center[0], 0.8, f.center[1]).addScaledVector(right, shiftPx / zoom);
    void c.moveTo(target.x, target.y, target.z, animate);
    void c.zoomTo(zoom, animate);
  };

  // Initial overview, without animation.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { min, max } = world.bounds;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(min[0], -1, min[1]), new THREE.Vector3(max[0], 4, max[1])));
    void c.rotateTo(AZIMUTH, POLAR, false);
    frame(overviewFocus(world), false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => {
    const c = controls.current;
    if (!c || !command) return;
    const animate = !reducedMotion;
    const panelOpen = useUiStore.getState().selection !== null;

    switch (command.type) {
      case 'focus': {
        const ref = command.ref;
        let f = focusFor(world, ref);
        // Change requests and initiatives live on racks: frame the racks they touch.
        if (ref.kind === 'cr') {
          const cr = index.cr.get(ref.id);
          f = cr ? focusFor(world, { kind: 'repo', id: cr.repositoryId }) : null;
        }
        if (ref.kind === 'initiative') {
          f = focusForRepos(world, (index.crsByInitiative.get(ref.id) ?? []).map((c) => c.repositoryId));
        }
        if (ref.kind === 'person') {
          const live = livePositions.get(ref.id);
          if (live && f) f = { ...f, center: live };
        }
        if (!f) return;
        if (!saved.current) saved.current = { target: c.getTarget(new THREE.Vector3()), zoom: c.camera.zoom, azimuth: c.azimuthAngle };
        frame(f, panelOpen, animate);
        break;
      }
      case 'overview':
        saved.current = null;
        void c.rotateTo(AZIMUTH, POLAR, animate);
        frame(overviewFocus(world), panelOpen, animate);
        break;
      case 'back':
        if (saved.current) {
          const { target, zoom, azimuth } = saved.current;
          void c.moveTo(target.x, target.y, target.z, animate);
          void c.zoomTo(zoom, animate);
          void c.rotateAzimuthTo(azimuth, animate);
          saved.current = null;
        }
        break;
      case 'zoom':
        void c.zoomTo(c.camera.zoom * command.factor, animate);
        break;
      case 'rotate':
        void c.rotate(command.radians, 0, animate);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={reducedMotion ? 0 : 0.35}
      draggingSmoothTime={0.08}
      minZoom={5}
      maxZoom={140}
      minPolarAngle={POLAR - 0.25}
      maxPolarAngle={POLAR + 0.12}
      minAzimuthAngle={AZIMUTH - AZIMUTH_RANGE}
      maxAzimuthAngle={AZIMUTH + AZIMUTH_RANGE}
      dollyToCursor
      boundaryEnclosesCamera={false}
      mouseButtons={{ left: ACTION.TRUCK, middle: ACTION.NONE, right: ACTION.ROTATE, wheel: ACTION.ZOOM }}
      touches={{ one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.TOUCH_ROTATE }}
    />
  );
}
