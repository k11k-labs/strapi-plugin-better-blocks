import { toBlockRegistry } from './registry';
import type {
  AnyBlockNode,
  BlockRegistryInput,
  CustomBlockNode,
  ExtendedBlocksContent,
} from './registry';
import type { BlocksContent, EmbedNode, MediaEmbedNode } from './types';

// ── Schema Versioning & Migrations ───────────────────────────────────

/**
 * The document format this version of the core describes.
 *
 * Documents do **not** carry a version marker. The plugin has never written
 * one, and adding a field to content already sitting in people's databases is
 * not something a version number is worth — so the version is inferred from
 * what a document actually contains. See {@link detectSchemaVersion}.
 *
 * - **1** — the original format. Media was a `media-embed` block: a URL that
 *   renderers turned into a hardcoded 16:9 iframe.
 * - **2** — `media-embed` was superseded by the richer `embed` and `video`
 *   blocks. Nothing inserts `media-embed` any more.
 */
export const CURRENT_SCHEMA_VERSION = 2;

export type SchemaVersion = 1 | 2;

export type MigrationResult<Content extends ExtendedBlocksContent = BlocksContent> = {
  content: Content;
  from: SchemaVersion;
  to: SchemaVersion;
  /** False when the document was already current and is returned untouched. */
  changed: boolean;
  /** Nodes the migration deliberately left alone, and why. */
  skipped: { path: string; reason: string }[];
};

/** Options for {@link migrateDocument}. */
export type MigrateOptions = {
  /**
   * Block types registered by another package. A registered block's own
   * migrator runs on every node of its type, regardless of the document's
   * schema version — the two version lines are independent, and a document
   * that is current by Better Blocks' reckoning can still hold an outdated
   * chart.
   */
  blocks?: BlockRegistryInput;
};

/**
 * Blocks whose children are themselves blocks. Walking has to descend into
 * these: a `media-embed` — or a registered block — sitting inside a callout is
 * just as much part of the document as one at the top level.
 */
const BUILT_IN_BLOCK_PARENTS = new Set(['callout', 'details']);

/** The children of `node`, if it is a node that nests whole blocks. */
function blockChildrenOf(node: AnyBlockNode, holdsBlocks: boolean): AnyBlockNode[] | null {
  if (!holdsBlocks) return null;
  const children = (node as { children?: unknown }).children;
  return Array.isArray(children) ? (children as AnyBlockNode[]) : null;
}

/**
 * Infers a document's format version from its contents.
 *
 * A document is version 1 only if it still contains a `media-embed` block,
 * at any depth. Everything else — including an empty document — is already
 * current, because every other change to the format has been additive.
 */
export function detectSchemaVersion(content: ExtendedBlocksContent): SchemaVersion {
  const hasMediaEmbed = (nodes: ExtendedBlocksContent): boolean =>
    nodes.some((node) => {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'media-embed') return true;
      const children = blockChildrenOf(node, BUILT_IN_BLOCK_PARENTS.has(node.type));
      return children ? hasMediaEmbed(children) : false;
    });

  return hasMediaEmbed(content) ? 1 : CURRENT_SCHEMA_VERSION;
}

/** Only `http(s)` sources are turned into an iframe; see migrateMediaEmbed. */
const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url.trim());

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Converts one `media-embed` into the `embed` block that replaced it.
 *
 * Both renderers draw a `media-embed` as a 16:9 box wrapping
 * `<iframe src={url}>`, and draw an `embed` from its sanitized `embedHtml`. To
 * come out looking the same, the migration has to synthesize that markup — so
 * it builds the same iframe the renderers used to build, with the URL escaped
 * as an attribute value.
 *
 * Returns `null` for anything it will not vouch for, rather than guessing.
 */
function migrateMediaEmbed(node: MediaEmbedNode): EmbedNode | null {
  const src = typeof node.url === 'string' ? node.url.trim() : '';
  if (!src || !isHttpUrl(src)) return null;

  const safeSrc = escapeAttribute(src);

  return {
    type: 'embed',
    source: 'url',
    // `url` is the address the author pasted; the old block kept the original
    // watch URL separately when it had one.
    url: node.originalUrl ?? src,
    embedSrc: src,
    embedHtml:
      `<iframe src="${safeSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"` +
      ` allowfullscreen title="Embedded media"></iframe>`,
    aspectRatio: '16:9',
    children: node.children ?? [{ type: 'text', text: '' }],
  };
}

/**
 * Brings a document up to {@link CURRENT_SCHEMA_VERSION}, and hands every
 * registered block to its own migrator on the way through.
 *
 * This is opt-in. Both renderers still handle `media-embed`, so nothing breaks
 * if you never run it — it is for normalising stored content, e.g. in a Strapi
 * migration or a one-off script.
 *
 * Better Blocks does not know the schema of a registered block and does not
 * try to: it walks the document once, and for each node of a registered type
 * calls that type's `migrate`. The block reads its own version marker and
 * decides. That is the whole contract — the alternative is a `switch` over
 * other people's block types living in this file forever.
 *
 * The input is not mutated; blocks that need no change are carried over by
 * reference.
 */
export function migrateDocument(content: BlocksContent, options?: MigrateOptions): MigrationResult;
export function migrateDocument(
  content: ExtendedBlocksContent,
  options?: MigrateOptions
): MigrationResult<ExtendedBlocksContent>;
export function migrateDocument(
  content: ExtendedBlocksContent,
  options?: MigrateOptions
): MigrationResult<ExtendedBlocksContent> {
  const registry = toBlockRegistry(options?.blocks);
  const from = detectSchemaVersion(content);
  const skipped: MigrationResult['skipped'] = [];
  let changed = false;

  const migrateNode = (node: AnyBlockNode, path: string): AnyBlockNode => {
    if (!node || typeof node !== 'object') return node;

    let current: AnyBlockNode = node;

    if (from === 1 && current.type === 'media-embed') {
      const embed = migrateMediaEmbed(current as MediaEmbedNode);
      if (embed) {
        changed = true;
        current = embed;
      } else {
        skipped.push({
          path,
          reason: 'media-embed has no usable http(s) url, so no iframe could be built for it',
        });
      }
    }

    const definition = registry.get(current.type);
    if (definition?.migrate) {
      const outcome = definition.migrate(current as CustomBlockNode);
      if (outcome.status === 'migrated') {
        changed = true;
        current = outcome.node;
      } else if (outcome.status === 'skipped') {
        skipped.push({ path, reason: outcome.reason });
      }
    }

    const holdsBlocks =
      BUILT_IN_BLOCK_PARENTS.has(current.type) || registry.get(current.type)?.content === 'blocks';
    const children = blockChildrenOf(current, holdsBlocks);
    if (!children) return current;

    let childChanged = false;
    const migratedChildren = children.map((child, i) => {
      const next = migrateNode(child, `${path}.children[${i}]`);
      if (next !== child) childChanged = true;
      return next;
    });

    if (!childChanged) return current;
    return { ...(current as CustomBlockNode), children: migratedChildren } as AnyBlockNode;
  };

  const migrated = content.map((node, i) => migrateNode(node, `[${i}]`));

  return {
    content: changed ? migrated : content,
    from,
    to: CURRENT_SCHEMA_VERSION,
    changed,
    skipped,
  };
}
