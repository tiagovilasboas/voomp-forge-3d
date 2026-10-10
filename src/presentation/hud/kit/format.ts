const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "há 3 dias" relative to the snapshot's own clock (not the browser's). */
export function relativeTime(iso: string | null | undefined, now: Date): string {
  if (!iso) return '—';
  const diffMin = (Date.parse(iso) - now.getTime()) / 60_000;
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(Math.round(diffMin), 'minute');
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), 'hour');
  return rtf.format(Math.round(diffMin / 1440), 'day');
}

export function dateTime(iso: string | null | undefined): string {
  return iso ? dtf.format(new Date(iso)) : '—';
}

export const shortSha = (sha: string) => sha.slice(0, 7);
