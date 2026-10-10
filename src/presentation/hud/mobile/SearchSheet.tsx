import { useId, useState } from 'react';
import { useUiStore } from '@presentation/state/uiStore';
import { Icon } from '../kit/Icon';
import { SearchOptionBody, searchKey, useSearchResults } from '../panels/topbar/GlobalSearch';
import { ModalShell } from '../views/ModalShell';

/** Phone search: full-screen sheet with the same index as the desktop search box. */
export function SearchSheet() {
  const select = useUiStore((s) => s.select);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useSearchResults(query);
  const close = () => setSearchOpen(false);
  const choose = (i: number) => {
    const r = results[i];
    if (!r) return;
    select(r.ref);
    close();
  };

  return (
    <ModalShell title="Buscar" onClose={close} closeLabel="Fechar busca" className="h-full">
      <div className="p-3">
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute top-3.5 left-3 text-fog" />
          <input
            data-autofocus
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Buscar repositórios, mudanças, pessoas, iniciativas e squads"
            placeholder="Repositório, mudança, pessoa, iniciativa…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && results.length) setActive((a) => (a + 1) % results.length);
              else if (e.key === 'ArrowUp' && results.length) setActive((a) => (a - 1 + results.length) % results.length);
              else if (e.key === 'Enter') choose(active);
            }}
            className="focus-ring h-11 w-full rounded-xl bg-white/[0.06] pr-3 pl-9 text-base text-snow placeholder:text-fog"
          />
        </div>
      </div>
      <ul id={listId} role="listbox" aria-label="Resultados da busca" className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-3">
        {query.trim() !== '' && results.length === 0 && <li className="px-3 py-2 text-sm text-fog">Nada encontrado.</li>}
        {results.map((r, i) => (
          <li
            key={searchKey(r)}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onClick={() => choose(i)}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ${i === active ? 'bg-white/[0.08]' : ''}`}
          >
            <SearchOptionBody r={r} />
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
