import type { ReactNode, ComponentType, CSSProperties } from 'react';

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

export type TableCellNode = {
  type: 'table-cell';
  children: InlineNode[];
};

export type TableHeaderCellNode = {
  type: 'table-header-cell';
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

export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest';

export type SocialEmbedAlignment = 'left' | 'center' | 'right';

export type SocialEmbedOembed = {
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
  /** Absent when the author saved a manual `embedCode` without a source URL. */
  url?: string;
  /** Author-pasted manual override, takes priority over `oembed.html`. */
  embedCode?: string;
  /** Fetched server-side by the plugin at author time. */
  oembed?: SocialEmbedOembed;
  alignment?: SocialEmbedAlignment;
  caption?: string;
  children?: [{ type: 'text'; text: '' }];
};

export type AudioAlignment = 'left' | 'center' | 'right' | 'none';

export type AudioPreload = 'none' | 'metadata' | 'auto';

export type AudioFile = {
  /** Media Library file id — absent when inserted from a raw URL. */
  id?: number;
  /** Direct URL to render — already backend-prefixed for Media-Library assets. */
  url: string;
  name?: string;
  ext?: string;
  hash?: string;
  mime?: string;
  /** Size in bytes. */
  size?: number;
  provider?: string;
  /** Optional duration in seconds — not populated by Strapi Upload today. */
  duration?: number;
};

export type AudioPlayer = {
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: AudioPreload;
};

export type AudioNode = {
  type: 'audio';
  file: AudioFile;
  title?: string;
  caption?: string;
  player: AudioPlayer;
  alignment?: AudioAlignment;
  children?: [{ type: 'text'; text: '' }];
};

// ── Embed & Video (shared) ───────────────────────────────────────────

/** Alignment shared by the `embed` and `video` blocks. `none` flows full-width. */
export type MediaAlignment = 'left' | 'center' | 'right' | 'none';

/** Maps to CSS `aspect-ratio`; `custom` defers to `customAspectRatio`. */
export type AspectRatio = '16:9' | '21:9' | '4:3' | '1:1' | 'custom';

export type EmbedProvider =
  | 'youtube'
  | 'vimeo'
  | 'loom'
  | 'wistia'
  | 'dailymotion'
  | 'api-video'
  | 'generic';

/**
 * Generic embed — a share URL the plugin turned into an iframe, or a raw
 * snippet the author pasted. Either way `embedHtml` is the sanitized,
 * ready-to-render markup; `url` / `iframe` only round-trip the editor UI.
 */
export type EmbedNode = {
  type: 'embed';
  /** Which input the author used. Drives which of `url` / `iframe` is set. */
  source?: 'url' | 'iframe';
  /** Original share URL (`source: 'url'`). */
  url?: string;
  /** Raw snippet exactly as pasted (`source: 'iframe'`). */
  iframe?: string;
  /** Sanitized iframe markup — the only field needed to render. */
  embedHtml?: string;
  /** The `src` of `embedHtml`, hoisted so renderers can check the host. */
  embedSrc?: string;
  provider?: EmbedProvider;
  /** Poster image, when the provider exposes one without an API call. */
  thumbnail?: string;
  aspectRatio?: AspectRatio;
  /** Free-form `width / height`, used when `aspectRatio` is `custom`. */
  customAspectRatio?: string;
  alignment?: MediaAlignment;
  caption?: string;
  /** Accessible name — already baked into `embedHtml` for URL-derived embeds. */
  title?: string;
  children?: [{ type: 'text'; text: '' }];
};

export type VideoProvider = 'local' | 'mux' | 'api-video' | 'cloudinary' | 'custom';

/** Player behaviour flags, mirrored onto the HTML5 `<video>` element. */
export type VideoPlayer = {
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
};

/** Media Library metadata, present when the source is an uploaded asset. */
export type VideoFile = {
  id?: number;
  name?: string;
  ext?: string;
  mime?: string;
  /** Size in bytes. */
  size?: number;
  /** Duration in seconds, when the provider reports it. */
  duration?: number;
  provider?: string;
};

export type VideoNode = {
  type: 'video';
  provider?: VideoProvider;
  /** Playback URL: an HLS/DASH manifest, or a direct file URL for `local`. */
  url: string;
  /** Provider's asset identifier (Mux asset id, api.video video id, …). */
  assetId?: string;
  /** Provider's playback identifier (Mux playback id). */
  playbackId?: string;
  file?: VideoFile;
  /** Thumbnail shown before playback. */
  poster?: string;
  title?: string;
  caption?: string;
  /** URL of a WebVTT track for captions/transcript. */
  transcript?: string;
  player?: VideoPlayer;
  alignment?: MediaAlignment;
  aspectRatio?: AspectRatio;
  customAspectRatio?: string;
  children?: [{ type: 'text'; text: '' }];
};

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
   * File mode only. When `true`, the file opens in a new tab for preview
   * instead of downloading. When `false`/omitted, the file is force-downloaded
   * (even when hosted cross-origin, where the native `download` attribute is
   * ignored by browsers).
   */
  filePreview?: boolean;
  style?: ButtonStyle;
  cssClass?: string;
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

// ── Modifier (Mark) Props ────────────────────────────────────────────

export type ModifierProps = {
  children: ReactNode;
};

export type ColorModifierProps = {
  children: ReactNode;
  color: string;
};

export type BackgroundColorModifierProps = {
  children: ReactNode;
  backgroundColor: string;
};

// ── Block Component Props ────────────────────────────────────────────

export type BlockComponentProps<T = Record<string, unknown>> = T & {
  children: ReactNode;
};

// ── Custom Renderers Config ──────────────────────────────────────────

export type CustomBlocksConfig = Partial<{
  paragraph: ComponentType<BlockComponentProps<{ style?: CSSProperties }>>;
  heading: ComponentType<
    BlockComponentProps<{ level: 1 | 2 | 3 | 4 | 5 | 6; style?: CSSProperties }>
  >;
  list: ComponentType<
    BlockComponentProps<{ format: 'ordered' | 'unordered' | 'todo'; indentLevel: number }>
  >;
  'list-item': ComponentType<BlockComponentProps<{ checked?: boolean }>>;
  link: ComponentType<BlockComponentProps<{ url: string; target?: string; rel?: string }>>;
  quote: ComponentType<BlockComponentProps<{ style?: CSSProperties }>>;
  code: ComponentType<BlockComponentProps<{ plainText: string }>>;
  image: ComponentType<{
    image: { url: string; alternativeText?: string | null; width?: number; height?: number };
    caption?: string;
    imageAlign?: 'left' | 'center' | 'right';
    children?: ReactNode;
  }>;
  'horizontal-line': ComponentType<Record<string, unknown>>;
  table: ComponentType<BlockComponentProps>;
  'table-row': ComponentType<BlockComponentProps>;
  'table-cell': ComponentType<BlockComponentProps>;
  'table-header-cell': ComponentType<BlockComponentProps>;
  'media-embed': ComponentType<{ url: string; originalUrl?: string }>;
  math: ComponentType<{ formula: string; inline: boolean }>;
  diagram: ComponentType<{ code: string; format: 'mermaid' }>;
  callout: ComponentType<BlockComponentProps<{ variant: CalloutVariant; title?: string }>>;
  details: ComponentType<BlockComponentProps<{ summary: string; defaultOpen?: boolean }>>;
  button: ComponentType<{
    label: string;
    buttonType: 'link' | 'file';
    alignment?: ButtonAlignment;
    link?: ButtonLink;
    file?: ButtonFile;
    showFileSize?: boolean;
    showFileIcon?: boolean;
    filePreview?: boolean;
    style?: ButtonStyle;
    cssClass?: string;
  }>;
  'social-embed': ComponentType<{
    platform: SocialPlatform;
    url?: string;
    embedCode?: string;
    oembed?: SocialEmbedOembed;
    alignment?: SocialEmbedAlignment;
    caption?: string;
  }>;
  audio: ComponentType<{
    file: AudioFile;
    title?: string;
    caption?: string;
    player: AudioPlayer;
    alignment?: AudioAlignment;
  }>;
  embed: ComponentType<{
    source?: 'url' | 'iframe';
    url?: string;
    iframe?: string;
    embedHtml?: string;
    embedSrc?: string;
    provider?: EmbedProvider;
    thumbnail?: string;
    aspectRatio?: AspectRatio;
    customAspectRatio?: string;
    alignment?: MediaAlignment;
    caption?: string;
    title?: string;
  }>;
  video: ComponentType<{
    provider?: VideoProvider;
    url: string;
    assetId?: string;
    playbackId?: string;
    file?: VideoFile;
    poster?: string;
    title?: string;
    caption?: string;
    transcript?: string;
    player?: VideoPlayer;
    alignment?: MediaAlignment;
    aspectRatio?: AspectRatio;
    customAspectRatio?: string;
  }>;
}>;

export type FontFamilyModifierProps = {
  children: ReactNode;
  fontFamily: string;
};

export type FontSizeModifierProps = {
  children: ReactNode;
  fontSize: string;
};

export type CustomModifiersConfig = Partial<{
  bold: ComponentType<ModifierProps>;
  italic: ComponentType<ModifierProps>;
  underline: ComponentType<ModifierProps>;
  strikethrough: ComponentType<ModifierProps>;
  code: ComponentType<ModifierProps>;
  uppercase: ComponentType<ModifierProps>;
  superscript: ComponentType<ModifierProps>;
  subscript: ComponentType<ModifierProps>;
  color: ComponentType<ColorModifierProps>;
  backgroundColor: ComponentType<BackgroundColorModifierProps>;
  fontFamily: ComponentType<FontFamilyModifierProps>;
  fontSize: ComponentType<FontSizeModifierProps>;
}>;

// ── Component Props ──────────────────────────────────────────────────

export type BlocksRendererProps = {
  content: BlocksContent;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
};
