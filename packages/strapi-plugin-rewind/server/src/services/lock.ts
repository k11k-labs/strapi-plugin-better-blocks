import type { Core } from '@strapi/strapi';

/**
 * A best-effort lock held in the core store.
 *
 * Two instances behind a load balancer run the same cron, so without this they
 * both start pruning the same rows at the same time. Deleting a row twice is
 * harmless; doing the whole scan twice on a large table is not.
 *
 * Best-effort is the honest description: read-then-write is not atomic, so two
 * instances starting within the same millisecond can both win. That is
 * acceptable for a nightly tidy-up and not for anything else - do not reuse
 * this for something that must happen exactly once.
 */
const lock = ({ strapi }: { strapi: Core.Strapi }) => {
  const key = (name: string) => ({
    type: 'plugin' as const,
    name: 'rewind',
    key: `lock:${name}`,
  });

  return {
    async acquire(name: string, ttlMs: number): Promise<boolean> {
      const existing = (await strapi.store.get(key(name))) as { expires: number } | null;

      // An instance that died mid-prune would otherwise hold the lock forever.
      if (existing && existing.expires > Date.now()) return false;

      await strapi.store.set({
        ...key(name),
        value: { expires: Date.now() + ttlMs },
      });
      return true;
    },

    async release(name: string): Promise<void> {
      await strapi.store.set({ ...key(name), value: { expires: 0 } });
    },
  };
};

export default lock;
