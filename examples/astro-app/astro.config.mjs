import { defineConfig } from 'astro/config';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    // The renderer ships raw `.astro` source, so Vite must transform it instead
    // of treating the package as an opaque external dependency.
    ssr: {
      noExternal: ['@k11k/better-blocks-astro-renderer'],
    },
    // Proxy Strapi media so relative `/uploads/...` URLs in rendered content
    // resolve in the browser (mirrors the React playground's Vite proxy).
    server: {
      proxy: {
        '/api': { target: STRAPI_URL, changeOrigin: true },
        '/uploads': { target: STRAPI_URL, changeOrigin: true },
      },
    },
  },
});
