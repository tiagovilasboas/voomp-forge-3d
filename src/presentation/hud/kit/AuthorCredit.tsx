import { Icon } from './Icon';

const AUTHOR = { handle: 'tiagovilasboas', profile: 'https://github.com/tiagovilasboas', sponsor: 'https://github.com/sponsors/tiagovilasboas' };

/** Discreet author credit + sponsor link. Real links: they open in a new tab even in Demo Mode. */
export function AuthorCredit() {
  const link = 'focus-ring inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] whitespace-nowrap transition';
  return (
    <span className="inline-flex items-center gap-1">
      <a href={AUTHOR.profile} target="_blank" rel="noreferrer" className={`${link} text-fog/70 hover:text-snow`} title="Autor no GitHub">
        <Icon name="github" size={12} />
        por @{AUTHOR.handle}
      </a>
      <a
        href={AUTHOR.sponsor}
        target="_blank"
        rel="noreferrer"
        className={`${link} text-fog/70 hover:bg-forge/10 hover:text-forge-bright`}
        title="Apoie o projeto no GitHub Sponsors"
      >
        <Icon name="heart" size={12} />
        Sponsor
      </a>
      <MadeWithLove />
    </span>
  );
}

const LOVE_NOTE = `Made with love for Voomp by @${AUTHOR.handle}`;

/** Small orange heart at the end of the credit row; the note shows on hover/focus. */
function MadeWithLove() {
  return (
    <a
      href={AUTHOR.profile}
      target="_blank"
      rel="noreferrer"
      aria-label={LOVE_NOTE}
      className="focus-ring group relative inline-grid h-5 w-5 place-items-center rounded-md text-forge transition hover:text-forge-bright"
    >
      <svg width={12} height={12} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md border border-white/10 bg-ink-900/95 px-2 py-1 text-[11px] text-snow opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {LOVE_NOTE}
      </span>
    </a>
  );
}
