/**
 * Read and restore are separate permissions on purpose: a reviewer should be
 * able to see what changed without being able to undo someone else's work.
 */
export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/versions',
      handler: 'version.find',
      config: { policies: ['admin::isAuthenticatedAdmin'] },
    },
    {
      method: 'GET',
      path: '/versions/:id',
      handler: 'version.findOne',
      config: { policies: ['admin::isAuthenticatedAdmin'] },
    },
    {
      method: 'GET',
      path: '/versions/:id/preview',
      handler: 'version.preview',
      config: { policies: ['admin::isAuthenticatedAdmin'] },
    },
    {
      method: 'POST',
      path: '/versions/:id/restore',
      handler: 'version.restore',
      config: { policies: ['admin::isAuthenticatedAdmin'] },
    },
  ],
};
