import { useCallback, useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. False where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/** Layout tier: phone < 768px, tablet 768-1279px, desktop >= 1280px (see docs/RESPONSIVE_SPEC.md). */
export function useBreakpoint(): Breakpoint {
  const md = useMediaQuery('(min-width: 768px)');
  const xl = useMediaQuery('(min-width: 1280px)');
  return xl ? 'desktop' : md ? 'tablet' : 'phone';
}

/** True on devices with a precise hovering pointer (mouse/trackpad). */
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}
