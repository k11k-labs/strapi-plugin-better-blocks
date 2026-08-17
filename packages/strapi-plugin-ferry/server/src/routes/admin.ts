/**
 * Admin routes.
 *
 * Two permissions, not one. Reading content out and writing content in are
 * different powers: an editor may reasonably be trusted to take a copy of a
 * content type away, and not at all to replace it. Collapsing them into a
 * single "use Ferry" permission would mean granting the second to get the
 * first.
 */
const canExport = ['plugin::ferry.canExport'];
const canImport = ['plugin::ferry.canImport'];

export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/content-types',
      handler: 'transfer.catalogue',
      config: { policies: canExport },
    },
    {
      method: 'GET',
      path: '/plan/:uid',
      handler: 'transfer.plan',
      config: { policies: canExport },
    },
    {
      method: 'POST',
      path: '/export',
      handler: 'transfer.export',
      config: { policies: canExport },
    },
    {
      // The dry run is guarded as an import even though it writes nothing: it
      // reads the file against the database and reports what is there.
      method: 'POST',
      path: '/import/preview',
      handler: 'transfer.preview',
      config: { policies: canImport },
    },
    {
      method: 'POST',
      path: '/import',
      handler: 'transfer.apply',
      config: { policies: canImport },
    },
  ],
};
