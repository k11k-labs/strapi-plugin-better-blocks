import type { Core } from '@strapi/strapi';

const CORE_STORE_KEY = { type: 'core' as const, key: 'persisted_tables' };

type PersistedTable = string | { name: string; dependsOn?: { table: string }[] };

/**
 * Keeps the versions table alive when the plugin is not loaded.
 *
 * Strapi's schema sync drops any table it previously tracked that is no longer
 * in the user schema. Disable this plugin for a single boot — to debug, to test
 * an upgrade — and the history it exists to protect is gone without a prompt.
 *
 * `persisted_tables` is the core-store key `@strapi/database` consults before
 * dropping (schema/diff.js). The EE `admin::persist-tables` service writes the
 * same key, but it is registered only when `strapi.EE` is set, so it does not
 * exist for the Community Edition users this plugin is for. Writing the key
 * directly is a dozen lines and needs no EE code.
 */
export const persistVersionsTable = async (
  strapi: Core.Strapi,
  tableName: string
): Promise<void> => {
  const persisted = ((await strapi.store.get(CORE_STORE_KEY)) ?? []) as PersistedTable[];

  const names = persisted.map((table) => (typeof table === 'string' ? table : table.name));

  if (names.includes(tableName)) return;

  // Append — other plugins keep their entries in this same list.
  await strapi.store.set({
    ...CORE_STORE_KEY,
    value: [...persisted, { name: tableName }],
  });
};
