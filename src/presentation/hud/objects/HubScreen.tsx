import { useReadyData } from '../../state/dataStore';
import { useUiStore } from '../../state/uiStore';
import type { IconName } from '../../theme';
import { Icon } from '../kit/Icon';
import { HOLO, ObjectScreen } from './ObjectScreen';

/** Intro card for the Hub IA room: three attractions, each a button that selects it. */
export function HubScreen() {
  const { snapshot } = useReadyData();
  const select = useUiStore((s) => s.select);
  const firstDoc = snapshot.documents[0];

  const items: Array<{ icon: IconName; title: string; text: string; disabled?: boolean; onClick: () => void }> = [
    {
      icon: 'search',
      title: 'Terminal',
      text: 'Pergunte ao snapshot: status, PRs, entregas, iniciativas, documentos. Sem IA, só consultas determinísticas.',
      onClick: () => select({ kind: 'terminal' }),
    },
    {
      icon: 'target',
      title: 'Pinball holográfico',
      text: 'Jogue e aprenda: acenda as 5 etapas da entrega e resolva os quebra-cabeças.',
      onClick: () => select({ kind: 'pinball' }),
    },
    {
      icon: 'book',
      title: 'Arquivo de Conhecimento',
      text: firstDoc ? 'Specs, ADRs, runbooks e guias ligados às iniciativas e repositórios.' : 'Nenhum documento nos dados atuais.',
      disabled: !firstDoc,
      onClick: () => firstDoc && select({ kind: 'document', id: firstDoc.id }),
    },
  ];

  return (
    <ObjectScreen icon="compass" title="Hub IA" subtitle="Três atrações para explorar os dados">
      <div className="mx-auto grid max-w-3xl gap-3 p-4 md:p-6">
        <p className="text-sm text-fog">
          Bem-vindo ao Hub IA. Aqui o data center ganha ferramentas para perguntar, aprender e consultar documentação.
        </p>
        {items.map((it) => (
          <button
            key={it.title}
            type="button"
            disabled={it.disabled}
            onClick={it.onClick}
            className="focus-ring flex items-center gap-3 rounded-xl border bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.09] disabled:opacity-50 tap:min-h-11"
            style={{ borderColor: `${HOLO}44` }}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ color: HOLO, background: `${HOLO}1f` }}>
              <Icon name={it.icon} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-bold text-snow">{it.title}</span>
              <span className="block text-xs text-fog">{it.text}</span>
            </span>
          </button>
        ))}
      </div>
    </ObjectScreen>
  );
}
