import { describe, expect, it } from 'vitest';
import { BLOCK_SPECS, filterSpecs } from './blocks.ts';

describe('filterSpecs', () => {
  it('offers every block type when the query is empty', () => {
    expect(filterSpecs('')).toHaveLength(11);
    expect(filterSpecs('  ')).toEqual(BLOCK_SPECS);
  });

  it('matches on the label', () => {
    expect(filterSpecs('quo').map((s) => s.type)).toEqual(['quote']);
    expect(filterSpecs('head').map((s) => s.type)).toEqual(['heading1', 'heading2', 'heading3']);
  });

  it('matches on keywords', () => {
    expect(filterSpecs('checkbox').map((s) => s.type)).toEqual(['todo']);
    expect(filterSpecs('hr').map((s) => s.type)).toEqual(['divider']);
  });

  it('ignores case', () => {
    expect(filterSpecs('CALLOUT').map((s) => s.type)).toEqual(['callout']);
  });

  it('ranks label prefixes above keyword-only matches', () => {
    expect(filterSpecs('list').map((s) => s.type)).toEqual(['bulleted', 'numbered']);
    expect(filterSpecs('code').map((s) => s.type)).toEqual(['code']);
    // "Text" wins over blocks that merely mention text in a keyword.
    expect(filterSpecs('text')[0].type).toBe('paragraph');
  });

  it('returns nothing for a query that matches no block', () => {
    expect(filterSpecs('zzz')).toEqual([]);
  });
});
