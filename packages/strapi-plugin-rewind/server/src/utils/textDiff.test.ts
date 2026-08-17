import { describe, expect, it } from 'vitest';

import {
  collapseEqualSpans,
  diffWords,
  extractText,
  normaliseText,
  MAX_DIFF_TOKENS,
} from './textDiff';

/** Rebuilds each side from the spans, which is the property that must hold. */
const rebuild = (spans: ReturnType<typeof diffWords>) => ({
  before: spans
    .filter((s) => s.op !== 'added')
    .map((s) => s.value)
    .join(''),
  after: spans
    .filter((s) => s.op !== 'removed')
    .map((s) => s.value)
    .join(''),
});

describe('diffWords', () => {
  it('marks only the words that changed', () => {
    const spans = diffWords('the quick brown fox', 'the quick red fox');

    expect(spans.filter((s) => s.op === 'removed').map((s) => s.value.trim())).toEqual(['brown']);
    expect(spans.filter((s) => s.op === 'added').map((s) => s.value.trim())).toEqual(['red']);
  });

  it('reproduces both inputs from its spans', () => {
    const before = 'Pricing starts at ten euros per seat per month.';
    const after = 'Pricing now starts at twelve euros per seat.';

    expect(rebuild(diffWords(before, after))).toEqual({ before, after });
  });

  it('reports a pure insertion as additions only', () => {
    const spans = diffWords('one two', 'one and a half two');

    expect(spans.some((s) => s.op === 'removed')).toBe(false);
    expect(spans.filter((s) => s.op === 'added').map((s) => s.value.trim())).toEqual([
      'and a half',
    ]);
  });

  it('returns everything as equal when nothing changed', () => {
    const spans = diffWords('identical text here', 'identical text here');
    expect(spans.every((s) => s.op === 'equal')).toBe(true);
  });

  it('handles one side being empty', () => {
    expect(diffWords('', 'brand new').every((s) => s.op === 'added')).toBe(true);
    expect(diffWords('all gone', '').every((s) => s.op === 'removed')).toBe(true);
  });

  it('gives up rather than building a huge table', () => {
    // The LCS table is quadratic; past the cap the honest answer is
    // "replaced", not a diff that costs more than it is worth.
    const long = Array.from({ length: MAX_DIFF_TOKENS + 10 }, (_, i) => `w${i}`).join(' ');
    const spans = diffWords(long, `${long} extra`);

    expect(spans.map((s) => s.op)).toEqual(['removed', 'added']);
  });
});

describe('extractText', () => {
  it('pulls prose out of a nested rich-text structure', () => {
    const blocks = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world', bold: true },
        ],
      },
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'A heading' }] },
    ];

    expect(normaliseText(extractText(blocks))).toBe('Hello world A heading');
  });

  it('skips the keys that describe structure rather than content', () => {
    // Otherwise every block would contribute its own type name to the diff.
    const value = { id: 42, __component: 'blocks.quote', type: 'quote', text: 'Real words' };
    expect(normaliseText(extractText(value))).toBe('Real words');
  });

  it('survives cycles-by-depth and empty values', () => {
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
    expect(extractText([])).toBe('');

    let deep: any = { text: 'bottom' };
    for (let i = 0; i < 20; i += 1) deep = { child: deep };
    expect(() => extractText(deep)).not.toThrow();
  });

  it('includes numbers but not booleans', () => {
    // A boolean in this structure is a mark, not something an editor wrote.
    expect(normaliseText(extractText({ count: 3, live: true }))).toBe('3');
  });

  it('ignores a heading level and a block type', () => {
    const heading = { type: 'heading', level: 3, children: [{ text: 'Pricing' }] };
    expect(normaliseText(extractText(heading))).toBe('Pricing');
  });
});

describe('normaliseText', () => {
  it('collapses whitespace so reflowing is not reported as an edit', () => {
    expect(normaliseText('a   b\n\nc  ')).toBe('a b c');
  });
});

describe('collapseEqualSpans', () => {
  const words = (n: number, prefix = 'w') =>
    Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');

  it('elides a long unchanged stretch between two changes', () => {
    const spans = collapseEqualSpans([
      { op: 'added', value: 'start ' },
      { op: 'equal', value: `${words(60)} ` },
      { op: 'removed', value: 'end' },
    ]);

    const elided = spans.filter((s) => s.value.includes('…'));
    expect(elided).toHaveLength(1);
    // Six words of context either side, not sixty.
    expect(spans.map((s) => s.value).join('')).not.toContain('w30');
    expect(spans.map((s) => s.value).join('')).toContain('w0');
    expect(spans.map((s) => s.value).join('')).toContain('w59');
  });

  it('leaves a short unchanged run alone', () => {
    const spans = collapseEqualSpans([
      { op: 'added', value: 'a ' },
      { op: 'equal', value: 'one two three ' },
      { op: 'removed', value: 'b' },
    ]);

    expect(spans.map((s) => s.value).join('')).toContain('one two three');
    expect(spans.some((s) => s.value.includes('…'))).toBe(false);
  });

  it('does not keep leading context before the first change', () => {
    const spans = collapseEqualSpans([
      { op: 'equal', value: `${words(40)} ` },
      { op: 'added', value: 'new' },
    ]);

    // The start of an untouched document is not context for anything.
    expect(spans[0].value).toBe(' … ');
  });

  it('keeps every changed span', () => {
    const spans = collapseEqualSpans([
      { op: 'equal', value: `${words(40)} ` },
      { op: 'added', value: 'X ' },
      { op: 'equal', value: `${words(40, 'v')} ` },
      { op: 'removed', value: 'Y' },
    ]);

    expect(spans.filter((s) => s.op === 'added')).toHaveLength(1);
    expect(spans.filter((s) => s.op === 'removed')).toHaveLength(1);
  });
});
