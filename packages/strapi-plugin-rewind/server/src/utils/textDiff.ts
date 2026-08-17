/**
 * A word-level diff, and the text extraction that makes it useful.
 *
 * The alternative — reporting "content changed" — is true and worthless. The
 * field an editor cares most about is usually rich text stored as JSON, so the
 * readable part is pulled out and compared as prose. That is renderer-agnostic:
 * it walks the structure collecting anything that reads as text, without
 * knowing what a block is.
 */

export type DiffOp = 'equal' | 'added' | 'removed';

export interface DiffSpan {
  op: DiffOp;
  value: string;
}

/** Words plus their trailing whitespace, so re-joining spans restores the text. */
const tokenize = (text: string): string[] => text.match(/\S+\s*/g) ?? [];

/**
 * Above this, a full LCS table costs more memory and time than the answer is
 * worth. The caller falls back to reporting that the field changed.
 */
export const MAX_DIFF_TOKENS = 2500;

/**
 * Longest common subsequence over words.
 *
 * Word-level rather than character-level because the output is read by a person
 * deciding whether an edit was significant, and a character diff of prose is
 * noise.
 */
export const diffWords = (before: string, after: string): DiffSpan[] => {
  const a = tokenize(before);
  const b = tokenize(after);

  if (a.length > MAX_DIFF_TOKENS || b.length > MAX_DIFF_TOKENS) {
    return [
      { op: 'removed', value: before },
      { op: 'added', value: after },
    ];
  }

  // lengths[i][j] = LCS length of a[i:] and b[j:]
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const spans: DiffSpan[] = [];
  const push = (op: DiffOp, value: string) => {
    const last = spans[spans.length - 1];
    if (last && last.op === op) last.value += value;
    else spans.push({ op, value });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('equal', a[i]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      push('removed', a[i]);
      i += 1;
    } else {
      push('added', b[j]);
      j += 1;
    }
  }
  while (i < a.length) push('removed', a[i++]);
  while (j < b.length) push('added', b[j++]);

  return spans;
};

/**
 * Keys that describe how content is arranged rather than what it says. Left in,
 * a heading's `level` and a block's `type` would appear as words in the diff.
 */
const STRUCTURAL_KEYS = new Set([
  'id',
  '__component',
  'type',
  'format',
  'level',
  'language',
  'url',
]);

/**
 * Pulls the human-readable text out of an arbitrary value.
 *
 * Rich text, components and dynamic zones are all nested objects and arrays
 * whose shape this plugin deliberately does not model — a `text` key here, a
 * `children` array there. Collecting every string reached is imprecise but
 * stable across editors, and it is what turns "content changed" into a sentence
 * an editor recognises.
 */
export const extractText = (value: unknown, depth = 0): string => {
  if (depth > 12) return '';
  if (value == null) return '';
  if (typeof value === 'string') return value;
  // Booleans are marks — `bold: true` on a text node — never prose. Rendering
  // them would put the word "true" into the diff every time someone bolds
  // something.
  if (typeof value === 'boolean') return '';
  if (typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    return value
      .map((entry) => extractText(entry, depth + 1))
      .filter(Boolean)
      .join(' ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !STRUCTURAL_KEYS.has(key))
      .map(([, entry]) => extractText(entry, depth + 1))
      .filter(Boolean)
      .join(' ');
  }

  return '';
};

/** Collapses runs of whitespace so formatting-only edits do not read as changes. */
export const normaliseText = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Words of unchanged text kept either side of a change, for context. */
export const CONTEXT_WORDS = 6;

/**
 * Drops the long stretches of unchanged text between changes.
 *
 * A one-word edit in a long article otherwise renders as the whole article with
 * a single green word somewhere inside it, and the reader has to hunt for the
 * thing the view exists to show. Unchanged runs are trimmed to a few words of
 * context and marked with an ellipsis.
 */
export const collapseEqualSpans = (spans: DiffSpan[], contextWords = CONTEXT_WORDS): DiffSpan[] => {
  const result: DiffSpan[] = [];

  spans.forEach((span, index) => {
    if (span.op !== 'equal') {
      result.push(span);
      return;
    }

    const words = span.value.match(/\S+\s*/g) ?? [];
    // Nothing to gain by eliding a run barely longer than the context itself.
    if (words.length <= contextWords * 2 + 1) {
      result.push(span);
      return;
    }

    const atStart = index === 0;
    const atEnd = index === spans.length - 1;

    // Leading and trailing runs only need context on the side facing a change.
    const head = atStart ? [] : words.slice(0, contextWords);
    const tail = atEnd ? [] : words.slice(-contextWords);

    if (head.length) result.push({ op: 'equal', value: head.join('') });
    result.push({ op: 'equal', value: ' … ' });
    if (tail.length) result.push({ op: 'equal', value: tail.join('') });
  });

  return result;
};
