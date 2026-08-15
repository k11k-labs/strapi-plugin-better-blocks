import { describe, expect, it } from 'vitest';

import { parseMarkdownToSlate } from './parseMarkdownToSlate';
import type { CustomElement } from './types';

const parse = (markdown: string): CustomElement[] => {
  const result = parseMarkdownToSlate(markdown);

  if (!result) throw new Error('expected the parser to return nodes');

  return result;
};

/** Concatenated text of a node tree, so assertions can ignore leaf splitting. */
const textOf = (node: unknown): string => {
  if (!node || typeof node !== 'object') return '';

  const record = node as Record<string, unknown>;

  if (typeof record.text === 'string') return record.text;

  return Array.isArray(record.children)
    ? record.children.map(textOf).join('')
    : '';
};

const types = (nodes: CustomElement[]): string[] =>
  nodes.map((node) => node.type);

describe('parseMarkdownToSlate', () => {
  it('returns null for empty input', () => {
    expect(parseMarkdownToSlate('')).toBeNull();
  });

  it('never throws on malformed input', () => {
    for (const input of ['#', '```', '| |', '[', '$$', '- [ ', '<<<>>>']) {
      expect(() => parseMarkdownToSlate(input)).not.toThrow();
    }
  });

  describe('blocks', () => {
    it('maps headings and clamps the level to 1-6', () => {
      expect(parse('# One')[0]).toMatchObject({ type: 'heading', level: 1 });
      expect(parse('###### Six')[0]).toMatchObject({
        type: 'heading',
        level: 6,
      });
    });

    it('maps a thematic break to a horizontal line', () => {
      expect(types(parse('a\n\n---\n\nb'))).toContain('horizontal-line');
    });

    it('keeps a blockquote as one block with its paragraphs separated', () => {
      const [quote] = parse('> line one\n>\n> line two');

      expect(quote.type).toBe('quote');
      expect(textOf(quote)).toBe('line one\nline two');
    });

    it('preserves hard line breaks', () => {
      expect(textOf(parse('# T\n\nline one  \nline two')[1])).toBe(
        'line one\nline two'
      );
    });

    it('keeps raw HTML as readable text rather than dropping it', () => {
      expect(textOf(parse('# T\n\n<div>raw</div>')[1])).toBe('<div>raw</div>');
    });

    it('keeps footnote definitions readable', () => {
      expect(textOf(parse('Text[^1]\n\n[^1]: The note')[1])).toContain(
        'The note'
      );
    });
  });

  describe('inline marks and links', () => {
    it('maps every supported mark', () => {
      const children = parse('**b** _i_ ~~s~~ `c`')[0]
        .children as unknown as Record<string, unknown>[];
      const marks = children.filter((child) => child.text !== ' ');

      expect(marks[0]).toMatchObject({ text: 'b', bold: true });
      expect(marks[1]).toMatchObject({ text: 'i', italic: true });
      expect(marks[2]).toMatchObject({ text: 's', strikethrough: true });
      expect(marks[3]).toMatchObject({ text: 'c', code: true });
    });

    it('turns a bare email autolink into a mailto link', () => {
      const [link] = parse('# T\n\n<hi@example.com>')[1]
        .children as CustomElement[];

      expect(link).toMatchObject({
        type: 'link',
        url: 'mailto:hi@example.com',
      });
    });

    it('resolves a reference link to its definition url', () => {
      const nodes = parse('[ref]: https://example.com\n\nSee [ref].');

      expect(JSON.stringify(nodes)).toContain('https://example.com');
    });

    it('resolves definitions declared inside a container', () => {
      const nodes = parse('> [ref]: https://example.com\n>\n> See [ref].');

      expect(JSON.stringify(nodes)).toContain('https://example.com');
    });
  });

  describe('lists', () => {
    it('nests a child list as a sibling of the list items', () => {
      const [list] = parse('- a\n  - b\n- c');

      // The editor's own Tab handler produces `list > [list-item, list, ...]`,
      // not a list nested inside a list-item; pasted content must match.
      expect(types(list.children as CustomElement[])).toEqual([
        'list-item',
        'list',
        'list-item',
      ]);
      expect((list.children as CustomElement[])[1]).toMatchObject({
        indentLevel: 1,
      });
    });

    it('increments indentLevel for each depth', () => {
      const [list] = parse('- a\n  - b\n    - c');
      const nested = (list.children as CustomElement[])[1];
      const deepest = (nested.children as CustomElement[])[1];

      expect(list.indentLevel).toBe(0);
      expect(nested.indentLevel).toBe(1);
      expect(deepest.indentLevel).toBe(2);
    });

    it('marks a task list as todo and carries checked state', () => {
      const [list] = parse('- [x] done\n- [ ] open');

      expect(list.format).toBe('todo');
      expect(list.children).toMatchObject([
        { checked: true },
        { checked: false },
      ]);
    });

    it('does not add checked to a plain list', () => {
      const [list] = parse('- a\n- b');

      expect(list.format).toBe('unordered');
      expect((list.children as CustomElement[])[0].checked).toBeUndefined();
    });

    it('carries the start number of an ordered list', () => {
      expect(parse('3. three\n4. four')[0]).toMatchObject({
        format: 'ordered',
        start: 3,
      });
    });

    it('omits start when the list begins at 1', () => {
      expect(parse('1. one\n2. two')[0].start).toBeUndefined();
    });
  });

  describe('tables', () => {
    it('maps the first row to header cells and keeps alignment', () => {
      const [table] = parse('| A | B |\n|:--|--:|\n| 1 | 2 |');
      const [header, body] = table.children as CustomElement[];

      expect(types(header.children as CustomElement[])).toEqual([
        'table-header-cell',
        'table-header-cell',
      ]);
      expect(types(body.children as CustomElement[])).toEqual([
        'table-cell',
        'table-cell',
      ]);
      expect((header.children as CustomElement[])[0].align).toBe('left');
      expect((header.children as CustomElement[])[1].align).toBe('right');
    });

    it('omits align for columns without a marker', () => {
      const [table] = parse('| A |\n|---|\n| 1 |');
      const header = (table.children as CustomElement[])[0];

      expect((header.children as CustomElement[])[0].align).toBeUndefined();
    });
  });

  describe('code fences', () => {
    it.each([
      ['ts', 'typescript'],
      ['js', 'javascript'],
      ['py', 'python'],
      ['sh', 'shell'],
      ['console', 'shell'],
      ['yml', 'yaml'],
      ['c++', 'cpp'],
      ['TS', 'typescript'],
      ['typescript', 'typescript'],
    ])('normalizes the ```%s alias to %s', (alias, expected) => {
      expect(parse('```' + alias + '\nx\n```')[0].language).toBe(expected);
    });

    it.each([['zig'], ['mermaid'], ['']])(
      'falls back to plaintext for the unsupported language %j',
      (alias) => {
        expect(parse('```' + alias + '\nx\n```')[0].language).toBe('plaintext');
      }
    );

    it('keeps the fence body verbatim', () => {
      expect(parse('```\na\n\nb\n```')[0].children).toEqual([
        { type: 'text', text: 'a\n\nb' },
      ]);
    });
  });

  describe('math', () => {
    it('maps a real inline formula to an inline math node', () => {
      const [, math] = parse('Euler $e^{i\\pi}$ rocks')[0]
        .children as CustomElement[];

      expect(math).toMatchObject({
        type: 'math',
        format: 'inline',
        value: 'e^{i\\pi}',
      });
    });

    it('maps a display formula to a block math node', () => {
      expect(parse('$$\na^2\n$$')[0]).toMatchObject({
        type: 'math',
        format: 'block',
        value: 'a^2',
      });
    });

    // remark-math treats any `$…$` pair as math, which would swallow shell
    // prose into KaTeX. Padded delimiters mean the author did not intend math.
    it('keeps whitespace-padded dollar spans as literal text', () => {
      const source = 'run $HOME/bin and $PATH stuff';
      const nodes = parse(source);

      expect(JSON.stringify(nodes)).not.toContain('"type":"math"');
      expect(nodes.map(textOf).join('')).toBe(source);
    });
  });

  describe('images', () => {
    it('promotes an image alone in its paragraph to an image block', () => {
      expect(parse('![alt text](https://example.com/a.png)')[0]).toMatchObject({
        type: 'image',
        image: {
          url: 'https://example.com/a.png',
          alternativeText: 'alt text',
        },
      });
    });

    it('keeps an image inside a sentence inline so the text stays intact', () => {
      const [node] = parse('see ![x](https://example.com/a.png) here');

      expect(node.type).toBe('paragraph');
      expect(textOf(node)).toBe('see x here');
    });
  });
});
