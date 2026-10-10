import { IconButton } from '../../kit/primitives';
import { ActivityTabs } from '../ActivityTabs';
import { usePopover } from './usePopover';

/** Tablet: the activity queues live behind a top-bar button instead of the fixed bottom-right card. */
export function ActivityPopover() {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <IconButton icon="pulse" label="Atividade" onClick={() => setOpen(!open)} active={open} />
      {open && (
        <div role="dialog" aria-label="Atividade" className="absolute top-full right-0 z-40 mt-2 h-[min(420px,calc(100dvh-96px))] w-[min(360px,calc(100vw-24px))]">
          <ActivityTabs />
        </div>
      )}
    </div>
  );
}
