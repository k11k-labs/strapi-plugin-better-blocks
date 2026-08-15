// ── Text & Inline Nodes ──────────────────────────────────────────────

export type TextNode = {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  uppercase?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
};

export type LinkNode = {
  type: 'link';
  url: string;
  target?: '_blank' | '_self';
  rel?: string;
  children: TextNode[];
};

export type MathNode = {
  type: 'math';
  format: 'inline' | 'block';
  value: string;
  children: [{ type: 'text'; text: '' }];
};

export type InlineNode = TextNode | LinkNode | MathNode;

// ── Text Alignment ──────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

// ── Block Nodes ──────────────────────────────────────────────────────

export type ListItemNode = {
  type: 'list-item';
  checked?: boolean;
  children: InlineNode[];
};

export type ParagraphNode = {
  type: 'paragraph';
  textAlign?: TextAlign;
  lineHeight?: string;
  indent?: number;
  children: InlineNode[];
};

export type HeadingNode = {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  textAlign?: TextAlign;
  lineHeight?: string;
  indent?: number;
  children: InlineNode[];
};

export type ListNode = {
  type: 'list';
  format: 'ordered' | 'unordered' | 'todo';
  indentLevel?: number;
  children: (ListItemNode | ListNode)[];
};

export type QuoteNode = {
  type: 'quote';
  textAlign?: TextAlign;
  lineHeight?: string;
  indent?: number;
  children: InlineNode[];
};

export type CodeNode = {
  type: 'code';
  /**
   * Language attached in the editor (e.g. `typescript`, `python`). Drives Shiki
   * syntax highlighting via Astro's `<Code>` component. Unknown or missing
   * values render as themed-but-unhighlighted `plaintext`.
   */
  language?: string;
  children: InlineNode[];
};

export type ImageNode = {
  type: 'image';
  image: {
    url: string;
    alternativeText?: string | null;
    width?: number;
    height?: number;
  };
  caption?: string;
  imageAlign?: 'left' | 'center' | 'right';
  children: [{ type: 'text'; text: '' }];
};

export type HorizontalLineNode = {
  type: 'horizontal-line';
  children: [{ type: 'text'; text: '' }];
};

export type TableCellAlign = 'left' | 'center' | 'right';

export type TableCellNode = {
  type: 'table-cell';
  /** Horizontal text alignment. Omitted means `left`. */
  align?: TableCellAlign;
  /** Number of columns this cell spans. Omitted means `1`. */
  colSpan?: number;
  /** Number of rows this cell spans. Omitted means `1`. */
  rowSpan?: number;
  children: InlineNode[];
};

export type TableHeaderCellNode = {
  type: 'table-header-cell';
  /** Horizontal text alignment. Omitted means `left`. */
  align?: TableCellAlign;
  /** Number of columns this cell spans. Omitted means `1`. */
  colSpan?: number;
  /** Number of rows this cell spans. Omitted means `1`. */
  rowSpan?: number;
  children: InlineNode[];
};

export type TableRowNode = {
  type: 'table-row';
  children: (TableCellNode | TableHeaderCellNode)[];
};

export type TableNode = {
  type: 'table';
  children: TableRowNode[];
};

export type MediaEmbedNode = {
  type: 'media-embed';
  url: string;
  originalUrl?: string;
  children: [{ type: 'text'; text: '' }];
};

export type DiagramNode = {
  type: 'diagram';
  format: 'mermaid';
  value: string;
  children: [{ type: 'text'; text: '' }];
};

// ── Diagram Theming ──────────────────────────────────────────────────

/**
 * Built-in Mermaid color theme shipped by `beautiful-mermaid` (the engine that
 * renders diagrams to SVG on the server). The default is `github-light`.
 */
export type DiagramThemeName =
  | 'zinc-light'
  | 'zinc-dark'
  | 'tokyo-night'
  | 'tokyo-night-storm'
  | 'tokyo-night-light'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'nord'
  | 'nord-light'
  | 'dracula'
  | 'github-light'
  | 'github-dark'
  | 'solarized-light'
  | 'solarized-dark'
  | 'one-dark';

/**
 * Custom Mermaid palette. `bg`/`fg` alone produce a clean monochrome diagram;
 * `line`/`accent`/`muted`/`surface`/`border` bring in richer color (each falls
 * back to a derivation from `bg` + `fg` when omitted).
 */
export type DiagramColors = {
  bg?: string;
  fg?: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
  font?: string;
  transparent?: boolean;
};

/**
 * Theme for `diagram` (Mermaid) blocks — either a built-in theme name or a
 * custom color object. A bare `string` is accepted for forward compatibility
 * with themes added to `beautiful-mermaid`. Defaults to `github-light`.
 */
export type DiagramTheme = DiagramThemeName | (string & {}) | DiagramColors;

export type CalloutVariant = 'note' | 'tip' | 'important' | 'warning' | 'caution';

export type CalloutNode = {
  type: 'callout';
  variant: CalloutVariant;
  title?: string;
  children: BlockNode[];
};

export type DetailsNode = {
  type: 'details';
  summary: string;
  defaultOpen?: boolean;
  children: BlockNode[];
};

// ── Button (CTA / File Download) ─────────────────────────────────────

export type ButtonAlignment = 'left' | 'center' | 'right' | 'none';

export type ButtonLink = {
  url: string;
  target?: '_self' | '_blank' | '_parent' | '_top';
  rel?: string;
  ariaLabel?: string;
};

export type ButtonFile = {
  id?: number;
  url: string;
  name: string;
  size?: number;
  ext?: string;
  mime?: string;
};

export type ButtonStyle = {
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  padding?: string;
  border?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
};

export type ButtonElement = {
  type: 'button';
  buttonType: 'link' | 'file';
  label: string;
  alignment?: ButtonAlignment;
  link?: ButtonLink;
  file?: ButtonFile;
  showFileSize?: boolean;
  showFileIcon?: boolean;
  /**
   * File mode only. When `true`, the file opens in a new tab for preview instead
   * of downloading. When `false`/omitted, the file is force-downloaded (even
   * when hosted cross-origin, where the native `download` attribute is ignored
   * by browsers) via a small progressive-enhancement script.
   */
  filePreview?: boolean;
  style?: ButtonStyle;
  cssClass?: string;
};

// ── Social Embed (Twitter/X, Instagram, Facebook, TikTok, …) ─────────

/**
 * The social platform a `social-embed` node targets. `linkedin` renders a
 * self-contained `<iframe>` (no widget script); every other platform loads a
 * lazy, deduped widget script (see `SOCIAL_SCRIPTS` in `utils.ts`).
 */
export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest';

export type SocialEmbedAlignment = 'left' | 'center' | 'right';

/**
 * oEmbed payload fetched server-side by the plugin at author time. Every field
 * is optional — providers vary in what they return (e.g. `thumbnailUrl` is
 * present for TikTok/Pinterest but absent for Twitter).
 */
export type SocialEmbedOembed = {
  /** Provider-supplied embed markup (a `<blockquote>` or `<iframe>`). Trusted. */
  html?: string;
  title?: string;
  author?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  providerName?: string;
  width?: number;
  height?: number;
};

export type SocialEmbedNode = {
  type: 'social-embed';
  platform: SocialPlatform;
  /** Optional — platforms without a tokenless oEmbed can be saved embed-code-only. */
  url?: string;
  /** Author-pasted manual override, takes priority over `oembed.html`. Trusted. */
  embedCode?: string;
  /** Fetched server-side by the plugin at author time. */
  oembed?: SocialEmbedOembed;
  alignment?: SocialEmbedAlignment;
  caption?: string;
  /** Void-node placeholder emitted by the editor — ignored when rendering. */
  children?: [{ type: 'text'; text: '' }];
};

// ── Audio (Media Library / raw URL + HTML5 player) ───────────────────

export type AudioAlignment = 'left' | 'center' | 'right' | 'none';

export type AudioPreload = 'none' | 'metadata' | 'auto';

/**
 * The audio asset. `url` is the value to render as-is — the editor stores the
 * backend-prefixed URL for Media-Library assets (same as `image`/`button`), so
 * the renderer must **not** re-prefix it. `id` is absent when the block was
 * inserted from a raw URL; every other key is optional.
 */
export type AudioFile = {
  id?: number;
  url: string;
  name?: string;
  ext?: string;
  hash?: string;
  mime?: string;
  /** Bytes. */
  size?: number;
  /** `local` | `cloudinary` | … */
  provider?: string;
  /** Seconds. Optional — not populated by Strapi Upload today. */
  duration?: number;
};

/** Native `<audio>` player flags, mapped 1:1 to element attributes. */
export type AudioPlayer = {
  autoplay?: boolean;
  loop?: boolean;
  /** Defaults to `true`. */
  controls?: boolean;
  preload?: AudioPreload;
};

export type AudioNode = {
  type: 'audio';
  file: AudioFile;
  title?: string;
  caption?: string;
  player?: AudioPlayer;
  /** `left` | `center` (default) | `right` | `none` (full-width, inline flow). */
  alignment?: AudioAlignment;
  /** Void-node placeholder emitted by the editor — ignored when rendering. */
  children?: [{ type: 'text'; text: '' }];
};

// ── Embed & Video (shared layout) ────────────────────────────────────

/** `left` / `center` (default) / `right` position the box; `none` = full-width. */
export type MediaAlignment = 'left' | 'center' | 'right' | 'none';

/**
 * Named aspect ratios plus `custom`. Named values convert `"16:9"` → `16 / 9`;
 * `custom` uses `customAspectRatio` verbatim (already in `W / H` form).
 */
export type MediaAspectRatio = '16:9' | '21:9' | '4:3' | '1:1' | 'custom';

// ── Embed (generic iframe / URL) ─────────────────────────────────────

export type EmbedProvider =
  | 'youtube'
  | 'vimeo'
  | 'loom'
  | 'wistia'
  | 'dailymotion'
  | 'api-video'
  | 'generic';

/**
 * Generic third-party embed (YouTube, Vimeo, Loom, …). `embedHtml` is the only
 * field needed to render — it is sanitized plugin-side (rebuilt from an
 * attribute allowlist over an https-only `src`, with scripts, event handlers,
 * inline styles and unknown attributes stripped) and emitted verbatim via
 * `set:html`. `url` / `iframe` exist only to round-trip the editor UI.
 */
export type EmbedNode = {
  type: 'embed';
  /** Which input the author used — `"url"` or `"iframe"`. */
  source?: 'url' | 'iframe';
  /** Present when `source` is `"url"` — the pasted watch URL. Ignored when rendering. */
  url?: string;
  /** Present when `source` is `"iframe"` — the raw paste. Ignored when rendering. */
  iframe?: string;
  /** Sanitized `<iframe>` markup — the value to render. */
  embedHtml: string;
  /** The `src` of the sanitized iframe (informational). */
  embedSrc?: string;
  provider?: EmbedProvider;
  thumbnail?: string;
  aspectRatio?: MediaAspectRatio;
  /** Used verbatim when `aspectRatio` is `"custom"` (e.g. `"3 / 2"`). */
  customAspectRatio?: string;
  alignment?: MediaAlignment;
  caption?: string;
  title?: string;
  /** Void-node placeholder emitted by the editor — ignored when rendering. */
  children?: [{ type: 'text'; text: '' }];
};

// ── Video (provider-aware) ───────────────────────────────────────────

export type VideoProvider = 'local' | 'mux' | 'api-video' | 'cloudinary' | 'custom';

/** The video asset when sourced from the Media Library. `url` renders as-is. */
export type VideoFile = {
  id?: number;
  url?: string;
  name?: string;
  ext?: string;
  mime?: string;
  /** Bytes. */
  size?: number;
  /** Seconds. */
  duration?: number;
  /** `local` | `cloudinary` | … */
  provider?: string;
};

/** Native `<video>` player flags, mapped 1:1 to element attributes. */
export type VideoPlayer = {
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Defaults to `true`. */
  controls?: boolean;
};

/**
 * Provider-aware video. Direct file URLs (`local` / `custom`, or a Media-Library
 * `file`) render as a native `<video>`. HLS/DASH sources (`url` ending `.m3u8` /
 * `.mpd`, e.g. Mux) only play natively in Safari — this renderer emits the same
 * native `<video>` (poster + a graceful fallback link elsewhere); override the
 * `video` block to plug in a cross-browser player (`mux-player`, `hls.js`, …).
 */
export type VideoNode = {
  type: 'video';
  provider: VideoProvider;
  /** Direct/stream URL. Preferred source; for Mux, derivable from `playbackId`. */
  url?: string;
  assetId?: string;
  /** Mux public playback id — enough to stream a public-policy asset. */
  playbackId?: string;
  file?: VideoFile;
  poster?: string;
  title?: string;
  caption?: string;
  /** URL of a WebVTT captions file — rendered as a `<track kind="captions">`. */
  transcript?: string;
  player?: VideoPlayer;
  alignment?: MediaAlignment;
  aspectRatio?: MediaAspectRatio;
  /** Used verbatim when `aspectRatio` is `"custom"` (e.g. `"3 / 2"`). */
  customAspectRatio?: string;
  /** Void-node placeholder emitted by the editor — ignored when rendering. */
  children?: [{ type: 'text'; text: '' }];
};

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | ListNode
  | QuoteNode
  | CodeNode
  | ImageNode
  | HorizontalLineNode
  | TableNode
  | MediaEmbedNode
  | MathNode
  | DiagramNode
  | CalloutNode
  | DetailsNode
  | ButtonElement
  | SocialEmbedNode
  | AudioNode
  | EmbedNode
  | VideoNode;

export type BlocksContent = BlockNode[];

// ── Style ────────────────────────────────────────────────────────────

/**
 * Inline style value accepted by Astro elements — either a CSS string or a
 * record of property/value pairs (Astro serializes the object to a string).
 */
export type StyleValue = string | Record<string, string | number | undefined>;

// ── Custom Renderers Config ──────────────────────────────────────────

/**
 * Any Astro component — the default export of a `.astro` file (or any
 * framework component Astro can render). Custom renderers receive their props
 * via `Astro.props` and their inner content via the default `<slot />`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AstroComponentFactory = (...args: any[]) => any;

/**
 * Map of block type → custom Astro component. Each component receives the props
 * documented below plus, where applicable, its rendered children via `<slot />`.
 *
 * - `paragraph` — `{ style?: StyleValue }`
 * - `heading` — `{ level: 1 | 2 | 3 | 4 | 5 | 6; style?: StyleValue }`
 * - `list` — `{ format: 'ordered' | 'unordered' | 'todo'; indentLevel: number }`
 * - `list-item` — `{ checked?: boolean }`
 * - `link` — `{ url: string; target?: string; rel?: string }`
 * - `quote` — `{ style?: StyleValue }`
 * - `code` — `{ plainText: string; language?: string }` (also available via `<slot />`)
 * - `image` — `{ image; caption?: string; imageAlign?: 'left' | 'center' | 'right' }`
 * - `horizontal-line` — no props
 * - `table` / `table-row` — children via `<slot />`
 * - `table-cell` / `table-header-cell` — `{ align?; colSpan?; rowSpan? }` (children via `<slot />`)
 * - `media-embed` — `{ url: string; originalUrl?: string }`
 * - `math` — `{ formula: string; inline: boolean }`
 * - `diagram` — `{ code: string; format: 'mermaid' }`
 * - `callout` — `{ variant: CalloutVariant; title?: string }` (children via `<slot />`)
 * - `details` — `{ summary: string; defaultOpen?: boolean }` (children via `<slot />`)
 * - `button` — `{ label; buttonType; alignment?; link?; file?; showFileSize?; showFileIcon?; style?; cssClass? }`
 * - `social-embed` — `{ platform; url; embedCode?; oembed?; alignment?; caption? }`
 * - `audio` — `{ file; title?; caption?; player?; alignment? }`
 * - `embed` — `{ embedHtml; embedSrc?; provider?; thumbnail?; aspectRatio?; customAspectRatio?; alignment?; caption?; title? }`
 * - `video` — `{ provider; url?; playbackId?; assetId?; file?; poster?; title?; caption?; transcript?; player?; alignment?; aspectRatio?; customAspectRatio? }`
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
 * - `color` — `{ color: string }`
 * - `backgroundColor` — `{ backgroundColor: string }`
 * - `fontFamily` — `{ fontFamily: string }`
 * - `fontSize` — `{ fontSize: string }`
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

// ── Component Props ──────────────────────────────────────────────────

export type BlocksRendererProps = {
  content: BlocksContent;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  /**
   * Color theme for `diagram` (Mermaid) blocks. Defaults to `github-light`.
   * Ignored when a custom `diagram` renderer is supplied via `blocks.diagram`.
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
   * Adds a client-side "Copy" button to default `code` blocks. Off by default
   * to keep the output zero-JavaScript; when `true`, a small script is bundled
   * to wire up the buttons. Ignored when a custom `code` renderer is supplied.
   */
  codeCopyButton?: boolean;
};
