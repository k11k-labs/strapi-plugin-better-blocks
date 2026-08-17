import type { Core } from '@strapi/strapi';

import { PLUGIN_ID } from './uids';

/**
 * One permission: who may see the diagram.
 *
 * There is nothing to configure and nothing to write, so there is nothing else
 * to guard. The schema this draws is already visible to anyone who can open the
 * Content-Type Builder.
 */
const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const actions = [
    {
      section: 'plugins',
      displayName: 'Access the schema diagram',
      uid: 'read',
      pluginName: PLUGIN_ID,
    },
  ];

  // Cast: `strapi.admin` is typed as a generic plugin, so the action provider is
  // not on the public surface even though it is the documented way in.
  const actionProvider = (
    strapi.admin as unknown as {
      services?: { permission?: { actionProvider?: { registerMany?: (a: unknown[]) => void } } };
    }
  )?.services?.permission?.actionProvider;

  actionProvider?.registerMany?.(actions);
};

export default register;
