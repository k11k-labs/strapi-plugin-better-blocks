import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The units under test are pure data transforms (Markdown -> Slate nodes)
    // and Slate transforms, so no DOM is needed.
    environment: 'node',
    include: ['admin/src/**/*.test.ts'],
  },
});
