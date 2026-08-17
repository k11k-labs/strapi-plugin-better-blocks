import { toBlockRegistry } from './registry';
import type { BlockRegistryInput, CustomBlockNode } from './registry';
import type { BlocksContent } from './types';

// ── Document Validation ──────────────────────────────────────────────

/** Where the problem is, in JSON-pointer-ish form, and what it is. */
export type ValidationIssue = {
  /** e.g. `[3].children[0].url` */
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

/** Options shared by {@link validateDocument} and {@link isBlocksContent}. */
export type ValidateOptions = {
  /**
   * Block types registered by another package. Without these, a document
   * containing one is reported as invalid - which is the correct answer for a
   * caller that has not opted in, since it has no way to render it either.
   */
  blocks?: BlockRegistryInput;
};

/**
 * Block types the editor can store. `media-embed` is deprecated - nothing
 * inserts it any more - but documents saved before it was replaced still
 * contain it, so it stays valid. {@link migrateDocument} converts it.
 */
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'list',
  'quote',
  'code',
  'image',
  'horizontal-line',
  'table',
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
]);

/** Block types whose children are inline content. */
const INLINE_PARENTS = new Set([
  'paragraph',
  'heading',
  'quote',
  'code',
  'list-item',
  'table-cell',
  'table-header-cell',
]);

/**
 * Block types that nest whole blocks rather than inline content - a callout or
 * a details holds paragraphs and lists, and details can nest further details.
 */
const BLOCK_PARENTS = new Set(['callout', 'details']);

const LIST_FORMATS = new Set(['ordered', 'unordered', 'todo']);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks that a value is a Better Blocks document.
 *
 * This is a structural check, not a schema for every attribute: it verifies the
 * things a renderer will crash or silently drop content on - the node types it
 * dispatches over, and the child shapes it walks into. Optional presentation
 * attributes are left alone, because an unknown one is forward compatibility
 * rather than corruption.
 *
 * Block types from other packages are accepted only when passed in through
 * `options.blocks` - see {@link ValidateOptions}.
 */
export function validateDocument(value: unknown, options?: ValidateOptions): ValidationResult {
  const issues: ValidationIssue[] = [];
  const registry = toBlockRegistry(options?.blocks);

  const fail = (path: string, message: string) => {
    issues.push({ path, message });
  };

  const checkInline = (node: unknown, path: string) => {
    if (!isObject(node)) return fail(path, 'inline node must be an object');
    const type = node.type;

    if (type === 'text') {
      if (typeof node.text !== 'string') fail(`${path}.text`, 'text must be a string');
      return;
    }

    if (type === 'link') {
      if (typeof node.url !== 'string') fail(`${path}.url`, 'link url must be a string');
      if (!Array.isArray(node.children)) {
        return fail(`${path}.children`, 'link must have a children array');
      }
      node.children.forEach((child, i) => {
        if (!isObject(child) || child.type !== 'text') {
          fail(`${path}.children[${i}]`, 'link children must be text nodes');
        } else if (typeof child.text !== 'string') {
          fail(`${path}.children[${i}].text`, 'text must be a string');
        }
      });
      return;
    }

    if (type === 'math') {
      if (typeof node.value !== 'string') fail(`${path}.value`, 'math value must be a string');
      return;
    }

    fail(`${path}.type`, `unknown inline type "${String(type)}"`);
  };

  const checkChildren = (
    node: Record<string, unknown>,
    path: string,
    check: (c: unknown, p: string) => void
  ) => {
    if (!Array.isArray(node.children)) {
      return fail(`${path}.children`, 'expected a children array');
    }
    node.children.forEach((child, i) => check(child, `${path}.children[${i}]`));
  };

  const checkListChild = (node: unknown, path: string) => {
    if (!isObject(node)) return fail(path, 'list child must be an object');
    if (node.type === 'list') return checkBlock(node, path);
    if (node.type === 'list-item') return checkChildren(node, path, checkInline);
    fail(`${path}.type`, `list children must be list-item or list, got "${String(node.type)}"`);
  };

  const checkRow = (node: unknown, path: string) => {
    if (!isObject(node)) return fail(path, 'table child must be an object');
    if (node.type !== 'table-row') {
      return fail(`${path}.type`, `table children must be table-row, got "${String(node.type)}"`);
    }
    checkChildren(node, path, (cell, cellPath) => {
      if (!isObject(cell)) return fail(cellPath, 'table cell must be an object');
      if (cell.type !== 'table-cell' && cell.type !== 'table-header-cell') {
        return fail(
          `${cellPath}.type`,
          `row children must be table-cell or table-header-cell, got "${String(cell.type)}"`
        );
      }
      checkChildren(cell, cellPath, checkInline);
    });
  };

  function checkBlock(node: unknown, path: string) {
    if (!isObject(node)) return fail(path, 'block must be an object');

    const type = node.type;
    if (typeof type !== 'string') return fail(`${path}.type`, 'block type must be a string');

    if (!BLOCK_TYPES.has(type)) {
      const definition = registry.get(type);
      if (!definition) return fail(`${path}.type`, `unknown block type "${type}"`);

      // A registered block owns its attributes; the core only walks its
      // children, according to the content model it declared.
      if (definition.content === 'blocks') {
        checkChildren(node, path, checkBlock);
      } else {
        checkChildren(node, path, checkInline);
      }

      definition.validate?.(node as CustomBlockNode, { path, fail });
      return;
    }

    if (type === 'heading') {
      const level = node.level;
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) {
        fail(`${path}.level`, 'heading level must be an integer between 1 and 6');
      }
    }

    if (type === 'list') {
      if (typeof node.format !== 'string' || !LIST_FORMATS.has(node.format)) {
        fail(`${path}.format`, 'list format must be "ordered", "unordered" or "todo"');
      }
      return checkChildren(node, path, checkListChild);
    }

    if (type === 'table') return checkChildren(node, path, checkRow);

    if (type === 'math' && typeof node.value !== 'string') {
      fail(`${path}.value`, 'math value must be a string');
    }

    if (type === 'media-embed' && typeof node.url !== 'string') {
      fail(`${path}.url`, 'media-embed url must be a string');
    }

    if (INLINE_PARENTS.has(type)) return checkChildren(node, path, checkInline);
    if (BLOCK_PARENTS.has(type)) return checkChildren(node, path, checkBlock);

    // Every remaining block is a void: it renders from its own attributes and
    // carries an empty text placeholder as its children. The placeholder is not
    // decoration - Slate refuses to load a document whose top-level nodes are
    // not all elements, and an element is something with a children array. A
    // void block saved without it takes the whole editor down.
    checkChildren(node, path, checkInline);
  }

  if (!Array.isArray(value)) {
    return { valid: false, issues: [{ path: '', message: 'document must be an array of blocks' }] };
  }

  value.forEach((node, i) => checkBlock(node, `[${i}]`));

  return { valid: issues.length === 0, issues };
}

/** Narrowing form of {@link validateDocument}, for use at a trust boundary. */
export function isBlocksContent(value: unknown, options?: ValidateOptions): value is BlocksContent {
  return validateDocument(value, options).valid;
}
