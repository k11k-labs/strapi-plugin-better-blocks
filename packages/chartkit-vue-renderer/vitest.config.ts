import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    // The components are mounted for real, so they need a DOM - even though
    // nothing here runs on the client once the page is served.
    environment: 'jsdom',
  },
});
