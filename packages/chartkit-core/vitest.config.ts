import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure functions in, SVG strings out. No DOM involved anywhere.
    environment: 'node',
  },
});
