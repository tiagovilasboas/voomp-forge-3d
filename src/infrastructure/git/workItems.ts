import type { WorkItemRef } from '@domain/entities';

export const DEFAULT_WORK_ITEM_PATTERN = '[A-Z][A-Z0-9]+-\\d+';

export interface WorkItemOptions {
  /** Regex source. Defaults to Jira-style keys (ABC-123). */
  pattern?: string;
  /** e.g. "https://tracker/browse/{key}". Without it, url is null. */
  urlTemplate?: string;
}

/** Extracts unique task keys (in order of appearance) from the given texts. Never guesses. */
export function extractWorkItems(texts: Array<string | undefined>, options: WorkItemOptions = {}): WorkItemRef[] {
  const re = new RegExp(options.pattern ?? DEFAULT_WORK_ITEM_PATTERN, 'g');
  const seen = new Set<string>();
  const out: WorkItemRef[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const m of text.matchAll(re)) {
      const key = m[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, url: options.urlTemplate ? options.urlTemplate.replaceAll('{key}', key) : null });
    }
  }
  return out;
}
