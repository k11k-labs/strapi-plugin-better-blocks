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
  url: string;
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
  | AudioNode;

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
    url: string;
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
