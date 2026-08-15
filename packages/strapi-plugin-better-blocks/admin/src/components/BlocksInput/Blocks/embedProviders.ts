import { type AspectRatio, type EmbedProvider } from '../utils/types';

/* ---------------------------------------------------------------------------
 * Provider detection & URL → iframe-src conversion
 *
 * Only providers whose embed URL can be derived from a share URL *without* an
 * API call live here. Anything else (Twitch, which needs a `parent=` matching
 * the frontend host, or a bespoke player) is served by the block's "Embed code"
 * mode, where the author pastes the platform's own iframe verbatim.
 * -------------------------------------------------------------------------*/

interface ProviderSpec {
  provider: EmbedProvider;
  label: string;
  /** Capture group 1 must be the video/asset id. */
  patterns: RegExp[];
  /** Build the iframe `src` from the captured id. */
  toEmbedSrc: (id: string) => string;
  /** Poster/thumbnail derivable without an API call, when one exists. */
  toThumbnail?: (id: string) => string;
  /** Host an app must allow in `frame-src` to render this embed. */
  frameHost: string;
}

const PROVIDERS: ProviderSpec[] = [
  {
    provider: 'youtube',
    label: 'YouTube',
    patterns: [
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    ],
    toEmbedSrc: (id) => `https://www.youtube.com/embed/${id}`,
    toThumbnail: (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    frameHost: 'https://www.youtube.com',
  },
  {
    provider: 'vimeo',
    label: 'Vimeo',
    patterns: [
      /vimeo\.com\/video\/(\d+)/i,
      /player\.vimeo\.com\/video\/(\d+)/i,
      /vimeo\.com\/(\d+)/i,
    ],
    // Vimeo thumbnails need an oEmbed call, so none is derived here.
    toEmbedSrc: (id) => `https://player.vimeo.com/video/${id}`,
    frameHost: 'https://player.vimeo.com',
  },
  {
    provider: 'loom',
    label: 'Loom',
    patterns: [/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i],
    toEmbedSrc: (id) => `https://www.loom.com/embed/${id}`,
    frameHost: 'https://www.loom.com',
  },
  {
    provider: 'wistia',
    label: 'Wistia',
    patterns: [
      /wistia\.com\/(?:medias|embed\/iframe)\/([a-zA-Z0-9]+)/i,
      /wi\.st\/medias\/([a-zA-Z0-9]+)/i,
    ],
    toEmbedSrc: (id) => `https://fast.wistia.net/embed/iframe/${id}`,
    frameHost: 'https://fast.wistia.net',
  },
  {
    provider: 'dailymotion',
    label: 'Dailymotion',
    patterns: [
      /dailymotion\.com\/video\/([a-zA-Z0-9]+)/i,
      /dai\.ly\/([a-zA-Z0-9]+)/i,
    ],
    toEmbedSrc: (id) => `https://www.dailymotion.com/embed/video/${id}`,
    frameHost: 'https://www.dailymotion.com',
  },
  {
    provider: 'api-video',
    label: 'api.video',
    patterns: [/embed\.api\.video\/vod\/([a-zA-Z0-9]+)/i],
    toEmbedSrc: (id) => `https://embed.api.video/vod/${id}`,
    frameHost: 'https://embed.api.video',
  },
];

/** Hosts an app must allow in `frame-src` for URL-based embeds to render. */
export const EMBED_FRAME_HOSTS: string[] = PROVIDERS.map((p) => p.frameHost);

const matchProvider = (
  url: string
): { spec: ProviderSpec; id: string } | null => {
  const trimmed = url.trim();
  for (const spec of PROVIDERS) {
    for (const re of spec.patterns) {
      const match = trimmed.match(re);
      if (match) return { spec, id: match[1] };
    }
  }
  return null;
};

/** Human-readable provider name for a URL, e.g. "YouTube". */
export const getProviderLabel = (provider?: EmbedProvider): string =>
  PROVIDERS.find((p) => p.provider === provider)?.label ??
  (provider === 'generic' ? 'Embed' : 'Embed');

/** Detected provider for a share URL, or `generic` when unrecognised. */
export const detectProvider = (url: string): EmbedProvider => {
  const found = matchProvider(url);
  return found ? found.spec.provider : 'generic';
};

/** Iframe `src` derived from a share URL, or null when not derivable. */
export const getEmbedSrc = (url: string): string | null => {
  const found = matchProvider(url);
  return found ? found.spec.toEmbedSrc(found.id) : null;
};

/** Poster image derived from a share URL, when the provider exposes one. */
export const getThumbnail = (url: string): string | null => {
  const found = matchProvider(url);
  return found?.spec.toThumbnail ? found.spec.toThumbnail(found.id) : null;
};

/** True when the URL is one this block can turn into an embed by itself. */
export const isEmbeddableUrl = (url: string): boolean =>
  matchProvider(url) !== null;

/* ---------------------------------------------------------------------------
 * Iframe sanitization
 *
 * Pasted embed codes are untrusted: they are authored in the admin but rendered
 * on the public frontend, so a stored `<script>` or an `onload=` handler would
 * be a stored-XSS vector. Rather than filter the input, the iframe is *rebuilt*
 * from an allowlist — anything not explicitly listed is dropped.
 * -------------------------------------------------------------------------*/

/** Attributes carried over from a pasted iframe. Everything else is dropped. */
const ALLOWED_IFRAME_ATTRS = [
  'src',
  'width',
  'height',
  'title',
  'allow',
  'allowfullscreen',
  'loading',
  'referrerpolicy',
  'frameborder',
  'scrolling',
  'sandbox',
] as const;

/** Permissions kept in the `allow` attribute; anything else is dropped. */
const ALLOWED_PERMISSIONS = [
  'accelerometer',
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'gyroscope',
  'picture-in-picture',
  'web-share',
];

export interface SanitizedIframe {
  /** Discriminant against `IframeError`; never set on success. */
  error?: undefined;
  /** Rebuilt, safe-to-store iframe markup. */
  html: string;
  /** The iframe's `src`, hoisted for preview/validation. */
  src: string;
  width?: string;
  height?: string;
}

export interface IframeError {
  html?: undefined;
  error: 'no-iframe' | 'no-src' | 'insecure-src';
}

const sanitizeAllow = (value: string): string =>
  value
    .split(';')
    .map((part) => part.trim().split(/\s+/)[0].toLowerCase())
    .filter((permission) => ALLOWED_PERMISSIONS.includes(permission))
    .join('; ');

/**
 * Parse a pasted embed snippet and rebuild a single safe `<iframe>` from it.
 * Returns an error code instead of throwing so the modal can explain what's
 * wrong with the paste.
 */
export const sanitizeIframe = (
  input: string
): SanitizedIframe | IframeError => {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  const iframe = doc.querySelector('iframe');
  if (!iframe) return { error: 'no-iframe' };

  const src = iframe.getAttribute('src')?.trim();
  if (!src) return { error: 'no-src' };

  // Protocol-relative URLs inherit the page scheme, which is https in practice.
  const absolute = src.startsWith('//') ? `https:${src}` : src;
  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return { error: 'insecure-src' };
  }
  // Only https: — blocks javascript:, data: and mixed-content http: embeds.
  if (parsed.protocol !== 'https:') return { error: 'insecure-src' };

  const attrs: string[] = [`src="${parsed.toString()}"`];
  for (const name of ALLOWED_IFRAME_ATTRS) {
    if (name === 'src') continue;
    const raw = iframe.getAttribute(name);
    if (raw === null) continue;

    if (name === 'allowfullscreen') {
      attrs.push('allowfullscreen');
      continue;
    }
    const value = name === 'allow' ? sanitizeAllow(raw) : raw.trim();
    // Quotes would break out of the attribute we're building.
    if (!value || /["<>]/.test(value)) continue;
    attrs.push(`${name}="${value}"`);
  }

  return {
    html: `<iframe ${attrs.join(' ')}></iframe>`,
    src: parsed.toString(),
    width: iframe.getAttribute('width')?.trim() || undefined,
    height: iframe.getAttribute('height')?.trim() || undefined,
  };
};

/** Escape a value destined for a double-quoted HTML attribute. */
const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Build the iframe markup for a recognised share URL. Returns null when the URL
 * isn't one of the known providers — the author then has to use embed-code mode.
 */
export const buildUrlEmbed = (
  url: string,
  title?: string
): SanitizedIframe | null => {
  const src = getEmbedSrc(url);
  if (!src) return null;

  const attrs = [
    `src="${escapeAttr(src)}"`,
    title ? `title="${escapeAttr(title)}"` : null,
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`,
    'allowfullscreen',
    'loading="lazy"',
    'referrerpolicy="strict-origin-when-cross-origin"',
  ].filter(Boolean);

  return { html: `<iframe ${attrs.join(' ')}></iframe>`, src };
};

/* ---------------------------------------------------------------------------
 * Aspect ratio
 * -------------------------------------------------------------------------*/

export const ASPECT_RATIOS: AspectRatio[] = ['16:9', '21:9', '4:3', '1:1'];

/** `"16:9"` → `"16 / 9"`, the value the CSS `aspect-ratio` property expects. */
export const toCssAspectRatio = (ratio?: string): string => {
  if (!ratio) return '16 / 9';
  const [w, h] = ratio.split(':');
  return h ? `${w.trim()} / ${h.trim()}` : ratio;
};

/** Best-effort ratio from a pasted iframe's width/height attributes. */
export const inferAspectRatio = (
  width?: string,
  height?: string
): AspectRatio | null => {
  const w = Number(width);
  const h = Number(height);
  if (!w || !h) return null;
  const value = w / h;
  const candidates: [AspectRatio, number][] = [
    ['16:9', 16 / 9],
    ['21:9', 21 / 9],
    ['4:3', 4 / 3],
    ['1:1', 1],
  ];
  const best = candidates.find(([, target]) => Math.abs(value - target) < 0.05);
  return best ? best[0] : null;
};
