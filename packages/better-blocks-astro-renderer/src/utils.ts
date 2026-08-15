import type {
  ButtonFile,
  ButtonStyle,
  InlineNode,
  SocialEmbedNode,
  SocialPlatform,
  StyleValue,
  TextNode,
} from './types';

// ── Block Style ──────────────────────────────────────────────────────

/**
 * Builds the inline style object for a block that supports alignment,
 * line-height, and indentation. Returns `undefined` when no style applies so
 * the element renders without a `style` attribute.
 */
export function getBlockStyle(block: {
  textAlign?: string;
  lineHeight?: string;
  indent?: number;
}): StyleValue | undefined {
  const style: Record<string, string> = {};
  if (block.textAlign) style.textAlign = block.textAlign;
  if (block.lineHeight) style.lineHeight = block.lineHeight;
  if (block.indent) style.marginLeft = `${block.indent * 2}rem`;
  return Object.keys(style).length > 0 ? style : undefined;
}

// ── Plain Text Extraction ────────────────────────────────────────────

export function getPlainText(children: InlineNode[]): string {
  return children
    .map((child) => {
      if (child.type === 'text') return child.text;
      if (child.type === 'link') return child.children.map((t) => t.text).join('');
      return '';
    })
    .join('');
}

// ── Code Language Normalization ──────────────────────────────────────

/**
 * The languages the Better Blocks editor can attach to a `code` block. Every
 * value here maps to a Shiki grammar (directly or via {@link CODE_LANG_ALIASES}),
 * so Astro's `<Code>` never receives a name it can't highlight.
 */
const CODE_LANGUAGES = new Set([
  'asm',
  'bash',
  'c',
  'clojure',
  'cobol',
  'cpp',
  'csharp',
  'css',
  'dart',
  'dockerfile',
  'elixir',
  'erlang',
  'fortran',
  'fsharp',
  'go',
  'graphql',
  'groovy',
  'haskell',
  'haxe',
  'html',
  'ini',
  'java',
  'javascript',
  'jsx',
  'json',
  'julia',
  'kotlin',
  'latex',
  'lua',
  'markdown',
  'matlab',
  'makefile',
  'objectivec',
  'perl',
  'php',
  'plaintext',
  'powershell',
  'python',
  'r',
  'ruby',
  'rust',
  'sas',
  'scala',
  'scheme',
  'shell',
  'sql',
  'stata',
  'swift',
  'typescript',
  'tsx',
  'vbnet',
  'xml',
  'yaml',
]);

/**
 * Editor language values (and a few common shorthands) whose Shiki grammar id
 * differs from the stored value. Anything not covered here is passed through
 * unchanged when it's a known language, or falls back to `plaintext`.
 */
const CODE_LANG_ALIASES: Record<string, string> = {
  fortran: 'fortran-free-form',
  objectivec: 'objective-c',
  vbnet: 'vb',
  ts: 'typescript',
  yml: 'yaml',
  shell: 'bash',
};

/**
 * Resolves a `code` block's `language` to a Shiki grammar name safe to pass to
 * Astro's `<Code>` component. Unknown or missing languages become `plaintext`
 * (rendered themed but unhighlighted) so a stray value never breaks the build.
 */
export function normalizeCodeLang(language?: string): string {
  if (!language) return 'plaintext';
  const lang = language.toLowerCase();
  const resolved = CODE_LANGUAGES.has(lang) ? lang : undefined;
  const alias = CODE_LANG_ALIASES[lang];
  if (alias) return alias;
  return resolved ?? 'plaintext';
}

// ── List Style Cycling ───────────────────────────────────────────────

const orderedStyles = ['decimal', 'lower-alpha', 'upper-roman'];
const unorderedStyles = ['disc', 'circle', 'square'];

export function getListStyleType(format: 'ordered' | 'unordered', indentLevel: number): string {
  const styles = format === 'ordered' ? orderedStyles : unorderedStyles;
  return styles[indentLevel % styles.length];
}

// ── Embed / Video Layout ─────────────────────────────────────────────

/**
 * `justify-content` for the flex wrapper that positions an embed/video box:
 * `left`/`center`/`right` → `flex-start`/`center`/`flex-end`; `none` stretches
 * the box to the full column width.
 */
export const MEDIA_JUSTIFY: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
  none: 'stretch',
};

/**
 * CSS `aspect-ratio` value from an editor aspect-ratio choice. Named ratios
 * convert `"16:9"` → `16 / 9`; `"custom"` uses `customAspectRatio` verbatim
 * (already in `W / H` form). Anything missing or empty falls back to `16 / 9`.
 */
export function getAspectRatio(aspectRatio?: string, customAspectRatio?: string): string {
  if (aspectRatio === 'custom') return customAspectRatio?.trim() || '16 / 9';
  if (aspectRatio?.includes(':')) return aspectRatio.replace(':', ' / ');
  return aspectRatio?.trim() || '16 / 9';
}

// ── Text Modifiers (Marks) ───────────────────────────────────────────

export type Mark = { name: string; value?: string };

/**
 * Returns the active marks for a text node in outer → inner order. This mirrors
 * the React renderer, which applies modifiers inside-out (`fontSize` ends up the
 * outermost wrapper and `code` the innermost), so the visual nesting matches.
 */
export function buildTextMarks(node: TextNode): Mark[] {
  const marks: Mark[] = [];
  if (node.fontSize) marks.push({ name: 'fontSize', value: node.fontSize });
  if (node.fontFamily) marks.push({ name: 'fontFamily', value: node.fontFamily });
  if (node.backgroundColor) marks.push({ name: 'backgroundColor', value: node.backgroundColor });
  if (node.color) marks.push({ name: 'color', value: node.color });
  if (node.bold) marks.push({ name: 'bold' });
  if (node.italic) marks.push({ name: 'italic' });
  if (node.uppercase) marks.push({ name: 'uppercase' });
  if (node.underline) marks.push({ name: 'underline' });
  if (node.strikethrough) marks.push({ name: 'strikethrough' });
  if (node.superscript) marks.push({ name: 'superscript' });
  if (node.subscript) marks.push({ name: 'subscript' });
  if (node.code) marks.push({ name: 'code' });
  return marks;
}

/**
 * The default HTML tag and inline style used to render a given mark when no
 * custom modifier component is supplied.
 */
export function getDefaultMarkRender(mark: Mark): { tag: string; style?: StyleValue } {
  switch (mark.name) {
    case 'code':
      return { tag: 'code' };
    case 'subscript':
      return { tag: 'sub' };
    case 'superscript':
      return { tag: 'sup' };
    case 'strikethrough':
      return { tag: 'del' };
    case 'underline':
      return { tag: 'span', style: { textDecoration: 'underline' } };
    case 'uppercase':
      return { tag: 'span', style: { textTransform: 'uppercase' } };
    case 'italic':
      return { tag: 'em' };
    case 'bold':
      return { tag: 'strong' };
    case 'color':
      return { tag: 'span', style: { color: mark.value } };
    case 'backgroundColor':
      return { tag: 'span', style: { backgroundColor: mark.value } };
    case 'fontFamily':
      return { tag: 'span', style: { fontFamily: mark.value } };
    case 'fontSize':
      return { tag: 'span', style: { fontSize: mark.value } };
    default:
      return { tag: 'span' };
  }
}

/**
 * The prop object passed to a custom modifier component for a given mark. Value
 * marks (color/background/font) forward their value; boolean marks pass nothing.
 */
export function getModifierProps(mark: Mark): Record<string, string> {
  if (mark.value === undefined) return {};
  return { [mark.name]: mark.value };
}

// ── Button (CTA / File Download) ─────────────────────────────────────

// Emoji icons keyed by file extension (falls back to a MIME-type group, then a
// generic paperclip). Mirrors the icon mapping in the editor's button modal.
const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  txt: '📃',
  md: '📃',
  rtf: '📃',
  xls: '📊',
  xlsx: '📊',
  csv: '📊',
  ppt: '📽️',
  pptx: '📽️',
  zip: '🗜️',
  rar: '🗜️',
  '7z': '🗜️',
  gz: '🗜️',
  tar: '🗜️',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  mp3: '🎵',
  wav: '🎵',
  ogg: '🎵',
  mp4: '🎬',
  mov: '🎬',
  avi: '🎬',
  webm: '🎬',
};

/** Emoji icon for a file, by extension then MIME group, with a generic fallback. */
export function getFileIcon(file: ButtonFile): string {
  const ext = (file.ext ?? '').replace(/^\./, '').toLowerCase();
  if (ext && FILE_ICONS[ext]) return FILE_ICONS[ext];

  const mime = file.mime ?? '';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.startsWith('video/')) return '🎬';
  if (mime === 'application/pdf') return '📄';
  return '📎';
}

/** Human-readable byte size, e.g. 5242880 → "5 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const rounded = i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

/**
 * Builds the inline style object for a button. Sensible defaults keep an
 * unstyled button looking like a button; hover colors can't be expressed
 * inline, so they're exposed as `--bb-button-hover-*` custom properties for the
 * scoped stylesheet (or consumer CSS) to wire up.
 */
export function getButtonStyle(style?: ButtonStyle): StyleValue {
  const out: Record<string, string> = {
    display: 'inline-block',
    textDecoration: 'none',
    cursor: 'pointer',
  };
  if (!style) return out;
  // Mirror the base colors into custom properties too, so the scoped `:hover`
  // rule can fall back to them when no hover color is set (otherwise an unset
  // hover var would compute to `transparent`/inherited on hover).
  if (style.backgroundColor) {
    out.backgroundColor = style.backgroundColor;
    out['--bb-button-bg'] = style.backgroundColor;
  }
  if (style.textColor) {
    out.color = style.textColor;
    out['--bb-button-color'] = style.textColor;
  }
  if (style.borderRadius) out.borderRadius = style.borderRadius;
  if (style.fontSize) out.fontSize = style.fontSize;
  if (style.fontWeight) out.fontWeight = style.fontWeight;
  if (style.padding) out.padding = style.padding;
  if (style.border) out.border = style.border;
  if (style.hoverBackgroundColor) out['--bb-button-hover-bg'] = style.hoverBackgroundColor;
  if (style.hoverTextColor) out['--bb-button-hover-color'] = style.hoverTextColor;
  return out;
}

// ── Social Embed (Twitter/X, Instagram, Facebook, TikTok, …) ─────────

/**
 * Per-platform widget script URL. LinkedIn is intentionally absent — its
 * oEmbed markup is a self-contained `<iframe>` that needs no script. Loaded
 * lazily and deduped by the client loader in `SocialEmbedScript.astro`.
 */
export const SOCIAL_SCRIPTS: Partial<Record<SocialPlatform, string>> = {
  twitter: 'https://platform.twitter.com/widgets.js',
  instagram: 'https://www.instagram.com/embed.js',
  tiktok: 'https://www.tiktok.com/embed.js',
  pinterest: 'https://assets.pinterest.com/js/pinit.js',
  facebook: 'https://connect.facebook.net/en_US/sdk.js',
};

export type SocialEmbedSource = { kind: 'html'; html: string } | { kind: 'fallback' };

/**
 * Strips `<script>` tags from (trusted) embed markup. Platform oEmbed payloads —
 * TikTok's especially, which has no `omit_script` option — and hand-pasted
 * Instagram/Facebook embed codes ship their widget `<script>` inline. Since the
 * `set:html` output is server-rendered, those tags would execute a *second*
 * copy of a widget script the lazy loader also injects. Removing them here makes
 * `SocialEmbedScript.astro` the single injector, and also repairs content saved
 * by plugin versions that stored the scripts server-side.
 */
export function stripScriptTags(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

/**
 * Resolves which markup a social embed should render, following the source
 * priority from the plugin contract: author-pasted `embedCode` → provider
 * `oembed.html` → a fallback link card. Widget `<script>` tags are stripped (the
 * lazy loader owns script injection). Whitespace-only strings are treated as
 * absent so an empty override doesn't blank out a usable oEmbed.
 */
export function getSocialEmbedSource(node: SocialEmbedNode): SocialEmbedSource {
  const embedCode = stripScriptTags(node.embedCode ?? '').trim();
  if (embedCode) return { kind: 'html', html: embedCode };
  const oembedHtml = stripScriptTags(node.oembed?.html ?? '').trim();
  if (oembedHtml) return { kind: 'html', html: oembedHtml };
  return { kind: 'fallback' };
}

/**
 * Adds `loading="lazy"` to any `<iframe>` in the (trusted) embed markup that
 * doesn't already declare a `loading` attribute — so provider iframes
 * (LinkedIn, Pinterest, Facebook) defer offscreen loads. The negative lookahead
 * stays within the opening tag (`[^>]` excludes `>`), so only iframes without a
 * `loading` attribute are touched and the rest of the markup is left verbatim.
 */
export function addLazyLoadingToIframes(html: string): string {
  return html.replace(/<iframe\b(?![^>]*\bloading=)/gi, '<iframe loading="lazy"');
}

// Nicely-cased display names, used when `oembed.providerName` is absent.
// Mirrors the React renderer (Twitter now presents as "X").
const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  twitter: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};

/**
 * Human-readable provider name for `aria-label` / the fallback card. Prefers
 * `oembed.providerName`, then a nicely-cased platform label, then the raw id.
 */
export function getSocialProviderName(node: SocialEmbedNode): string {
  const provider = node.oembed?.providerName?.trim();
  if (provider) return provider;
  return PLATFORM_LABELS[node.platform] ?? node.platform;
}

/**
 * `aria-label` for the embed's `<figure>`, e.g. "Twitter post by Author Name".
 * Drops the "by …" clause when no author is known.
 */
export function getSocialAriaLabel(node: SocialEmbedNode): string {
  const provider = getSocialProviderName(node);
  const author = node.oembed?.author?.trim();
  return author ? `${provider} post by ${author}` : `${provider} post`;
}
