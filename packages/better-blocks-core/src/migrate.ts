import type { BlocksContent, BlockNode, EmbedNode, MediaEmbedNode } from './types';

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

export type MigrationResult = {
  content: BlocksContent;
  from: SchemaVersion;
  to: SchemaVersion;
  /** False when the document was already current and is returned untouched. */
  changed: boolean;
  /** Nodes the migration deliberately left alone, and why. */
  skipped: { path: string; reason: string }[];
};

/**
 * Infers a document's format version from its contents.
 *
 * A document is version 1 only if it still contains a `media-embed` block.
 * Everything else — including an empty document — is already current, because
 * every other change to the format has been additive.
 */
export function detectSchemaVersion(content: BlocksContent): SchemaVersion {
  return content.some((node) => node?.type === 'media-embed') ? 1 : CURRENT_SCHEMA_VERSION;
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
 * Brings a document up to {@link CURRENT_SCHEMA_VERSION}.
 *
 * This is opt-in. Both renderers still handle `media-embed`, so nothing breaks
 * if you never run it — it is for normalising stored content, e.g. in a Strapi
 * migration or a one-off script.
 *
 * The input is not mutated; blocks that need no change are carried over by
 * reference.
 */
export function migrateDocument(content: BlocksContent): MigrationResult {
  const from = detectSchemaVersion(content);
  const skipped: MigrationResult['skipped'] = [];

  if (from === CURRENT_SCHEMA_VERSION) {
    return { content, from, to: CURRENT_SCHEMA_VERSION, changed: false, skipped };
  }

  let changed = false;
  const migrated = content.map((node, i) => {
    if (node?.type !== 'media-embed') return node;

    const embed = migrateMediaEmbed(node);
    if (!embed) {
      skipped.push({
        path: `[${i}]`,
        reason: 'media-embed has no usable http(s) url, so no iframe could be built for it',
      });
      return node;
    }

    changed = true;
    return embed as BlockNode;
  });

  return {
    content: changed ? migrated : content,
    from,
    to: CURRENT_SCHEMA_VERSION,
    changed,
    skipped,
  };
}
