/**
 * The contract a package outside Better Blocks implements to add a block type.
 *
 * Better Blocks knows nothing about what a registered block contains. It only
 * knows four things about it: what its children look like, whether its
 * attributes are well formed, how to bring an old one up to date, and — in the
 * packages that render — how to draw it. This file owns the first three; the
 * fourth is framework-specific and lives in each renderer, because a React
 * component type and an Astro component type have nothing in common.
 *
 * Deliberately free of any framework, editor or Strapi types, like the rest of
 * the core.
 */

import type { BlockNode } from './types';
import type { ValidationIssue } from './validate';

// ── Nodes ────────────────────────────────────────────────────────────

/**
 * A block this core does not know the shape of.
 *
 * The index signature is the point: a registered block carries whatever
 * attributes its owner defined, and nothing here should pretend to know them.
 * `children` stays `unknown[]` because the content model decides what is legal
 * inside — see {@link BlockContentModel}.
 */
export type CustomBlockNode = {
  type: string;
  children?: unknown[];
  [attribute: string]: unknown;
};

/**
 * A block that is either one of the documented built-ins or a registered one.
 *
 * {@link BlockNode} stays a closed union on purpose — widening it would break
 * every exhaustive `switch` written against it, including the two renderers'.
 * Code that must handle registered blocks opts in by using this type instead.
 */
export type AnyBlockNode = BlockNode | CustomBlockNode;

/** A document that may contain registered blocks. */
export type ExtendedBlocksContent = AnyBlockNode[];

// ── Content model ────────────────────────────────────────────────────

/**
 * What a registered block holds.
 *
 * - **`void`** — renders entirely from its own attributes. It still carries an
 *   empty text placeholder as its children, which is not decoration: Slate
 *   refuses to load a document whose nodes are not elements, and an element is
 *   something with a children array.
 * - **`inline`** — holds text and links, like a paragraph.
 * - **`blocks`** — holds whole blocks, like a callout.
 *
 * `void` and `inline` validate identically today, because a void block's
 * placeholder *is* an inline text node. They stay separate because the editor
 * needs the distinction for `Editor.isVoid`, where getting it wrong is the
 * difference between a working block and an uneditable one.
 */
export type BlockContentModel = 'void' | 'inline' | 'blocks';

// ── Validation ───────────────────────────────────────────────────────

/**
 * What a block's own validator is handed.
 *
 * `path` is where this node sits in the document (`[3].children[1]`), so
 * reported paths line up with the ones the core produces itself.
 */
export type BlockValidateContext = {
  path: string;
  /** Records a problem. `path` is absolute — build it from the context's. */
  fail: (path: string, message: string) => void;
};

// ── Migration ────────────────────────────────────────────────────────

/**
 * What a block's migrator decided.
 *
 * Spelled out rather than returning `node | null`, because "I left this alone"
 * and "I refused to touch this, here is why" are different outcomes and the
 * second one has to reach {@link MigrationResult.skipped} with its reason
 * intact. A migrator that silently declines is one nobody can debug.
 */
export type BlockMigrationOutcome =
  | { status: 'unchanged' }
  | { status: 'migrated'; node: CustomBlockNode }
  | { status: 'skipped'; reason: string };

// ── The definition ───────────────────────────────────────────────────

/**
 * Everything Better Blocks needs to accept a block type it did not write.
 *
 * A definition is data, not a class, and holds no state — the same object is
 * handed to the validator, the migrator and both renderers.
 */
export type BlockDefinition = {
  /**
   * The `type` on the node, e.g. `chart`. Must not collide with a built-in;
   * {@link createBlockRegistry} enforces that.
   */
  type: string;
  /** Defaults to `void`, which is what a self-contained block usually is. */
  content?: BlockContentModel;
  /**
   * Checks this block's own attributes. The core has already checked that the
   * node is an object with a string `type` and walked its children according to
   * {@link content}; everything past that is the owner's business.
   */
  validate?: (node: CustomBlockNode, context: BlockValidateContext) => void;
  /**
   * Brings one node of this type up to date.
   *
   * Better Blocks does not know this block's schema and does not track its
   * version — the node carries its own (`spec.version`, or whatever the owner
   * chose) and the migrator reads it. This is called for every node of this
   * type in the document, including ones nested inside a callout or details.
   */
  migrate?: (node: CustomBlockNode) => BlockMigrationOutcome;
};

// ── The registry ─────────────────────────────────────────────────────

/**
 * A resolved, immutable set of block definitions.
 *
 * Built once and passed explicitly to whatever needs it, rather than kept in a
 * module-level global. The renderers run on a server handling concurrent
 * requests, where mutable module state is a cross-request bug waiting to
 * happen; the Strapi admin registers at boot and can afford a global, so that
 * one lives in the plugin rather than here.
 */
export type BlockRegistry = {
  get: (type: string) => BlockDefinition | undefined;
  has: (type: string) => boolean;
  /** Registered types, in registration order. */
  types: () => string[];
};

/**
 * Block types the core defines itself. A registration may not shadow one —
 * silently overriding `paragraph` would be very hard to trace back.
 */
const BUILT_IN_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'list-item',
  'quote',
  'code',
  'image',
  'horizontal-line',
  'table',
  'table-row',
  'table-cell',
  'table-header-cell',
  'media-embed',
  'math',
  'diagram',
  'callout',
  'details',
  'button',
  'social-embed',
  'audio',
  'embed',
  'video',
  'link',
  'text',
]);

/** Whether `type` is a block type Better Blocks defines itself. */
export function isBuiltInBlockType(type: string): boolean {
  return BUILT_IN_TYPES.has(type);
}

/**
 * Resolves definitions into a registry, rejecting the two mistakes that would
 * otherwise surface much later as a block that mysteriously does not render:
 * shadowing a built-in, and registering the same type twice.
 */
export function createBlockRegistry(definitions: readonly BlockDefinition[] = []): BlockRegistry {
  const byType = new Map<string, BlockDefinition>();

  for (const definition of definitions) {
    const { type } = definition;

    if (typeof type !== 'string' || type.length === 0) {
      throw new Error('A block definition needs a non-empty string `type`.');
    }
    if (isBuiltInBlockType(type)) {
      throw new Error(`"${type}" is a built-in Better Blocks type and cannot be re-registered.`);
    }
    if (byType.has(type)) {
      throw new Error(`Block type "${type}" is registered twice.`);
    }

    byType.set(type, definition);
  }

  return {
    get: (type) => byType.get(type),
    has: (type) => byType.has(type),
    types: () => [...byType.keys()],
  };
}

/** Accepted wherever a caller may pass either raw definitions or a built registry. */
export type BlockRegistryInput = BlockRegistry | readonly BlockDefinition[];

/** Normalizes {@link BlockRegistryInput}, so callers can take either form. */
export function toBlockRegistry(input?: BlockRegistryInput): BlockRegistry {
  if (!input) return createBlockRegistry();
  return Array.isArray(input) ? createBlockRegistry(input) : (input as BlockRegistry);
}

/** Re-exported so a block's validator can type what it collects. */
export type { ValidationIssue };
