/**
 * The document types come from `@qkix/better-blocks-core`, which every renderer
 * shares so they cannot drift apart again. They are re-exported here so existing
 * imports from this package keep resolving.
 *
 * What stays local is what only makes sense for Astro: the component-config
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
  TextNode,
  BlockDefinition,
  BlockNode,
  BlocksContent,
  DiagramTheme,
  ExtendedBlocksContent,
} from '@qkix/better-blocks-core';

// ── Diagram Theming ──────────────────────────────────────────────────

/**
 * Diagram theming is shared with the Vue renderer and lives in
 * `@qkix/better-blocks-core`. Re-exported so consumers keep importing every
 * type from this package.
 */
export type { DiagramColors, DiagramTheme, DiagramThemeName } from '@qkix/better-blocks-core';

// ── Style ────────────────────────────────────────────────────────────

/**
 * Inline style value accepted by Astro elements - either a CSS string or a
 * record of property/value pairs (Astro serializes the object to a string).
 */
export type StyleValue = string | Record<string, string | number | undefined>;

// ── Custom Renderers Config ──────────────────────────────────────────

/**
 * Any Astro component - the default export of a `.astro` file (or any
 * framework component Astro can render). Custom renderers receive their props
 * via `Astro.props` and their inner content via the default `<slot />`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AstroComponentFactory = (...args: any[]) => any;

/**
 * Map of block type → custom Astro component. Each component receives the props
 * documented below plus, where applicable, its rendered children via `<slot />`.
 *
 * - `paragraph` - `{ style?: StyleValue }`
 * - `heading` - `{ level: 1 | 2 | 3 | 4 | 5 | 6; style?: StyleValue }`
 * - `list` - `{ format: 'ordered' | 'unordered' | 'todo'; indentLevel: number }`
 * - `list-item` - `{ checked?: boolean }`
 * - `link` - `{ url: string; target?: string; rel?: string }`
 * - `quote` - `{ style?: StyleValue }`
 * - `code` - `{ plainText: string; language?: string }` (also available via `<slot />`)
 * - `image` - `{ image; caption?: string; imageAlign?: 'left' | 'center' | 'right' }`
 * - `horizontal-line` - no props
 * - `table` / `table-row` - children via `<slot />`
 * - `table-cell` / `table-header-cell` - `{ align?; colSpan?; rowSpan? }` (children via `<slot />`)
 * - `media-embed` - `{ url: string; originalUrl?: string }`
 * - `math` - `{ formula: string; inline: boolean }`
 * - `diagram` - `{ code: string; format: 'mermaid' }`
 * - `callout` - `{ variant: CalloutVariant; title?: string }` (children via `<slot />`)
 * - `details` - `{ summary: string; defaultOpen?: boolean }` (children via `<slot />`)
 * - `button` - `{ label; buttonType; alignment?; link?; file?; showFileSize?; showFileIcon?; style?; cssClass? }`
 * - `social-embed` - `{ platform; url; embedCode?; oembed?; alignment?; caption? }`
 * - `audio` - `{ file; title?; caption?; player?; alignment? }`
 * - `embed` - `{ embedHtml; embedSrc?; provider?; thumbnail?; aspectRatio?; customAspectRatio?; alignment?; caption?; title? }`
 * - `video` - `{ provider; url?; playbackId?; assetId?; file?; poster?; title?; caption?; transcript?; player?; alignment?; aspectRatio?; customAspectRatio? }`
 */
export type CustomBlocksConfig = Partial<{
  paragraph: AstroComponentFactory;
  heading: AstroComponentFactory;
  list: AstroComponentFactory;
  'list-item': AstroComponentFactory;
  link: AstroComponentFactory;
  quote: AstroComponentFactory;
  code: AstroComponentFactory;
  image: AstroComponentFactory;
  'horizontal-line': AstroComponentFactory;
  table: AstroComponentFactory;
  'table-row': AstroComponentFactory;
  'table-cell': AstroComponentFactory;
  'table-header-cell': AstroComponentFactory;
  'media-embed': AstroComponentFactory;
  math: AstroComponentFactory;
  diagram: AstroComponentFactory;
  callout: AstroComponentFactory;
  details: AstroComponentFactory;
  button: AstroComponentFactory;
  'social-embed': AstroComponentFactory;
  audio: AstroComponentFactory;
  embed: AstroComponentFactory;
  video: AstroComponentFactory;
}>;

/**
 * Map of text modifier (mark) → custom Astro component. Each component receives
 * its inner content via the default `<slot />`. The color/size/font modifiers
 * additionally receive a value prop:
 *
 * - `color` - `{ color: string }`
 * - `backgroundColor` - `{ backgroundColor: string }`
 * - `fontFamily` - `{ fontFamily: string }`
 * - `fontSize` - `{ fontSize: string }`
 */
export type CustomModifiersConfig = Partial<{
  bold: AstroComponentFactory;
  italic: AstroComponentFactory;
  underline: AstroComponentFactory;
  strikethrough: AstroComponentFactory;
  code: AstroComponentFactory;
  uppercase: AstroComponentFactory;
  superscript: AstroComponentFactory;
  subscript: AstroComponentFactory;
  color: AstroComponentFactory;
  backgroundColor: AstroComponentFactory;
  fontFamily: AstroComponentFactory;
  fontSize: AstroComponentFactory;
}>;

// ── Registered Blocks ────────────────────────────────────────────────

/**
 * A block type from another package, plus the Astro component that draws it.
 *
 * Extends the core `BlockDefinition` so one object serves validation, migration
 * and rendering: a package publishes its definition once and adds `component`
 * here.
 *
 * The component receives `{ node }` - the whole block, since this renderer does
 * not know what attributes it has - and, when the content model is `inline` or
 * `blocks`, its rendered children via the default `<slot />`.
 */
export type AstroBlockPlugin = BlockDefinition & {
  component: AstroComponentFactory;
};

// ── Component Props ──────────────────────────────────────────────────

export type BlocksRendererProps = {
  content: BlocksContent | ExtendedBlocksContent;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  /**
   * Block types this renderer does not ship, supplied by another package.
   * Passed explicitly rather than read from a global, so a server rendering
   * concurrent requests cannot leak one page's registrations into another's.
   *
   * An unregistered block type renders nothing, exactly as before.
   */
  blockPlugins?: readonly AstroBlockPlugin[];
  /**
   * Color theme for `diagram` (Mermaid) blocks - a built-in palette name or a
   * custom color object. Ignored when a custom `diagram` renderer is supplied
   * via `blocks.diagram`.
   */
  diagramTheme?: DiagramTheme;
  /**
   * Renders `diagram` blocks with mermaid.js in the browser instead of to SVG
   * on the server. Off by default, because the server-rendered SVG is what
   * keeps a page zero-JS; turn it on for diagrams the server-side engine gets
   * wrong (flowcharts with a cycle, the closing actor row of a sequence
   * diagram). Ignored when a custom `diagram` renderer is supplied via
   * `blocks.diagram`.
   */
  clientMermaid?: boolean;
  /**
   * Shiki theme for the default `code` block highlighting. Any bundled Shiki
   * theme name (e.g. `github-dark`, `github-light`, `dracula`, `nord`).
   * Defaults to `github-dark`. Ignored when a custom `code` renderer is
   * supplied via `blocks.code`.
   */
  codeTheme?: string;
  /**
   * Adds a client-side "Copy" button to default `code` blocks. Off by default
   * to keep the output zero-JavaScript; when `true`, a small script is bundled
   * to wire up the buttons. Ignored when a custom `code` renderer is supplied.
   */
  codeCopyButton?: boolean;
};
