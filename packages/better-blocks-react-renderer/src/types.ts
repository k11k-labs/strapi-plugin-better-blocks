import type { ComponentType, CSSProperties, ReactNode } from 'react';

import type {
  AspectRatio,
  AudioAlignment,
  AudioFile,
  AudioNode,
  AudioPlayer,
  AudioPreload,
  BlockNode,
  BlockStyle,
  BlocksContent,
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
} from '@k11k/better-blocks-core';

/**
 * The document types come from `@k11k/better-blocks-core`, which both renderers
 * share so they cannot drift apart again. They are re-exported here so existing
 * imports from this package keep resolving.
 *
 * What stays local is the React component surface: the props custom block and
 * modifier components receive.
 */
export type {
  AspectRatio,
  AudioAlignment,
  AudioFile,
  AudioNode,
  AudioPlayer,
  AudioPreload,
  BlockNode,
  BlockStyle,
  BlocksContent,
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
} from '@k11k/better-blocks-core';

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

/** Props handed to custom `table-cell` / `table-header-cell` components. */
export type TableCellRenderProps = {
  align?: TableCellAlign;
  colSpan?: number;
  rowSpan?: number;
  /** `text-align` derived from `align`; undefined when the cell is left-aligned. */
  style?: CSSProperties;
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
  code: ComponentType<BlockComponentProps<{ plainText: string; language?: string }>>;
  image: ComponentType<{
    image: { url: string; alternativeText?: string | null; width?: number; height?: number };
    caption?: string;
    imageAlign?: 'left' | 'center' | 'right';
    children?: ReactNode;
  }>;
  'horizontal-line': ComponentType<Record<string, unknown>>;
  table: ComponentType<BlockComponentProps>;
  'table-row': ComponentType<BlockComponentProps>;
  'table-cell': ComponentType<BlockComponentProps<TableCellRenderProps>>;
  'table-header-cell': ComponentType<BlockComponentProps<TableCellRenderProps>>;
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
