import type { Core } from '@strapi/strapi';

/* ---------------------------------------------------------------------------
 * Social oEmbed proxy service
 *
 * Fetches a social post's official oEmbed payload server-side (so the admin
 * never talks to the platform directly and tokens stay on the server), and
 * caches the normalised result in-memory for `cacheTTL` seconds.
 * -------------------------------------------------------------------------*/

export type SocialPlatform =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest';

export interface NormalisedOEmbed {
  platform: SocialPlatform;
  url: string;
  html: string | null;
  title?: string;
  author?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  providerName?: string;
  width?: number;
  height?: number;
}

interface SocialConfig {
  enabled?: boolean;
  platforms?: SocialPlatform[];
  cache?: boolean;
  cacheTTL?: number;
  instagram?: { accessToken?: string };
  facebook?: { accessToken?: string };
}

/* --- Platform detection ----------------------------------------------------*/

const PLATFORM_PATTERNS: Array<{ platform: SocialPlatform; re: RegExp }> = [
  {
    platform: 'twitter',
    re: /(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/\d+/i,
  },
  { platform: 'instagram', re: /instagram\.com\/(?:p|reel|tv)\//i },
  { platform: 'tiktok', re: /tiktok\.com\/@[^/]+\/video\/\d+/i },
  { platform: 'facebook', re: /facebook\.com\//i },
  { platform: 'linkedin', re: /linkedin\.com\//i },
  { platform: 'pinterest', re: /(?:pinterest\.[a-z.]+|pin\.it)\//i },
];

export const detectPlatform = (url: string): SocialPlatform | null => {
  const match = PLATFORM_PATTERNS.find(({ re }) => re.test(url));
  return match ? match.platform : null;
};

/* --- oEmbed endpoint builders ---------------------------------------------*/

/**
 * Returns the platform oEmbed endpoint to call, or null when the platform has
 * no public oEmbed API (e.g. LinkedIn, which we render via a constructed iframe).
 */
const buildEndpoint = (
  platform: SocialPlatform,
  url: string,
  config: SocialConfig
): string | null => {
  const enc = encodeURIComponent(url);
  switch (platform) {
    case 'twitter':
      return `https://publish.twitter.com/oembed?url=${enc}&omit_script=true&dnt=true`;
    case 'tiktok':
      return `https://www.tiktok.com/oembed?url=${enc}`;
    case 'pinterest':
      return `https://www.pinterest.com/oembed.json?url=${enc}`;
    case 'instagram': {
      const token = config.instagram?.accessToken;
      if (!token) return null;
      return `https://graph.facebook.com/v17.0/instagram_oembed?url=${enc}&access_token=${encodeURIComponent(
        token
      )}&omitscript=true`;
    }
    case 'facebook': {
      const token = config.facebook?.accessToken;
      if (!token) return null;
      return `https://graph.facebook.com/v17.0/oembed_post?url=${enc}&access_token=${encodeURIComponent(
        token
      )}&omitscript=true`;
    }
    case 'linkedin':
      // No public oEmbed; handled by buildLinkedInIframe instead.
      return null;
    default:
      return null;
  }
};

/**
 * `pin.it` short links are 30x redirects that Pinterest's oEmbed endpoint
 * rejects outright, so expand them to the canonical `/pin/<id>/` URL first.
 * Returns the original URL when it isn't a short link or can't be resolved.
 */
const resolveShortUrl = async (url: string): Promise<string> => {
  if (!/^https?:\/\/pin\.it\//i.test(url)) return url;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const resolved = res.url || url;
    // Pinterest bounces short links through api.pinterest.com; only accept a
    // final URL that actually looks like a pin.
    return /pinterest\.[a-z.]+\/pin\//i.test(resolved) ? resolved : url;
  } catch {
    return url;
  }
};

/** LinkedIn has no oEmbed API but exposes a stable iframe embed by URN. */
const buildLinkedInIframe = (url: string): NormalisedOEmbed | null => {
  // Activity URN appears in share URLs, e.g. .../urn:li:activity:7000000000000000000
  const urnMatch = url.match(
    /(?:urn:li:)?(ugcPost|activity|share)[:-](\d{10,})/i
  );
  if (!urnMatch) return null;
  // The URN type matters: LinkedIn 404s an activity id addressed as a share.
  // Share URLs (…-activity-<id>-<hash>) carry their own type — keep it.
  const type =
    urnMatch[1].toLowerCase() === 'ugcpost'
      ? 'ugcPost'
      : urnMatch[1].toLowerCase();
  const urn = `urn:li:${type}:${urnMatch[2]}`;
  const src = `https://www.linkedin.com/embed/feed/update/${encodeURIComponent(urn)}`;
  return {
    platform: 'linkedin',
    url,
    html: `<iframe src="${src}" height="600" width="100%" frameborder="0" allowfullscreen title="Embedded LinkedIn post" loading="lazy"></iframe>`,
    providerName: 'LinkedIn',
    width: 504,
    height: 600,
  };
};

/* --- Normalisation ---------------------------------------------------------*/

/**
 * Platform oEmbed markup often ships the widget script inline (TikTok always
 * does; Twitter/Instagram only when `omit_script` isn't honoured). Renderers
 * inject that script themselves, and a `<script>` added through `innerHTML`
 * never executes anyway — worse, its inert tag makes a renderer believe the
 * widget is already loaded. Strip it so the stored html is markup only.
 */
const stripScripts = (html: string): string =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();

const normalise = (
  platform: SocialPlatform,
  url: string,
  raw: Record<string, unknown>
): NormalisedOEmbed => ({
  platform,
  url,
  html: typeof raw.html === 'string' ? stripScripts(raw.html) || null : null,
  title: typeof raw.title === 'string' ? raw.title : undefined,
  author: typeof raw.author_name === 'string' ? raw.author_name : undefined,
  authorUrl: typeof raw.author_url === 'string' ? raw.author_url : undefined,
  thumbnailUrl:
    typeof raw.thumbnail_url === 'string' ? raw.thumbnail_url : undefined,
  providerName:
    typeof raw.provider_name === 'string' ? raw.provider_name : undefined,
  width: typeof raw.width === 'number' ? raw.width : undefined,
  height: typeof raw.height === 'number' ? raw.height : undefined,
});

/* --- Service ---------------------------------------------------------------*/

const cache = new Map<string, { expires: number; data: NormalisedOEmbed }>();

const service = ({ strapi }: { strapi: Core.Strapi }) => {
  const getConfig = (): SocialConfig =>
    strapi.plugin('better-blocks').config('social', {}) as SocialConfig;

  return {
    detectPlatform,

    /**
     * Fetch (and cache) the normalised oEmbed for `url`. `platform` may be
     * passed to skip auto-detection. Throws on an unsupported/unconfigured
     * platform or a failed upstream request.
     */
    async fetch(
      url: string,
      platform?: SocialPlatform
    ): Promise<NormalisedOEmbed> {
      const config = getConfig();

      if (config.enabled === false) {
        throw new Error('Social embeds are disabled in plugin config.');
      }

      const resolved = platform ?? detectPlatform(url);
      if (!resolved) {
        throw new Error(`Unsupported or unrecognised social URL: ${url}`);
      }

      const allowed = config.platforms;
      if (Array.isArray(allowed) && !allowed.includes(resolved)) {
        throw new Error(
          `Platform "${resolved}" is not enabled in plugin config.`
        );
      }

      const useCache = config.cache !== false;
      const ttl = (config.cacheTTL ?? 86400) * 1000;
      const key = `${resolved}:${url}`;

      if (useCache) {
        const hit = cache.get(key);
        if (hit && hit.expires > Date.now()) return hit.data;
      }

      let data: NormalisedOEmbed | null = null;

      if (resolved === 'linkedin') {
        data = buildLinkedInIframe(url);
        if (!data) {
          throw new Error(
            'Could not derive a LinkedIn embed from this URL. Paste the post embed code instead.'
          );
        }
      } else {
        const target = await resolveShortUrl(url);
        const endpoint = buildEndpoint(resolved, target, config);
        if (!endpoint) {
          throw new Error(
            `oEmbed for "${resolved}" requires an access token. Configure config.social.${resolved}.accessToken, or paste the embed code instead.`
          );
        }

        const res = await fetch(endpoint, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(
            `oEmbed request to ${resolved} failed (HTTP ${res.status}).`
          );
        }
        const raw = (await res.json()) as Record<string, unknown>;

        // Some providers (Pinterest notably) answer HTTP 200 with an error
        // payload. Surfacing that beats silently storing an empty embed that
        // degrades to a bare link on the frontend.
        if (typeof raw.error === 'string') {
          throw new Error(`${resolved} could not embed this URL: ${raw.error}`);
        }

        data = normalise(resolved, target, raw);

        if (!data.html) {
          throw new Error(
            `${resolved} returned no embed markup for this URL. Check the post is public, or paste the embed code instead.`
          );
        }
      }

      if (useCache && ttl > 0) {
        cache.set(key, { expires: Date.now() + ttl, data });
      }

      return data;
    },
  };
};

export default service;
