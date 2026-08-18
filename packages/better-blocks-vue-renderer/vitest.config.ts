import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    // The renderer is mounted for real: code blocks highlight after mount and
    // social embeds load their widget scripts there, so the tests need a DOM.
    environment: 'jsdom',
  },
});
