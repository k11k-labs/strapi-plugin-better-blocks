import { type SocialEmbedElement, type SocialPlatform } from '../utils/types';

/* ---------------------------------------------------------------------------
 * In-editor live preview frames
 *
 * The Strapi admin CSP is `script-src 'self'`, so platform widget scripts
 * (twitter `widgets.js`, tiktok `embed.js`) can never run in the editor. Every
 * platform however also exposes a *script-free* iframe embed URL, which only
 * needs its host allowed in the app's `frame-src` — the same setup the media
 * embed block already asks for with YouTube/Vimeo.
 * -------------------------------------------------------------------------*/

export interface SocialFrame {
  src: string;
  /** Fixed height in px: these frames don't post their size to the parent. */
  height: number;
}

/** Hosts an app must allow in `frame-src` for live previews to render. */
export const SOCIAL_FRAME_HOSTS: Record<SocialPlatform, string> = {
  twitter: 'https://platform.twitter.com',
  instagram: 'https://www.instagram.com',
  facebook: 'https://www.facebook.com',
  tiktok: 'https://www.tiktok.com',
  linkedin: 'https://www.linkedin.com',
  pinterest: 'https://assets.pinterest.com',
};

const FRAME_HEIGHTS: Record<SocialPlatform, number> = {
  twitter: 560,
  instagram: 700,
  facebook: 680,
  tiktok: 760,
  linkedin: 600,
  pinterest: 450,
};

/** First `<iframe src>` in a markup blob — platforms that embed via iframe
 * (Pinterest, LinkedIn, a pasted Facebook snippet) already carry a usable one. */
const iframeSrc = (html?: string): string | null => {
  const match = html?.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match ? match[1].replace(/&amp;/g, '&') : null;
};

const firstMatch = (patterns: RegExp[], ...sources: (string | undefined)[]) => {
  for (const source of sources) {
    if (!source) continue;
    for (const re of patterns) {
      const match = source.match(re);
      if (match) return match[1];
    }
  }
  return null;
};

/**
 * Build the URL of a script-free preview frame for a social-embed node, or null
 * when the post can't be identified (then the editor keeps showing the card).
 */
export const getSocialFrame = (
  element: Pick<SocialEmbedElement, 'platform' | 'url' | 'embedCode' | 'oembed'>
): SocialFrame | null => {
  const { platform, url = '', embedCode } = element;
  const html = element.oembed?.html;
  const height = FRAME_HEIGHTS[platform] ?? 600;

  // An iframe the platform itself handed us is always the best source.
  const existing = iframeSrc(embedCode) ?? iframeSrc(html);
  if (existing) return { src: existing, height };

  switch (platform) {
    case 'twitter': {
      const id = firstMatch(
        [/(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/(\d+)/i],
        url,
        embedCode,
        html
      );
      return id
        ? {
            src: `https://platform.twitter.com/embed/Tweet.html?id=${id}&dnt=true`,
            height,
          }
        : null;
    }
    case 'instagram': {
      const code = firstMatch(
        [/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i],
        url,
        embedCode,
        html
      );
      return code
        ? {
            src: `https://www.instagram.com/p/${code}/embed/captioned/`,
            height,
          }
        : null;
    }
    case 'tiktok': {
      const id = firstMatch(
        [/tiktok\.com\/@[^/]+\/video\/(\d+)/i, /data-video-id=["'](\d+)["']/i],
        url,
        embedCode,
        html
      );
      return id
        ? { src: `https://www.tiktok.com/embed/v2/${id}`, height }
        : null;
    }
    case 'pinterest': {
      const id = firstMatch([/\/pin\/(\d+)/i], url, embedCode, html);
      return id
        ? {
            src: `https://assets.pinterest.com/ext/embed.html?id=${id}`,
            height,
          }
        : null;
    }
    case 'facebook': {
      if (!url) return null;
      return {
        src: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
          url
        )}&show_text=true&width=500`,
        height,
      };
    }
    case 'linkedin': {
      const match = url.match(
        /(?:urn:li:)?(ugcPost|activity|share)[:-](\d{10,})/i
      );
      if (!match) return null;
      // LinkedIn 404s an activity id addressed as a share — keep the URL's type.
      const type =
        match[1].toLowerCase() === 'ugcpost'
          ? 'ugcPost'
          : match[1].toLowerCase();
      return {
        src: `https://www.linkedin.com/embed/feed/update/${encodeURIComponent(
          `urn:li:${type}:${match[2]}`
        )}`,
        height,
      };
    }
    default:
      return null;
  }
};
