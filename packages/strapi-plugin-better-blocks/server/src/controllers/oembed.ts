import type { Core } from '@strapi/strapi';

import type { SocialPlatform } from '../services/oembed';

const VALID_PLATFORMS: SocialPlatform[] = [
  'twitter',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'pinterest',
];

const oembed = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /better-blocks/oembed?url=...&platform=...
   * Proxies the platform oEmbed request server-side and returns the normalised
   * payload used by the social-embed block.
   */
  async fetch(ctx) {
    const { url, platform } = ctx.query as {
      url?: string;
      platform?: string;
    };

    if (!url || typeof url !== 'string') {
      return ctx.badRequest('Missing required "url" query parameter.');
    }

    const requested =
      platform && VALID_PLATFORMS.includes(platform as SocialPlatform)
        ? (platform as SocialPlatform)
        : undefined;

    try {
      ctx.body = await strapi
        .plugin('better-blocks')
        .service('oembed')
        .fetch(url, requested);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'oEmbed request failed.';
      return ctx.badRequest(message);
    }
  },
});

export default oembed;
