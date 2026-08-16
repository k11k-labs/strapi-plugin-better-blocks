/**
 * Vitest options every suite that boots Strapi needs.
 *
 * These are not preferences — each one is load-bearing, and getting any of them
 * wrong fails the run in a way that points somewhere else entirely. Kept here so
 * a package picking up the harness does not have to rediscover them.
 *
 *   import { defineConfig } from 'vitest/config';
 *   import { strapiTestOptions } from '@qkix/strapi-test-harness/vitest-preset';
 *
 *   export default defineConfig({
 *     test: {
 *       environment: 'node',
 *       include: ['tests/**\/*.test.ts'],
 *       ...strapiTestOptions,
 *     },
 *   });
 */
export const strapiTestOptions = {
  /** Booting Strapi takes a couple of seconds; the 5s default trips over it. */
  testTimeout: 120_000,
  hookTimeout: 120_000,
  /**
   * Threads, not forks. Strapi leaves sockets open after `destroy()`, and in a
   * forked worker that surfaces as an unhandled `ERR_IPC_CHANNEL_CLOSED`
   * rejection — failing a run whose tests all passed. Threads have no IPC
   * channel and shut down cleanly.
   *
   * It also gives each test file its own worker, which matters: `createStrapi()`
   * assigns `global.strapi`, so two live instances in one worker clobber each
   * other. One booted instance per file.
   */
  pool: 'threads' as const,
};
