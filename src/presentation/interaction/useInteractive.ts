import { useCallback, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useUiStore } from '../state/uiStore';
import { refKey, type EntityRef } from '../world/worldModel';

/**
 * Pointer wiring for any selectable 3D entity: hover feedback, pointer cursor
 * and selection. Returns state flags so the entity can render its own feedback.
 */
export function useInteractive(ref: EntityRef) {
  const key = refKey(ref);
  const hovered = useUiStore((s) => (s.hover ? refKey(s.hover) === key : false));
  const selected = useUiStore((s) => (s.selection ? refKey(s.selection) === key : false));

  const onPointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useUiStore.getState().setHover(ref);
      document.body.style.cursor = 'pointer';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const onPointerOut = useCallback(() => {
    const { hover, setHover } = useUiStore.getState();
    if (hover && refKey(hover) === key) setHover(null);
    document.body.style.cursor = '';
  }, [key]);
  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      // Ignore clicks that ended a drag (pan/rotate).
      if (e.delta > 4) return;
      useUiStore.getState().select(ref);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const handlers = useMemo(() => ({ onPointerOver, onPointerOut, onClick }), [onPointerOver, onPointerOut, onClick]);
  return { hovered, selected, handlers };
}
