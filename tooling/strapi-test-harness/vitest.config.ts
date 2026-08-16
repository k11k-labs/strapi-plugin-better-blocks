import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Booting Strapi takes a couple of seconds; the 5s default trips over it.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    /**
     * Threads, not forks. Strapi leaves sockets open after `destroy()`, and in a
     * forked worker that ends with the IPC channel closing under tinypool —
     * every run then fails on an unhandled "Channel closed" rejection despite
     * green tests. Threads have no IPC channel and shut down cleanly.
     *
     * Each file gets its own worker, which matters: `createStrapi()` assigns
     * `global.strapi`, so two live instances in one worker would clobber each
     * other. One booted instance per test file.
     */
    pool: 'threads',
  },
});
