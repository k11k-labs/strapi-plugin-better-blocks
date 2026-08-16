import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // What is tested here is the field's value handling: parse, migrate,
    // serialize. Pure data, so no DOM.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
