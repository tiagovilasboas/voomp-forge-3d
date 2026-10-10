import { describe, expect, it } from 'vitest';
import { extractWorkItems } from './workItems';

describe('extractWorkItems', () => {
  it('extracts unique keys from title and branch', () => {
    expect(extractWorkItems(['PAY-12 fix (see ABC-3)', 'feat/PAY-12-retry'])).toEqual([
      { key: 'PAY-12', url: null },
      { key: 'ABC-3', url: null },
    ]);
  });
  it('builds urls from a template', () => {
    expect(extractWorkItems(['PAY-1'], { urlTemplate: 'https://t/browse/{key}' })).toEqual([{ key: 'PAY-1', url: 'https://t/browse/PAY-1' }]);
  });
  it('supports a custom pattern and ignores empty input', () => {
    expect(extractWorkItems(['fixes #42', undefined], { pattern: '#\\d+' })).toEqual([{ key: '#42', url: null }]);
    expect(extractWorkItems(['nothing here'])).toEqual([]);
  });
});
