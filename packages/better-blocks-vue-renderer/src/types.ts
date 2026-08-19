/**
 * The document types come from `@qkix/better-blocks-core`, which every renderer
 * shares so they cannot drift apart. They are re-exported here so a consumer
 * keeps importing `BlocksContent` from the renderer it already uses.
 *
 * What stays local is what only makes sense for Vue: the component-config
 * surface, and diagram theming, which is presentation rather than document
 * shape.
 */
export type {
  AnyBlockNode,
  AspectRatio,
  AudioAlignment,
  AudioFile,
  AudioNode,
  AudioPlayer,
  AudioPreload,
  BlockDefinition,
  BlockNode,
  BlockStyle,
  BlocksContent,
  CustomBlockNode,
  ExtendedBlocksContent,
  ButtonAlignment,
  ButtonElement,
  ButtonFile,
  ButtonLink,
  ButtonStyle,
  CalloutNode,
  CalloutVariant,
  CodeNode,
  DetailsNode,
  DiagramNode,
  EmbedNode,
  EmbedProvider,
  HeadingNode,
  HorizontalLineNode,
  ImageNode,
  InlineNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MathNode,
  MediaAlignment,
  MediaAspectRatio,
  MediaEmbedNode,
  ParagraphNode,
  QuoteNode,
  SocialEmbedAlignment,
  SocialEmbedNode,
  SocialEmbedOembed,
  SocialPlatform,
  TableCellAlign,
  TableCellAttributes,
  TableCellNode,
  TableHeaderCellNode,
  TableNode,
  TableRowNode,
  TextAlign,
  TextNode,
  VideoFile,
  VideoNode,
  VideoPlayer,
  VideoProvider,
} from '@qkix/better-blocks-core';

import type {
  BlockDefinition,
  BlocksContent,
  DiagramTheme,
  ExtendedBlocksContent,
} from '@qkix/better-blocks-core';
import type { Component } from 'vue';

// ── Diagram Theming ──────────────────────────────────────────────────

/**
 * Diagram theming is shared with the Astro renderer and lives in
 * `@qkix/better-blocks-core`. Re-exported so consumers keep importing every
 * type from this package.
 */
export type { DiagramColors, DiagramTheme, DiagramThemeName } from '@qkix/better-blocks-core';

// ── Style ────────────────────────────────────────────────────────────

/**
 * Inline style value accepted by a Vue element binding - either a CSS string or
 * a record of property/value pairs (Vue serializes the object, and passes
 * `--custom-property` keys through untouched).
 */
export type StyleValue = string | Record<string, string | number | undefined>;

// ── Custom Renderers Config ──────────────────────────────────────────

/**
 * Map of block type → custom Vue component. Each component receives the props
 * documented below and, where applicable, its rendered children in the default
 * slot.
 *
 * - `paragraph` - `{ style?: StyleValue }`
 * - `heading` - `{ level: 1 | 2 | 3 | 4 | 5 | 6; style?: StyleValue }`
 * - `list` - `{ format: 'ordered' | 'unordered' | 'todo'; indentLevel: number }`
 * - `list-item` - `{ checked?: boolean }`
 * - `link` - `{ url: string; target?: string; rel?: string }`
 * - `quote` - `{ style?: StyleValue }`
 * - `code` - `{ plainText: string; language?: string }` (also in the default slot)
 * - `image` - `{ image; caption?: string; imageAlign?: 'left' | 'center' | 'right' }`
 * - `horizontal-line` - no props
 * - `table` / `table-row` - children in the default slot
 * - `table-cell` / `table-header-cell` - `{ align?; colSpan?; rowSpan? }` (children in the slot)
 * - `media-embed` - `{ url: string; originalUrl?: string }`
 * - `math` - `{ formula: string; inline: boolean }`
 * - `diagram` - `{ code: string; format: 'mermaid' }`
 * - `callout` - `{ variant: CalloutVariant; title?: string }` (children in the slot)
 * - `details` - `{ summary: string; defaultOpen?: boolean }` (children in the slot)
 * - `button` - `{ label; buttonType; alignment?; link?; file?; showFileSize?; showFileIcon?; filePreview?; style?; cssClass? }`
 * - `social-embed` - `{ platform; url; embedCode?; oembed?; alignment?; caption? }`
 * - `audio` - `{ file; title?; caption?; player?; alignment? }`
 * - `embed` - `{ embedHtml; embedSrc?; provider?; thumbnail?; aspectRatio?; customAspectRatio?; alignment?; caption?; title? }`
 * - `video` - `{ provider; url?; playbackId?; assetId?; file?; poster?; title?; caption?; transcript?; player?; alignment?; aspectRatio?; customAspectRatio? }`
 */
export type CustomBlocksConfig = Partial<{
  paragraph: Component;
  heading: Component;
  list: Component;
  'list-item': Component;
  link: Component;
  quote: Component;
  code: Component;
  image: Component;
  'horizontal-line': Component;
  table: Component;
  'table-row': Component;
  'table-cell': Component;
  'table-header-cell': Component;
  'media-embed': Component;
  math: Component;
  diagram: Component;
  callout: Component;
  details: Component;
  button: Component;
  'social-embed': Component;
  audio: Component;
  embed: Component;
  video: Component;
}>;

/**
 * Map of text modifier (mark) → custom Vue component. Each component receives
 * its inner content in the default slot. The color/size/font modifiers
 * additionally receive a value prop:
 *
 * - `color` - `{ color: string }`
 * - `backgroundColor` - `{ backgroundColor: string }`
 * - `fontFamily` - `{ fontFamily: string }`
 * - `fontSize` - `{ fontSize: string }`
 */
export type CustomModifiersConfig = Partial<{
  bold: Component;
  italic: Component;
  underline: Component;
  strikethrough: Component;
  code: Component;
  uppercase: Component;
  superscript: Component;
  subscript: Component;
  color: Component;
  backgroundColor: Component;
  fontFamily: Component;
  fontSize: Component;
}>;

// ── Registered Blocks ────────────────────────────────────────────────

/**
 * A block type from another package, plus the Vue component that draws it.
 *
 * Extends the core `BlockDefinition` so one object serves validation, migration
 * and rendering: a package publishes its definition once and adds `component`
 * here.
 *
 * The component receives `{ node }` - the whole block, since this renderer does
 * not know what attributes it has - and, when the content model is `inline` or
 * `blocks`, its rendered children in the default slot.
 */
export type VueBlockPlugin = BlockDefinition & {
  component: Component;
};

// ── Component Props ──────────────────────────────────────────────────

export type BlocksRendererProps = {
  content: BlocksContent | ExtendedBlocksContent | null | undefined;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  /**
   * Block types this renderer does not ship, supplied by another package.
   * Passed explicitly rather than read from a global, so a server rendering
   * concurrent requests cannot leak one page's registrations into another's.
   *
   * An unregistered block type renders nothing, exactly as an unknown one does.
   */
  blockPlugins?: readonly VueBlockPlugin[];
  /**
   * Color theme for `diagram` (Mermaid) blocks - a built-in palette name or a
   * custom color object. Applied as a mermaid `%%{init}%%` directive, so a
   * diagram whose source carries its own directive keeps that one. Defaults to
   * mermaid.js's own theme. Ignored when a custom `diagram` renderer is
   * supplied via `blocks.diagram`.
   */
  diagramTheme?: DiagramTheme;
  /**
   * Shiki theme for the default `code` block highlighting. Any bundled Shiki
   * theme name (e.g. `github-dark`, `github-light`, `dracula`, `nord`).
   * Defaults to `github-dark`. Ignored when a custom `code` renderer is
   * supplied via `blocks.code`.
   */
  codeTheme?: string;
  /**
   * Adds a "Copy" button to default `code` blocks. Off by default. Ignored when
   * a custom `code` renderer is supplied via `blocks.code`.
   */
  codeCopyButton?: boolean;
};
