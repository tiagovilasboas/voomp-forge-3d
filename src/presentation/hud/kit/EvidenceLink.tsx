import { useDataStore } from '../../state/dataStore';
import { Icon } from './Icon';

/**
 * Link to the source of truth (change request, pipeline, deployment…).
 * In Demo Mode the targets do not exist, so the link is shown but not navigable.
 */
export function EvidenceLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isDemo = useDataStore((s) => s.state.snapshot?.source.kind === 'demo');
  if (isDemo) {
    return (
      <span
        className="inline-flex cursor-help items-center gap-1 text-xs font-semibold text-fog underline decoration-dotted underline-offset-2"
        title={`Link demonstrativo (DEMO DATA): ${href}`}
      >
        {children}
        <Icon name="external" size={12} />
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focus-ring inline-flex items-center gap-1 text-xs font-semibold text-forge-bright hover:underline"
    >
      {children}
      <Icon name="external" size={12} />
    </a>
  );
}
