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
      }),
    };
  },
});

export default controller;
