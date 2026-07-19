import type { BaseElement, BaseText, Node, Descendant } from 'slate';

// Common interfaces
export interface Option {
  label: string;
  value: string;
  isDefault?: boolean;
}

export interface FontSetting {
  breakpoint: string;
  fontSize: string | null;
  fontLeading: string | null;
  fontAlignment: string | null;
  fontTracking: string | null;
}

export interface SeparatorSetting {
  breakpoint: string;
  separatorSize: number | null;
  separatorOrientation: 'horizontal' | 'vertical' | null;
  separatorLength: number | null;
}

export interface ImageSetting {
  breakpoint: string;
  imageWidth: string | null;
  imageHeight: string | null;
  imageAspectRatioLocked?: boolean;
}

// Base element types
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface CustomElement extends BaseElement {
  type: string;
  fontFamily?: string;
  fontColor?: string;
  fontSettings?: FontSetting[];
  textAlign?: TextAlign;
  separatorStyle?: string;
  separatorColor?: string;
  separatorSettings?: SeparatorSetting[];
  imageSettings?: ImageSetting[];
  [key: string]: unknown;
}

export interface CustomText extends BaseText {
  type: 'text';
  text: string;
  color?: string;
  backgroundColor?: string;
}

// Specific element types
export interface LinkNode extends CustomElement {
  type: 'link';
  url: string;
  target?: '_blank' | '_self';
  rel?: string;
  children: Descendant[];
}

export interface ListNode extends CustomElement {
  type: 'list';
  format: 'ordered' | 'unordered' | 'todo';
  indentLevel: number;
  children: Descendant[];
}

export interface HeadingElement extends CustomElement {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: CustomText[];
}

export interface ImageElement extends CustomElement {
  type: 'image';
  image: {
    url: string;
    alternativeText?: string;
    width?: number;
    height?: number;
    formats?: Record<string, any>;
    hash?: string;
    ext?: string;
    mime?: string;
    size?: number;
    previewUrl?: string;
  };
  imageSettings?: ImageSetting[];
  children: CustomText[];
}

export type AudioAlignment = 'left' | 'center' | 'right' | 'none';
export type AudioPreload = 'none' | 'metadata' | 'auto';

/** Player behaviour flags, mirrored 1:1 onto the HTML5 `<audio>` element. */
export interface AudioPlayerSettings {
  autoplay: boolean;
  loop: boolean;
  controls: boolean;
  preload: AudioPreload;
}

/**
 * Audio block. A void block referencing a Strapi Media Library asset (or an
 * external URL). Stores the file metadata plus a display title, caption, player
 * behaviour flags and alignment. The frontend renderer turns this into a native
 * HTML5 `<audio>` player — see issue #43 for the renderer contract.
 */
export interface AudioElement extends CustomElement {
  type: 'audio';
  file: {
    /** Strapi Media Library file id (absent when inserted from a raw URL). */
    id?: number;
    /** Direct URL to the audio file (absolute, backend-prefixed when local). */
    url: string;
    name?: string;
    ext?: string;
    hash?: string;
    mime?: string;
    /** File size in bytes. */
    size?: number;
    /** Duration in seconds (optional; read from the player when available). */
    duration?: number;
    /** Upload provider: local | cloudinary | etc. */
    provider?: string;
  };
  title?: string;
  caption?: string;
  player: AudioPlayerSettings;
  alignment: AudioAlignment;
  children: CustomText[];
}

export const isAudioNode = (
  element: CustomElement
): element is AudioElement => {
  return element.type === 'audio';
};

export interface MathElement extends CustomElement {
  type: 'math';
  format: 'inline' | 'block';
  value: string;
  children: CustomText[];
}

export interface DiagramElement extends CustomElement {
  type: 'diagram';
  format: 'mermaid';
  value: string;
  children: CustomText[];
}

export type CalloutVariant =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution';

export interface CalloutElement extends CustomElement {
  type: 'callout';
  variant: CalloutVariant;
  title?: string;
  children: Descendant[];
}

export interface DetailsElement extends CustomElement {
  type: 'details';
  /** Plain-text label shown in the disclosure header (the <summary>) */
  summary: string;
  /** When true the section is expanded by default (maps to the HTML `open` attribute) */
  defaultOpen?: boolean;
  /** Per-block style override; falls back to the field/global config when unset */
  style?: 'github' | 'custom';
  /** Block-level content shown when the section is expanded */
  children: Descendant[];
}

export type ButtonAlignment = 'left' | 'center' | 'right';
export type ButtonMode = 'link' | 'file';
export type ButtonLinkTarget = '_self' | '_blank' | '_parent' | '_top';
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'filled'
  | 'custom';

export interface ButtonStyle {
  /**
   * Selected style preset. Switches to "custom" once the author overrides the
   * preset's colors or border. Frontend renderers can ignore this.
   */
  variant?: ButtonVariant;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  padding?: string;
  border?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
}

/** Color/border values a preset applies (the rest of the styling stays as-is). */
export interface ButtonPreset {
  backgroundColor?: string;
  textColor?: string;
  border?: string;
}

export type ButtonPresets = Partial<
  Record<Exclude<ButtonVariant, 'custom'>, ButtonPreset>
>;

export interface ButtonLink {
  url: string;
  target?: ButtonLinkTarget;
  /** Auto-set to "noopener noreferrer" when target is "_blank". */
  rel?: string;
  ariaLabel?: string;
}

export interface ButtonFile {
  /** Strapi Media Library file id (when picked from the library). */
  id?: number;
  url: string;
  name: string;
  /** File size in bytes. */
  size?: number;
  /** File extension, e.g. ".pdf". */
  ext?: string;
  mime?: string;
}

/**
 * WordPress-style call-to-action button. A void block: its visual form is the
 * stored data (text + link/file + inline style), not editable rich text.
 */
export interface ButtonElement extends CustomElement {
  type: 'button';
  /** "link" → hyperlink, "file" → Media Library download. */
  buttonType: ButtonMode;
  /**
   * Visible button label. NOTE: must not be named `text` — Slate treats any node
   * with a string `text` property as a Text leaf, which would break this element.
   */
  label: string;
  alignment: ButtonAlignment;
  link?: ButtonLink;
  file?: ButtonFile;
  /** File mode: show the human-readable file size next to the label. */
  showFileSize?: boolean;
  /** File mode: show a file-type icon next to the label. */
  showFileIcon?: boolean;
  /**
   * File mode: when true, open the file in a new tab (preview) instead of
   * forcing a download. Renderers map this to `target="_blank"` vs `download`.
   */
  filePreview?: boolean;
  style?: ButtonStyle;
  /** Optional custom CSS class for frontend theming. */
  cssClass?: string;
  children: CustomText[];
}

/* ---------------------------------------------------------------------------
 * Table blocks
 * -------------------------------------------------------------------------*/

/**
 * Horizontal alignment of a table cell's content. Absent means `left`, so
 * documents authored before alignment existed need no migration.
 */
export type TableCellAlign = 'left' | 'center' | 'right';

export interface TableCellElement extends CustomElement {
  type: 'table-cell' | 'table-header-cell';
  align?: TableCellAlign;
  /** Inline content: text leaves, links, inline math, … */
  children: Descendant[];
}

export interface TableRowElement extends CustomElement {
  type: 'table-row';
  children: TableCellElement[];
}

export interface TableElement extends CustomElement {
  type: 'table';
  children: TableRowElement[];
}

export const isTableCellNode = (
  element: CustomElement
): element is TableCellElement =>
  element.type === 'table-cell' || element.type === 'table-header-cell';

export type Block<T extends string> = Extract<Node, { type: T }>;

// Utility functions
export const getEntries = <T extends object>(object: T) =>
  Object.entries(object) as [keyof T, T[keyof T]][];

export const getKeys = <T extends object>(object: T) =>
  Object.keys(object) as (keyof T)[];

export const isLinkNode = (element: CustomElement): element is LinkNode => {
  return element.type === 'link';
};

export const isListNode = (element: CustomElement): element is ListNode => {
  return element.type === 'list';
};

export const isMathNode = (element: CustomElement): element is MathElement => {
  return element.type === 'math';
};

export const isDiagramNode = (
  element: CustomElement
): element is DiagramElement => {
  return element.type === 'diagram';
};

export const isCalloutNode = (
  element: CustomElement
): element is CalloutElement => {
  return element.type === 'callout';
};

export const isDetailsNode = (
  element: CustomElement
): element is DetailsElement => {
  return element.type === 'details';
};

export const isButtonNode = (
  element: CustomElement
): element is ButtonElement => {
  return element.type === 'button';
};

/** Social platforms supported by the social-embed block. */
export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest';

export type SocialAlignment = 'left' | 'center' | 'right';

/**
 * Normalised oEmbed payload fetched from the platform via the plugin's server
 * oEmbed proxy (`GET /better-blocks/oembed`). Stored on the node so the frontend
 * renderer can render the embed without itself calling the platform at runtime.
 */
export interface SocialOEmbed {
  /** Platform-provided embed HTML (blockquote / iframe). */
  html?: string;
  title?: string;
  author?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  providerName?: string;
  width?: number;
  height?: number;
}

/**
 * Social media embed. A void block: it stores the post URL + platform plus the
 * oEmbed payload fetched server-side at author time. The frontend renderer turns
 * that into the platform's official embed widget. An optional `embedCode` lets
 * authors paste a platform embed snippet to override URL-based rendering.
 */
export interface SocialEmbedElement extends CustomElement {
  type: 'social-embed';
  platform: SocialPlatform;
  /** Canonical URL of the social post. */
  url: string;
  /** Optional pasted embed snippet (overrides URL-based rendering). */
  embedCode?: string;
  /** oEmbed metadata fetched from the platform via the server proxy. */
  oembed?: SocialOEmbed;
  alignment: SocialAlignment;
  caption?: string;
  children: CustomText[];
}

export const isSocialEmbedNode = (
  element: CustomElement
): element is SocialEmbedElement => {
  return element.type === 'social-embed';
};

/* ---------------------------------------------------------------------------
 * Embed & video blocks
 * -------------------------------------------------------------------------*/

/** Shared by the embed and video blocks; maps to CSS `aspect-ratio`. */
export type AspectRatio = '16:9' | '21:9' | '4:3' | '1:1' | 'custom';

export type MediaAlignment = 'left' | 'center' | 'right' | 'none';

/**
 * Providers the embed block can derive an iframe for from a share URL.
 * `generic` covers anything pasted as raw embed code.
 */
export type EmbedProvider =
  | 'youtube'
  | 'vimeo'
  | 'loom'
  | 'wistia'
  | 'dailymotion'
  | 'api-video'
  | 'generic';

/**
 * Generic embed. A void block holding either a share URL the plugin knows how
 * to turn into an iframe, or a raw embed snippet the author pasted. In both
 * cases `embedHtml` is the sanitized, ready-to-render iframe markup, so a
 * frontend renderer never has to re-derive or re-sanitize anything.
 *
 * Supersedes the legacy `media-embed` block (YouTube/Vimeo only).
 */
export interface EmbedElement extends CustomElement {
  type: 'embed';
  /** Which input the author used. Drives which of `url`/`iframe` is set. */
  source: 'url' | 'iframe';
  /** Original share URL (source: 'url'). */
  url?: string;
  /** Raw snippet exactly as pasted, kept for round-tripping the editor UI. */
  iframe?: string;
  /**
   * Sanitized iframe markup to render. Always present once the block has a
   * source — renderers should output this and ignore `url`/`iframe`.
   */
  embedHtml?: string;
  /** The `src` of `embedHtml`, hoisted so renderers can check the host. */
  embedSrc?: string;
  /** Auto-detected from the URL; `generic` for pasted embed codes. */
  provider?: EmbedProvider;
  /** Poster image, when the provider exposes one without an API call. */
  thumbnail?: string;
  aspectRatio: AspectRatio;
  /** Free-form `width / height` used when `aspectRatio` is 'custom'. */
  customAspectRatio?: string;
  alignment: MediaAlignment;
  caption?: string;
  /** Accessible name applied to the iframe's `title` attribute. */
  title?: string;
  children: CustomText[];
}

export const isEmbedNode = (element: CustomElement): element is EmbedElement =>
  element.type === 'embed';

/** Video hosting providers the video block understands. */
export type VideoProvider =
  | 'local'
  | 'mux'
  | 'api-video'
  | 'cloudinary'
  | 'custom';

/** Player behaviour flags, mirrored onto the HTML5 `<video>` element. */
export interface VideoPlayerSettings {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
}

/**
 * Provider-aware video block. Holds a playable source (a Media Library asset,
 * a provider playback id, or a direct URL) plus display and player settings.
 *
 * NOTE: player flags are nested under `player` rather than sitting at the top
 * level as issue #44 proposed, to match the sibling `audio` block — one shape
 * for renderers to learn, not two.
 */
export interface VideoElement extends CustomElement {
  type: 'video';
  provider: VideoProvider;
  /** Provider's asset identifier (Mux asset id, api.video video id, …). */
  assetId?: string;
  /** Provider's playback identifier (Mux playback id). */
  playbackId?: string;
  /** Playback URL: HLS/DASH manifest, or a direct file URL for `local`. */
  url: string;
  /** Media Library metadata, present when the source is an uploaded asset. */
  file?: {
    id?: number;
    name?: string;
    ext?: string;
    mime?: string;
    /** File size in bytes. */
    size?: number;
    /** Duration in seconds, when the provider reports it. */
    duration?: number;
    provider?: string;
  };
  /** Thumbnail shown before playback. */
  poster?: string;
  title?: string;
  caption?: string;
  /** URL of a WebVTT track for captions/transcript. */
  transcript?: string;
  player: VideoPlayerSettings;
  alignment: MediaAlignment;
  aspectRatio: AspectRatio;
  customAspectRatio?: string;
  children: CustomText[];
}

export const isVideoNode = (element: CustomElement): element is VideoElement =>
  element.type === 'video';
