export default [
  {
    method: 'GET',
    path: '/config',
    // name of the controller file & the method.
    handler: 'controller.getConfig',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/oembed',
    // Social oEmbed proxy — fetches a post's embed payload server-side.
    handler: 'oembed.fetch',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
];
