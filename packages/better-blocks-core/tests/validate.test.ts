import { describe, it, expect } from 'vitest';

import { validateDocument, isBlocksContent } from '../src';
import type { BlocksContent } from '../src';

const paragraph = (text: string) => ({
  type: 'paragraph' as const,
  children: [{ type: 'text' as const, text }],
});

describe('validateDocument', () => {
  it('accepts an empty document', () => {
    expect(validateDocument([])).toEqual({ valid: true, issues: [] });
  });

  it('accepts a document made of the documented blocks', () => {
    const content: BlocksContent = [
      paragraph('hello'),
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Title' }] },
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'one' }] }],
      },
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'cell' }] }],
          },
        ],
      },
      { type: 'horizontal-line', children: [{ type: 'text', text: '' }] },
    ];
    expect(validateDocument(content).valid).toBe(true);
  });

  it('rejects anything that is not an array of blocks', () => {
    for (const bad of [null, undefined, {}, 'text', 42]) {
      const result = validateDocument(bad);
      expect(result.valid).toBe(false);
      expect(result.issues[0].message).toMatch(/must be an array/);
    }
  });

  it('reports an unknown block type, with its position', () => {
    const result = validateDocument([paragraph('ok'), { type: 'wat', children: [] }]);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: '[1].type', message: 'unknown block type "wat"' }]);
  });

  it('reports a text node whose text is not a string', () => {
    const result = validateDocument([
      { type: 'paragraph', children: [{ type: 'text', text: 42 }] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toBe('[0].children[0].text');
  });

  it('reports a missing children array', () => {
    const result = validateDocument([{ type: 'paragraph' }]);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toEqual({
      path: '[0].children',
      message: 'expected a children array',
    });
  });

  it('reports an out-of-range heading level', () => {
    for (const level of [0, 7, 2.5, '2']) {
      const result = validateDocument([{ type: 'heading', level, children: [] }]);
      expect(result.valid).toBe(false);
      expect(result.issues[0].path).toBe('[0].level');
    }
    expect(validateDocument([{ type: 'heading', level: 6, children: [] }]).valid).toBe(true);
  });

  it('accepts every list format the editor writes, and rejects others', () => {
    for (const format of ['ordered', 'unordered', 'todo']) {
      expect(validateDocument([{ type: 'list', format, children: [] }]).valid).toBe(true);
    }
    const result = validateDocument([{ type: 'list', format: 'bullets', children: [] }]);
    expect(result.valid).toBe(false);
    expect(result.issues[0].path).toBe('[0].format');
  });

  it('accepts nested lists', () => {
    const content = [
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'a' }] },
          {
            type: 'list',
            format: 'ordered',
            children: [{ type: 'list-item', children: [{ type: 'text', text: 'b' }] }],
          },
        ],
      },
    ];
    expect(validateDocument(content).valid).toBe(true);
  });

  it('rejects a stray node inside a list', () => {
    const result = validateDocument([
      { type: 'list', format: 'ordered', children: [paragraph('nope')] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toMatch(/list children must be list-item or list/);
  });

  it('enforces the table row and cell nesting', () => {
    const wrongRow = validateDocument([{ type: 'table', children: [paragraph('x')] }]);
    expect(wrongRow.issues[0].message).toMatch(/table children must be table-row/);

    const wrongCell = validateDocument([
      { type: 'table', children: [{ type: 'table-row', children: [paragraph('x')] }] },
    ]);
    expect(wrongCell.issues[0].message).toMatch(/table-cell or table-header-cell/);

    const headerCells = validateDocument([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-header-cell', children: [{ type: 'text', text: 'h' }] }],
          },
        ],
      },
    ]);
    expect(headerCells.valid).toBe(true);
  });

  it('checks link urls and children', () => {
    const noUrl = validateDocument([
      { type: 'paragraph', children: [{ type: 'link', children: [] }] },
    ]);
    expect(noUrl.issues[0].path).toBe('[0].children[0].url');

    const badChild = validateDocument([
      {
        type: 'paragraph',
        children: [{ type: 'link', url: '/x', children: [paragraph('nested block')] }],
      },
    ]);
    expect(badChild.issues[0].message).toMatch(/link children must be text nodes/);
  });

  it('still accepts the deprecated media-embed block', () => {
    const content = [
      { type: 'media-embed', url: 'https://example.com/e', children: [{ type: 'text', text: '' }] },
    ];
    expect(validateDocument(content).valid).toBe(true);
  });

  it('leaves unknown optional attributes alone', () => {
    // Forward compatibility: a newer plugin adding an attribute must not make
    // a document invalid for an older renderer.
    const content = [{ ...paragraph('x'), someFutureAttribute: 'value' }];
    expect(validateDocument(content).valid).toBe(true);
  });

  it('collects every issue rather than stopping at the first', () => {
    const result = validateDocument([{ type: 'wat' }, { type: 'heading', level: 9, children: [] }]);
    expect(result.issues).toHaveLength(2);
  });
});

describe('isBlocksContent', () => {
  it('narrows a valid document', () => {
    const value: unknown = [paragraph('hi')];
    expect(isBlocksContent(value)).toBe(true);
  });

  it('rejects an invalid one', () => {
    expect(isBlocksContent({ nope: true })).toBe(false);
  });
});
