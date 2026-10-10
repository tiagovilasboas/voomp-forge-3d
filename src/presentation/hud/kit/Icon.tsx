import type { IconName } from '../../theme';

/** Minimal stroke icon set (24×24, 1.8px), drawn for Forge. */
const PATHS: Record<IconName, string> = {
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  merge: 'M7 4v16M7 8c0 5 10 3 10 8M17 16v4M7 4a2 2 0 1 0 0 .1M17 20a2 2 0 1 0 0 .1',
  rocket: 'M12 15l-3-3c1.5-5 5-8 10-8 0 5-3 8.5-8 10zM9 12l-4 1 2-4h4M12 15l-1 4 4-2v-4M6 18c-1 0-2 1-2 2 1 0 2-1 2-2z',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  draft: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  x: 'M6 6l12 12M18 6 6 18',
  branch: 'M6 3v12M18 9a3 3 0 1 0 0-.1M6 21a3 3 0 1 0 0-.1M18 9c0 6-12 3-12 9',
  pipeline: 'M4 6h5v5H4zM15 13h5v5h-5zM9 8.5h3a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2',
  commit: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 12h6M15 12h6',
  squad: 'M3 21V9l9-6 9 6v12M9 21v-6h6v6',
  rack: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h6',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.4-1.4L17 5l-3-1-1 2h-2L10 4 7 5l.3 2-1.4 1.4L4 8l-1 3 2 1v2l-2 1 1 3 2-.3 1.4 1.4L7 21l3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .4 1-3-2-1z',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M7 5v14l11-7z',
};

export function Icon({ name, size = 16, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
