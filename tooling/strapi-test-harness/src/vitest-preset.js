/**
 * Vitest options every suite that boots Strapi needs.
 *
 * These are not preferences - each one is load-bearing, and getting any of them
 * wrong fails the run in a way that points somewhere else entirely. Kept here so
 * a package picking up the harness does not have to rediscover them.
 *
 * Plain JavaScript on purpose. Vite externalises bare imports from a
 * `vitest.config.ts`, so this file is handed to Node as-is rather than
 * transpiled. Node 22 strips types and would tolerate TypeScript here; Node 20
 * does not, and the repo builds on both - a `.ts` preset fails there with a
 * bare `SyntaxError` that names the config file, not this one.
 *
 * @type {{ testTimeout: number, hookTimeout: number, pool: 'threads' }}
 */
export const strapiTestOptions = {
  /** Booting Strapi takes a couple of seconds; the 5s default trips over it. */
  testTimeout: 120_000,
  hookTimeout: 120_000,
  /**
   * Threads, not forks. Strapi leaves sockets open after `destroy()`, and in a
   * forked worker that surfaces as an unhandled `ERR_IPC_CHANNEL_CLOSED`
   * rejection - failing a run whose tests all passed. Threads have no IPC
   * channel and shut down cleanly.
   *
   * It also gives each test file its own worker, which matters: `createStrapi()`
   * assigns `global.strapi`, so two live instances in one worker clobber each
   * other. One booted instance per file.
   */
  pool: 'threads',
};
