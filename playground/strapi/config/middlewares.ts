import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https://img.youtube.com'],
          'media-src': ["'self'", 'data:', 'blob:'],
          'frame-src': [
            "'self'",
            'https://www.youtube.com',
            'https://player.vimeo.com',
            // Live social-embed previews in the editor (script-free iframes).
            'https://platform.twitter.com',
            'https://www.instagram.com',
            'https://www.facebook.com',
            'https://www.tiktok.com',
            'https://www.linkedin.com',
            'https://assets.pinterest.com',
          ],
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
