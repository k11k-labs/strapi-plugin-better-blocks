import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('better-blocks')
      // the name of the service file & the method.
      .service('service')
      .getWelcomeMessage();
  },

  /**
   * Exposes the plugin config (config/plugins.js merged with server defaults) to
   * the admin panel, so blocks like Details can honour admin-level settings.
   */
  getConfig(ctx) {
    ctx.body = {
      details: strapi.plugin('better-blocks').config('details', {
        defaultSummary: 'Click to expand',
        style: 'github',
      }),
      button: strapi.plugin('better-blocks').config('button', {
        defaultStyle: {
          backgroundColor: '#4945ff',
          textColor: '#ffffff',
          borderRadius: '4px',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '600',
        },
        presets: {
          primary: {
            backgroundColor: '#4945ff',
            textColor: '#ffffff',
            border: 'none',
          },
          secondary: {
            backgroundColor: '#dcdce4',
            textColor: '#32324d',
            border: 'none',
          },
          outline: {
            backgroundColor: 'transparent',
            textColor: '#4945ff',
            border: '2px solid #4945ff',
          },
          filled: {
            backgroundColor: '#32324d',
            textColor: '#ffffff',
            border: 'none',
          },
        },
      }),
      social: (() => {
        const social = strapi.plugin('better-blocks').config('social', {
          enabled: true,
          platforms: [
            'twitter',
            'instagram',
            'facebook',
            'tiktok',
            'linkedin',
            'pinterest',
          ],
        }) as {
          enabled?: boolean;
          platforms?: string[];
          instagram?: { accessToken?: string };
          facebook?: { accessToken?: string };
        };
        // Never leak tokens to the browser — only expose what the editor needs.
        return {
          enabled: social.enabled !== false,
          platforms: social.platforms ?? [],
          instagramConfigured: Boolean(social.instagram?.accessToken),
          facebookConfigured: Boolean(social.facebook?.accessToken),
        };
      })(),
    };
  },
});

export default controller;
