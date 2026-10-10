import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReadyData } from '@presentation/state/dataStore';
import { useUiStore } from '@presentation/state/uiStore';
import type { EntityRef } from '@presentation/world/worldModel';
import type { IconName } from '@presentation/theme';
import { Icon } from '@presentation/hud/kit/Icon';

interface SearchItem {
  ref: EntityRef;
  icon: IconName;
  kind: string;
  title: string;
  sub: string;
  haystack: string;
}

const MAX_RESULTS = 8;

function useSearchItems(): SearchItem[] {
  const { snapshot, index } = useReadyData();
  return useMemo(() => {
    const short = snapshot.source.provider.vocabulary.changeRequestShort;
    const item = (ref: EntityRef, icon: IconName, kind: string, title: string, sub: string, extra = ''): SearchItem => ({
      ref, icon, kind, title, sub, haystack: `${title} ${sub} ${extra}`.toLowerCase(),
    });
    return [
      ...snapshot.squads.map((s) => item({ kind: 'squad', id: s.id }, 'squad', 'Squad', s.name, `SQ-${s.code}`, s.code)),
      ...snapshot.repositories.map((r) =>
        item({ kind: 'repo', id: r.id }, 'rack', 'Repositório', r.name, index.squad.get(r.squadId)?.name ?? '', r.fullName)),
      ...snapshot.changeRequests.map((cr) =>
        item({ kind: 'cr', id: cr.id }, 'merge', short, `#${cr.number} ${cr.title}`, index.repo.get(cr.repositoryId)?.name ?? '', cr.productSummary ?? '')),
      ...snapshot.contributors.map((p) => item({ kind: 'person', id: p.id }, 'person', 'Pessoa', p.displayName, `@${p.handle}`)),
      ...snapshot.initiatives.map((i) => item({ kind: 'initiative', id: i.id }, 'target', 'Iniciativa', i.name, i.key, i.key)),
    ];
  }, [snapshot, index]);
}

/** Global search. Below `lg` it is an icon that expands on focus. Press "/" to focus. */
export function GlobalSearch() {
  const items = useSearchItems();
  const select = useUiStore((s) => s.select);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.haystack.includes(q)).slice(0, MAX_RESULTS) : [];
  }, [items, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (r: SearchItem) => {
    select(r.ref);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[active]) {
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  const showList = focused && query.trim() !== '';

  return (
    <div className="relative h-8 w-8 shrink-0 lg:w-auto lg:max-w-[260px] lg:min-w-[120px] lg:flex-1">
      <Icon name="search" size={14} className="pointer-events-none absolute top-2 left-2.5 z-10 text-fog" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-label="Buscar repositórios, mudanças, pessoas, iniciativas e squads"
        placeholder="Buscar… ( / )"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className="focus-ring absolute top-0 right-0 z-10 h-8 w-8 rounded-lg bg-white/[0.05] pr-0 pl-8 text-[13px] text-snow placeholder:text-fog focus:w-64 focus:bg-ink-800 lg:static lg:w-full lg:pr-2 lg:focus:w-full"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Resultados da busca"
          className="hud-card absolute top-10 right-0 z-40 w-80 max-w-[calc(100vw-24px)] p-1 lg:right-auto lg:left-0"
        >
          {results.length === 0 && <li className="px-3 py-2 text-xs text-fog">Nada encontrado.</li>}
          {results.map((r, i) => (
            <li
              key={`${r.ref.kind}-${'id' in r.ref ? r.ref.id : ''}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ${i === active ? 'bg-white/[0.08]' : ''}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 text-fog">
                <Icon name={r.icon} size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-snow">{r.title}</span>
                <span className="block truncate text-[11px] text-fog">{r.sub}</span>
              </span>
              <span className="shrink-0 text-[10px] font-semibold tracking-wide text-fog uppercase">{r.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
