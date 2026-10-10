import type { EntityRef } from '../../world/worldModel';

/** Selections that open as a full "Object Screen" instead of the inspector / bottom sheet. */
export type ObjectRef = Extract<EntityRef, { kind: 'whiteboard' | 'board' | 'desk' | 'hub' | 'terminal' | 'pinball' | 'fronts' | 'calendar' | 'workstream' }>;

export function isObjectRef(ref: EntityRef | null | undefined): ref is ObjectRef {
  return (
    ref?.kind === 'whiteboard' ||
    ref?.kind === 'board' ||
    ref?.kind === 'desk' ||
    ref?.kind === 'hub' ||
    ref?.kind === 'terminal' ||
    ref?.kind === 'pinball' ||
    ref?.kind === 'fronts' ||
    ref?.kind === 'calendar' ||
    ref?.kind === 'workstream'
  );
}
