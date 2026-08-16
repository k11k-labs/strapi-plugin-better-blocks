import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEditor } from 'slate';

import {
  blockLabelDescriptor,
  clearRegisteredBlocks,
  getRegisteredBlocks,
  isOfferedInMenus,
  registerBlock,
  withRegisteredBlocks,
} from './blockRegistry';
import type { EditorBlockDefinition } from './blockRegistry';

// The registry is module state by design — the admin registers once at boot —
// so each test starts from empty.
beforeEach(() => {
  clearRegisteredBlocks();
});

const renderElement = (() =>
  null) as unknown as EditorBlockDefinition['renderElement'];

const chart = (
  overrides: Partial<EditorBlockDefinition> = {}
): EditorBlockDefinition => ({
  type: 'chart',
  renderElement,
  ...overrides,
});

describe('registerBlock', () => {
  it('keeps registrations in order', () => {
    registerBlock(chart());
    registerBlock({ type: 'timeline', renderElement });

    expect(getRegisteredBlocks().map((b) => b.type)).toEqual([
      'chart',
      'timeline',
    ]);
  });

  it('refuses to shadow a built-in type', () => {
    expect(() => registerBlock(chart({ type: 'paragraph' }))).toThrow(
      /built-in/
    );
    expect(getRegisteredBlocks()).toEqual([]);
  });

  it('refuses the same type twice', () => {
    registerBlock(chart());
    expect(() => registerBlock(chart())).toThrow(/registered twice/);
  });

  it('refuses a definition without a usable type', () => {
    expect(() => registerBlock(chart({ type: '' }))).toThrow(/non-empty/);
  });
});

describe('isOfferedInMenus', () => {
  const icon = (() => null) as unknown as EditorBlockDefinition['icon'];

  it('needs an icon, a label and an insert', () => {
    expect(
      isOfferedInMenus(chart({ icon, label: 'Chart', insert: () => {} }))
    ).toBe(true);
    expect(isOfferedInMenus(chart({ label: 'Chart', insert: () => {} }))).toBe(
      false
    );
    expect(isOfferedInMenus(chart({ icon, insert: () => {} }))).toBe(false);
    expect(isOfferedInMenus(chart({ icon, label: 'Chart' }))).toBe(false);
  });
});

describe('blockLabelDescriptor', () => {
  it('turns a plain string into a descriptor under a generated id', () => {
    expect(blockLabelDescriptor(chart({ label: 'Chart' }))).toEqual({
      id: 'components.Blocks.blocks.chart',
      defaultMessage: 'Chart',
    });
  });

  it('passes a descriptor through untouched', () => {
    const label = { id: 'chartkit.block.chart', defaultMessage: 'Chart' };
    expect(blockLabelDescriptor(chart({ label }))).toBe(label);
  });

  it('falls back to the type when there is no label', () => {
    expect(blockLabelDescriptor(chart()).defaultMessage).toBe('chart');
  });
});

describe('withRegisteredBlocks', () => {
  it('makes a block with the default content model void', () => {
    registerBlock(chart());
    const editor = withRegisteredBlocks(createEditor());

    expect(editor.isVoid({ type: 'chart', children: [] } as never)).toBe(true);
  });

  it('leaves an "inline" or "blocks" block editable', () => {
    registerBlock(chart({ content: 'blocks' }));
    registerBlock({ type: 'banner', content: 'inline', renderElement });
    const editor = withRegisteredBlocks(createEditor());

    expect(editor.isVoid({ type: 'chart', children: [] } as never)).toBe(false);
    expect(editor.isVoid({ type: 'banner', children: [] } as never)).toBe(
      false
    );
  });

  it('does not disturb the built-in void handling it wraps', () => {
    registerBlock(chart());
    const base = createEditor();
    base.isVoid = (element) =>
      (element as { type?: string }).type === 'diagram';

    const editor = withRegisteredBlocks(base);

    expect(editor.isVoid({ type: 'diagram', children: [] } as never)).toBe(
      true
    );
    expect(editor.isVoid({ type: 'paragraph', children: [] } as never)).toBe(
      false
    );
  });

  it("applies a block's own Slate plugin", () => {
    const withEditor = vi.fn((editor) => editor);
    registerBlock(chart({ withEditor }));

    withRegisteredBlocks(createEditor());

    expect(withEditor).toHaveBeenCalledTimes(1);
  });
});
