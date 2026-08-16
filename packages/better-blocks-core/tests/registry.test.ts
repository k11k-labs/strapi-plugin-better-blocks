import { describe, it, expect, vi } from 'vitest';

import {
  createBlockRegistry,
  isBuiltInBlockType,
  migrateDocument,
  toBlockRegistry,
  validateDocument,
} from '../src';
import type { BlockDefinition, CustomBlockNode, ExtendedBlocksContent } from '../src';

const placeholder = [{ type: 'text' as const, text: '' }];

/** A stand-in for what Chartkit will register: a void block with its own spec. */
const chart: BlockDefinition = {
  type: 'chart',
  content: 'void',
  validate: (node, { path, fail }) => {
    const spec = node.spec;
    if (typeof spec !== 'object' || spec === null) {
      fail(`${path}.spec`, 'chart spec must be an object');
    }
  },
};

const chartBlock = (spec: unknown) => ({ type: 'chart', spec, children: placeholder });

describe('createBlockRegistry', () => {
  it('resolves definitions and reports them in registration order', () => {
    const registry = createBlockRegistry([chart, { type: 'timeline' }]);

    expect(registry.types()).toEqual(['chart', 'timeline']);
    expect(registry.has('chart')).toBe(true);
    expect(registry.get('chart')).toBe(chart);
    expect(registry.get('nope')).toBeUndefined();
  });

  it('is empty when nothing is registered', () => {
    expect(createBlockRegistry().types()).toEqual([]);
    expect(toBlockRegistry(undefined).types()).toEqual([]);
  });

  it('refuses to shadow a built-in type', () => {
    expect(() => createBlockRegistry([{ type: 'paragraph' }])).toThrow(/built-in/);
    expect(() => createBlockRegistry([{ type: 'table-cell' }])).toThrow(/built-in/);
  });

  it('refuses the same type twice', () => {
    expect(() => createBlockRegistry([chart, { type: 'chart' }])).toThrow(/registered twice/);
  });

  it('refuses a definition without a usable type', () => {
    expect(() => createBlockRegistry([{ type: '' }])).toThrow(/non-empty/);
  });

  it('knows which types are built in', () => {
    expect(isBuiltInBlockType('paragraph')).toBe(true);
    expect(isBuiltInBlockType('chart')).toBe(false);
  });

  it('passes an already-built registry through untouched', () => {
    const registry = createBlockRegistry([chart]);
    expect(toBlockRegistry(registry)).toBe(registry);
  });
});

describe('validateDocument with registered blocks', () => {
  it('rejects an unregistered type, and accepts the same document once registered', () => {
    const content = [chartBlock({ version: 1 })] as ExtendedBlocksContent;

    const without = validateDocument(content);
    expect(without.valid).toBe(false);
    expect(without.issues).toEqual([{ path: '[0].type', message: 'unknown block type "chart"' }]);

    expect(validateDocument(content, { blocks: [chart] }).valid).toBe(true);
  });

  it("runs the block's own validator and keeps its paths", () => {
    const result = validateDocument([chartBlock('not an object')] as ExtendedBlocksContent, {
      blocks: [chart],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: '[0].spec', message: 'chart spec must be an object' }]);
  });

  it('still requires the void placeholder children Slate needs', () => {
    const result = validateDocument([{ type: 'chart', spec: {} }] as ExtendedBlocksContent, {
      blocks: [chart],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: '[0].children', message: 'expected a children array' }]);
  });

  it('walks a "blocks" content model as nested blocks', () => {
    const panel: BlockDefinition = { type: 'panel', content: 'blocks' };
    const content = [
      {
        type: 'panel',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'inside' }] }],
      },
    ] as ExtendedBlocksContent;

    expect(validateDocument(content, { blocks: [panel] }).valid).toBe(true);

    const bad = [{ type: 'panel', children: [{ type: 'nope', children: [] }] }];
    expect(validateDocument(bad as ExtendedBlocksContent, { blocks: [panel] }).issues).toEqual([
      { path: '[0].children[0].type', message: 'unknown block type "nope"' },
    ]);
  });

  it('accepts a registered block nested inside a callout', () => {
    const content = [
      { type: 'callout', variant: 'info', children: [chartBlock({ version: 1 })] },
    ] as ExtendedBlocksContent;

    expect(validateDocument(content, { blocks: [chart] }).valid).toBe(true);
    expect(validateDocument(content).valid).toBe(false);
  });
});

describe('migrateDocument with registered blocks', () => {
  const bumping: BlockDefinition = {
    type: 'chart',
    migrate: (node) => {
      const spec = node.spec as { version?: number } | undefined;
      if (spec?.version === 1) {
        return { status: 'migrated', node: { ...node, spec: { ...spec, version: 2 } } };
      }
      return { status: 'unchanged' };
    },
  };

  it("delegates to the block's migrator on a document that is otherwise current", () => {
    const content = [chartBlock({ version: 1 })] as ExtendedBlocksContent;
    const result = migrateDocument(content, { blocks: [bumping] });

    expect(result.from).toBe(2);
    expect(result.changed).toBe(true);
    expect((result.content[0] as CustomBlockNode).spec).toEqual({ version: 2 });
    // The input is left alone.
    expect((content[0] as CustomBlockNode).spec).toEqual({ version: 1 });
  });

  it('leaves an up-to-date block untouched, by reference', () => {
    const content = [chartBlock({ version: 2 })] as ExtendedBlocksContent;
    const result = migrateDocument(content, { blocks: [bumping] });

    expect(result.changed).toBe(false);
    expect(result.content).toBe(content);
  });

  it("records a migrator's refusal with its reason", () => {
    const refusing: BlockDefinition = {
      type: 'chart',
      migrate: () => ({ status: 'skipped', reason: 'chart spec predates the version marker' }),
    };

    const result = migrateDocument([chartBlock(undefined)] as ExtendedBlocksContent, {
      blocks: [refusing],
    });

    expect(result.changed).toBe(false);
    expect(result.skipped).toEqual([
      { path: '[0]', reason: 'chart spec predates the version marker' },
    ]);
  });

  it('migrates registered blocks nested inside a callout, with the right path', () => {
    const content = [
      { type: 'callout', variant: 'info', children: [chartBlock({ version: 1 })] },
    ] as ExtendedBlocksContent;

    const result = migrateDocument(content, { blocks: [bumping] });
    const callout = result.content[0] as CustomBlockNode;
    const nested = (callout.children as CustomBlockNode[])[0];

    expect(result.changed).toBe(true);
    expect(nested.spec).toEqual({ version: 2 });
  });

  it('does not call a migrator for a type nobody registered', () => {
    const migrate = vi.fn();
    const result = migrateDocument([chartBlock({ version: 1 })] as ExtendedBlocksContent, {
      blocks: [{ type: 'timeline', migrate }],
    });

    expect(migrate).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
  });
});
