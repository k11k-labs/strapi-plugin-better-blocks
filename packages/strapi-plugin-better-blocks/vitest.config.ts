import { defineConfig } from 'vitest/config';

import { strapiTestOptions } from '@qkix/strapi-test-harness/vitest-preset';

export default defineConfig({
  test: {
    // The units under test are pure data transforms (Markdown -> Slate nodes,
    // oEmbed payloads) and Slate transforms, so no DOM is needed.
    environment: 'node',
    include: [
      'admin/src/**/*.test.ts',
      'server/src/**/*.test.ts',
      // Boot a real Strapi — see tooling/strapi-test-harness.
      'tests/integration/**/*.test.ts',
    ],
    ...strapiTestOptions,
  },
});
