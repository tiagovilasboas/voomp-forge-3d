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
    </span>
  );
}
