import type { Core } from '@strapi/strapi';

/**
 * Without this the dev server stacks up a new thinning job on every reload,
 * and they all fire together.
 */
const destroy = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.cron.remove('rewindPrune');
};

export default destroy;
