import { defineConfig } from 'vitest/config';

import { strapiTestOptions } from './src/vitest-preset.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    ...strapiTestOptions,
  },
});
