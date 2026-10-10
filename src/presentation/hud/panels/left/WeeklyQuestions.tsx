import { useMemo } from 'react';
import { listDeliveries, type DeliveryFilter } from '@application/queries/deliveries';
import { useReadyData } from '@presentation/state/dataStore';
import { useScope } from '@presentation/state/selectors';
import { Card, CardHeader } from '@presentation/hud/kit/primitives';
import { useExplorerFilters, type ExplorerPrefilter } from '../../views/DeliveryExplorer';
import { ListRow } from './ListRow';

interface Question {
  text: string;
  count: number;
  hint?: string;
  prefilter: ExplorerPrefilter;
}

function useQuestions(): Question[] {
  const { index } = useReadyData();
  const scope = useScope();
  return useMemo(() => {
    const count = (f: DeliveryFilter) => listDeliveries(index, scope, f).length;
    const staging = count({ status: 'staging' });
    const awaiting = count({ status: 'awaiting_production' });
    return [
      { text: 'O que chegou em produção?', count: count({ status: 'production' }), prefilter: { status: 'production' } },
      {
        text: 'O que ainda não chegou à produção?',
        count: awaiting,
        hint: `${staging} em staging · ${awaiting - staging} só integradas`,
        prefilter: { status: 'awaiting_production' },
      },
      { text: 'O que aguarda revisão?', count: count({ status: 'review' }), prefilter: { status: 'review' } },
      { text: 'Há bloqueios técnicos?', count: count({ status: 'blocked' }), prefilter: { status: 'blocked' } },
      {
        text: 'Mudanças sem iniciativa identificada',
        count: count({ initiativeId: 'none' }),
        prefilter: { initiativeId: 'none' },
      },
    ];
  }, [index, scope]);
}

/** Product View: business questions answered by the Delivery Explorer. */
export function WeeklyQuestions() {
  const questions = useQuestions();
  return (
    <Card label="Perguntas da semana">
      <CardHeader title="Perguntas da semana" />
      <ul className="pb-2">
        {questions.map((q) => (
          <li key={q.text}>
            <ListRow onClick={() => useExplorerFilters.getState().open(q.prefilter)} label={`${q.text} ${q.count}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] leading-snug text-snow">{q.text}</span>
                <span className="font-display text-base font-semibold text-forge-bright">{q.count}</span>
              </div>
              {q.hint && <div className="text-[11px] text-fog">{q.hint}</div>}
            </ListRow>
          </li>
        ))}
      </ul>
    </Card>
  );
}
