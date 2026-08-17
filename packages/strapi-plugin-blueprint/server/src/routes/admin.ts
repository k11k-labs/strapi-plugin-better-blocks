/**
 * Admin routes.
 *
 * One permission, `read`, and no others. This plugin only ever describes the
 * schema, and the schema is already visible to anyone who can open the
 * Content-Type Builder - so a second, finer permission would be ceremony
 * guarding nothing.
 */
const policy = ['plugin::blueprint.canRead'];

export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/diagram',
      handler: 'diagram.svg',
      config: { policies: policy },
    },
    {
      method: 'GET',
      path: '/diagram.svg',
      handler: 'diagram.download',
      config: { policies: policy },
    },
    {
      method: 'GET',
      path: '/graph',
      handler: 'diagram.graph',
      config: { policies: policy },
    },
    {
      method: 'GET',
      path: '/content-types',
      handler: 'diagram.catalogue',
      config: { policies: policy },
    },
  ],
};
