import { useState } from 'react';
import type { IconName } from '../../theme';
import { Icon } from '../kit/Icon';
import { HOLO, ObjectScreen } from './ObjectScreen';

const COMMAND = 'npm run ingest -- --config forge.config.json --out public/snapshot.json';
const ORANGE = '#FF8C32';

interface FlowStep {
  icon: IconName;
  title: string;
  detail: string;
  optional?: boolean;
  accent?: string;
}

const FLOW: FlowStep[] = [
  { icon: 'clock', title: 'Cron', detail: 'todo dia às 06:00', accent: ORANGE },
  { icon: 'gear', title: 'Execute Command', detail: 'npm run ingest (Git, Jira, planilha)', accent: ORANGE },
  { icon: 'external', title: 'Publicar snapshot', detail: 'copia public/snapshot.json para o destino', optional: true },
  { icon: 'bell', title: 'Notificar', detail: 'avisa o canal do time (sucesso ou falha)', optional: true },
];

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };
  return (
    <div className="flex items-start gap-2 rounded-xl border bg-ink-950/70 p-3" style={{ borderColor: `${HOLO}44` }}>
      <code className="min-w-0 flex-1 font-mono text-xs break-all text-[#BFEFFF]">{COMMAND}</code>
      <button
        type="button"
        onClick={copy}
        className="focus-ring shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-snow transition hover:bg-white/[0.12] tap:min-h-11"
      >
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <span role="status" className="sr-only">{copied ? 'Comando copiado' : ''}</span>
    </div>
  );
}

/** Explains the n8n workflow that could produce the daily snapshot. Documentation only: nothing runs from the Forge. */
export function AutomationScreen() {
  return (
    <ObjectScreen icon="gear" title="Automações (n8n)" subtitle="Como o snapshot diário pode ser gerado">
      <div className="mx-auto grid max-w-3xl gap-4 p-4 md:p-6">
        <p className="text-sm text-fog">
          O Forge lê um <strong className="text-snow">snapshot diário</strong> (um arquivo JSON). Para produzi-lo sem trabalho manual, sugerimos um fluxo no n8n que roda a
          ingestão toda manhã e deixa o arquivo pronto para o Forge.
        </p>

        <ol className="grid gap-2 md:grid-cols-4" aria-label="Fluxo sugerido no n8n">
          {FLOW.map((step, i) => (
            <li
              key={step.title}
              className="relative flex flex-col gap-1 rounded-2xl border bg-white/[0.04] p-3"
              style={{ borderColor: `${step.accent ?? HOLO}66`, borderStyle: step.optional ? 'dashed' : 'solid' }}
            >
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ color: step.accent ?? HOLO, background: `${step.accent ?? HOLO}1f` }}>
                  <Icon name={step.icon} size={16} />
                </span>
                <span className="font-mono text-[10px] text-fog">{i + 1}</span>
              </span>
              <span className="font-display text-sm font-bold text-snow">{step.title}</span>
              <span className="text-xs text-fog">{step.detail}</span>
              {step.optional && <span className="text-[10px] font-semibold tracking-wide text-fog uppercase">opcional</span>}
            </li>
          ))}
        </ol>

        <section className="grid gap-2">
          <h3 className="font-display text-sm font-bold text-snow">Comando do nó “Execute Command”</h3>
          <CopyBlock text={COMMAND} />
        </section>

        <section className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-fog">
          <p>
            <Icon name="alert" size={12} className="mr-1 inline text-warn" />
            <strong className="text-snow">Integração futura — nada é executado a partir do Forge.</strong> Esta tela só documenta o fluxo; o navegador nunca dispara a ingestão.
          </p>
          <p>
            <Icon name="eye" size={12} className="mr-1 inline" />
            Segredos (<code className="font-mono text-snow">JIRA_*</code>, <code className="font-mono text-snow">CONFLUENCE_*</code>) ficam nas credenciais do n8n, nunca no
            navegador nem no snapshot.
          </p>
          <p>
            <Icon name="book" size={12} className="mr-1 inline" />
            Detalhes de configuração e conectores: <code className="font-mono text-snow">docs/INGESTION.md</code>.
          </p>
        </section>
      </div>
    </ObjectScreen>
  );
}
