import type { ButtonStyle, SocialEmbedNode, SocialPlatform, StyleValue } from './types';

/**
 * Everything here that the React renderer also needs now lives in
 * `@qkix/better-blocks-core`. It is re-exported so this package's components
 * keep importing from a single place.
 */
export {
  buildTextMarks,
  formatFileSize,
  getAspectRatio,
  getBlockStyle,
  getDefaultMarkRender,
  getFileIcon,
  getListStyleType,
  getModifierProps,
  getPlainText,
  normalizeCodeLang,
} from '@qkix/better-blocks-core';
export type { Mark } from '@qkix/better-blocks-core';

// What follows is Astro-specific: button styling and the social-embed handling,
// which the React renderer solves a different way (it loads widget scripts on
// the client instead of stripping them for a script-free server render).

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
