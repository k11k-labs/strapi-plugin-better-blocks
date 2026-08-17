import { defineConfig } from 'vitest/config';

import { strapiTestOptions } from '@qkix/strapi-test-harness/vitest-preset';

export default defineConfig({
  test: {
    // What is tested here is the field's value handling: parse, migrate,
    // serialize. Pure data, so no DOM.
    environment: 'node',
    // Covers tests/integration too, which boots a real Strapi - see
    // tooling/strapi-test-harness.
    include: ['tests/**/*.test.ts'],
    ...strapiTestOptions,
  },
});
