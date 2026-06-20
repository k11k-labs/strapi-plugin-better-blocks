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
];
