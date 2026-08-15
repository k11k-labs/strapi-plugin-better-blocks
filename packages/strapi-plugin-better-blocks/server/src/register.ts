import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: 'better-blocks',
    plugin: 'better-blocks',
    type: 'json',
    inputSize: {
      default: 12,
      isResizable: false,
    },
  });
};

export default register;
