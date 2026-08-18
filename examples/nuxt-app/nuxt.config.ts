import { defineNuxtConfig } from 'nuxt/config';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  // One line is the whole setup: the module registers <BlocksRenderer> as an
  // auto-imported component and adds the renderer's stylesheet along with
  // KaTeX's, which server-rendered math needs.
  modules: ['@qkix/better-blocks-vue-renderer/nuxt'],

  runtimeConfig: {
    strapiUrl: STRAPI_URL,
  },

  devServer: {
    port: 3000,
    host: '0.0.0.0',
  },

  nitro: {
    // Media in the content comes back as relative `/uploads/...` URLs, and the
    // browser has to be able to fetch them from this origin. The API is proxied
    // too, so the client half of the page load uses the same relative URLs.
    devProxy: {
      '/api': { target: `${STRAPI_URL}/api`, changeOrigin: true },
      '/uploads': { target: `${STRAPI_URL}/uploads`, changeOrigin: true },
    },
  },
});
