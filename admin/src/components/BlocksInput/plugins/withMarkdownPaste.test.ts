import { createEditor, type BaseEditor, type Descendant } from 'slate';
import { describe, expect, it } from 'vitest';

import type { CustomElement } from '../utils/types';
import { withMarkdownPaste } from './withMarkdownPaste';

type TestEditor = BaseEditor & {
  insertData: (data: DataTransfer) => void;
  children: Descendant[];
};

/**
 * Slate's `Descendant` is not augmented with the plugin's node types, so the
 * source casts everywhere it builds nodes; fixtures do the same.
 */
const node = (value: Record<string, unknown>): CustomElement =>
  value as unknown as CustomElement;

const paragraph = (text: string): CustomElement =>
  node({ type: 'paragraph', children: [{ type: 'text', text }] });

const cursor = (path: number[], offset: number) => ({
  anchor: { path, offset },
  focus: { path, offset },
});

const clipboard = (text: string, html = '') =>
  ({
    getData: (type: string) => (type === 'text/plain' ? text : html),
  }) as unknown as DataTransfer;

/**
 * Builds an editor whose base `insertData` only records that it ran, so a test
 * can tell "the Markdown path handled this" from "it fell through to the
 * editor's normal paste".
 */
const setup = (children: CustomElement[] = [paragraph('')]) => {
  let fellThrough = false;

  const editor = withMarkdownPaste(
    Object.assign(createEditor(), {
      insertData: () => {
        fellThrough = true;
      },
    })
  ) as TestEditor;

  // Mirror the inline/void rules the real plugin pipeline installs.
  editor.isInline = (element) => {
    const node = element as unknown as { type: string; format?: string };

    return (
      node.type === 'link' || (node.type === 'math' && node.format === 'inline')
    );
  };
  editor.isVoid = (element) => {
    const node = element as unknown as { type: string };

    return node.type === 'math' || node.type === 'horizontal-line';
  };

  editor.children = JSON.parse(JSON.stringify(children));
  editor.selection = cursor([0, 0], 0);

  return {
    editor,
    paste: (text: string, html = '') => {
      editor.insertData(clipboard(text, html));

      return { fellThrough, children: editor.children as CustomElement[] };
    },
  };
};

const pasteInto = (
  children: CustomElement[],
  selection: ReturnType<typeof cursor>,
  text: string
) => {
  const { editor } = setup(children);
  editor.selection = selection;
  editor.insertData(clipboard(text));

  return editor.children as CustomElement[];
};

describe('withMarkdownPaste', () => {
  describe('routing', () => {
    it.each([
      ['plain prose', 'Just a normal sentence about things.'],
      ['a snake_case identifier', 'some_var_name here'],
      ['a standalone url', 'https://example.com'],
      ['prices', 'It costs $20 or maybe $30.'],
      ['empty text', ''],
    ])('leaves %s to the default paste', (_label, text) => {
      expect(setup().paste(text).fellThrough).toBe(true);
    });

    it.each([
      ['a heading', '## Title'],
      ['a bullet list', '- a\n- b'],
      ['a task list', '- [x] a'],
      ['a code fence', '```js\nx\n```'],
      ['a blockquote', '> quoted'],
      ['a table with three-dash rules', '| A | B |\n|---|---|\n| 1 | 2 |'],
      // GFM allows a single dash per delimiter cell.
      ['a table with one-dash rules', '| A | B |\n|-|-|\n| 1 | 2 |'],
      ['a table with padded rules', '| A | B |\n| :- | -: |\n| 1 | 2 |'],
    ])('parses %s as Markdown', (_label, text) => {
      expect(setup().paste(text).fellThrough).toBe(false);
    });

    it('requires a structural signal when the clipboard also carries HTML', () => {
      // Emphasis alone is too weak to justify discarding the HTML flavour.
      expect(
        setup().paste(
          'this is *very* important',
          '<p>this is <em>very</em></p>'
        ).fellThrough
      ).toBe(true);

      expect(
        setup().paste('- alpha\n- beta', '<ul><li>alpha</li></ul>').fellThrough
      ).toBe(false);
    });

    it('falls through inside a code block so Markdown stays literal', () => {
      const { editor, paste } = setup([
        node({
          type: 'code',
          language: 'javascript',
          children: [{ type: 'text', text: 'x' }],
        }),
      ]);
      editor.selection = cursor([0, 0], 1);

      expect(paste('## Heading').fellThrough).toBe(true);
    });

    it('falls through inside a table cell', () => {
      const { editor, paste } = setup([
        node({
          type: 'table',
          children: [
            {
              type: 'table-row',
              children: [
                { type: 'table-cell', children: [{ type: 'text', text: 'c' }] },
              ],
            },
          ],
        }),
      ]);
      editor.selection = cursor([0, 0, 0, 0], 1);

      expect(paste('## Heading').fellThrough).toBe(true);
    });
  });

  describe('insertion', () => {
    it('replaces an empty block without leaving it behind', () => {
      const result = pasteInto(
        [paragraph('')],
        cursor([0, 0], 0),
        '## Hello\n\npara'
      );

      expect(result.map((node) => node.type)).toEqual(['heading', 'paragraph']);
    });

    // insertFragment would merge the heading into the paragraph under the
    // cursor, silently turning it into body text.
    it('keeps the leading block type when pasting at the end of a paragraph', () => {
      const result = pasteInto(
        [paragraph('intro')],
        cursor([0, 0], 5),
        '## Hello\n\npara'
      );

      expect(result.map((node) => node.type)).toEqual([
        'paragraph',
        'heading',
        'paragraph',
      ]);
      expect((result[0].children as { text: string }[])[0].text).toBe('intro');
    });

    it('splits the block when pasting mid-paragraph', () => {
      const result = pasteInto(
        [paragraph('abcdef')],
        cursor([0, 0], 3),
        '## Hello\n\npara'
      );

      expect(result.map((node) => node.type)).toEqual([
        'paragraph',
        'heading',
        'paragraph',
        'paragraph',
      ]);
    });

    it('flows a single pasted paragraph inline', () => {
      const result = pasteInto(
        [paragraph('abcdef')],
        cursor([0, 0], 3),
        'some **bold** text'
      );

      expect(result).toHaveLength(1);
      expect(JSON.stringify(result)).toContain('"bold":true');
    });

    it('replaces an expanded selection', () => {
      const { editor } = setup([paragraph('abcdef')]);
      editor.selection = {
        anchor: { path: [0, 0], offset: 1 },
        focus: { path: [0, 0], offset: 5 },
      };
      editor.insertData(clipboard('## Hi'));

      expect(JSON.stringify(editor.children)).not.toContain('bcde');
    });
  });
});
