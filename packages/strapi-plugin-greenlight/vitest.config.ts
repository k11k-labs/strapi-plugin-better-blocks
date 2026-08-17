import { defineConfig } from 'vitest/config';

import { strapiTestOptions } from '@qkix/strapi-test-harness/vitest-preset';

export default defineConfig({
  test: {
    environment: 'node',
    // tests/ boots a real Strapi — see tooling/strapi-test-harness.
    include: ['server/src/**/*.test.ts', 'tests/**/*.test.ts'],
    ...strapiTestOptions,
  },
});
