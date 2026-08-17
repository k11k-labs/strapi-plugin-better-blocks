import type { Core } from '@strapi/strapi';

const CORE_STORE_KEY = { type: 'core' as const, key: 'persisted_tables' };

type PersistedTable = string | { name: string; dependsOn?: { table: string }[] };

/**
 * Keeps the plugin's tables alive when the plugin is not loaded.
 *
 * Strapi's schema sync drops any table it previously tracked that is no longer in
 * the user schema. Disable this plugin for a single boot — to debug, to test an
 * upgrade, to rule it out as the cause of something — and every workflow, stage
 * and assignment is gone without a prompt. For a history plugin that would be bad
 * enough; here it is worse, because the plugin comes back up perfectly happy with
 * no workflows at all, which means nothing is gated and nobody is told.
 *
 * `persisted_tables` is the core-store key `@strapi/database` consults before
 * dropping. The EE `admin::persist-tables` service writes the same key, but it is
 * only registered when `strapi.EE` is set, so it does not exist for the Community
 * Edition users this plugin is for. Writing the key directly is a dozen lines.
 */
export const persistTables = async (strapi: Core.Strapi, tableNames: string[]): Promise<void> => {
  const persisted = ((await strapi.store.get(CORE_STORE_KEY)) ?? []) as PersistedTable[];

  const known = new Set(persisted.map((table) => (typeof table === 'string' ? table : table.name)));

  const missing = tableNames.filter((name) => !known.has(name));
  if (missing.length === 0) return;

  // Append — other plugins keep their entries in this same list.
  await strapi.store.set({
    ...CORE_STORE_KEY,
    value: [...persisted, ...missing.map((name) => ({ name }))],
  });
};
