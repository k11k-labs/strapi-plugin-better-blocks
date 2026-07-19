import type { Core } from '@strapi/strapi';

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'better-blocks': {
    enabled: true,
  },
  /**
   * Mux Video Uploader — enables the "Mux" source button in the Better Blocks
   * video block, which lists and searches Mux assets through this plugin's
   * admin API. Credentials come from a Mux **Access Token** (Mux dashboard →
   * Settings → Access Tokens, Full Access) and live in `.env`, never here.
   *
   * Gated on the credentials being present so the playground still boots
   * without them — the video block simply hides its Mux button.
   */
  'mux-video-uploader': {
    enabled: Boolean(env('MUX_ACCESS_TOKEN_ID') && env('MUX_SECRET_KEY')),
    config: {
      accessTokenId: env('MUX_ACCESS_TOKEN_ID'),
      secretKey: env('MUX_SECRET_KEY'),
      // Optional — only needed for upload webhooks and signed playback.
      webhookSigningSecret: env('MUX_WEBHOOK_SIGNING_SECRET'),
      playbackSigningId: env('MUX_SIGNING_KEY_ID'),
      playbackSigningSecret: env('MUX_SIGNING_KEY_PRIVATE_KEY'),
    },
  },
});

export default config;
