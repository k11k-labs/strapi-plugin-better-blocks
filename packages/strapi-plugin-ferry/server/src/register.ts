import type { Core } from '@strapi/strapi';

import { PLUGIN_ID } from './uids';

/**
 * Two permissions: taking content out, and putting content in.
 *
 * Kept apart because they are not the same risk. An export is a copy; an import
 * replaces what is there. A role that may do the first has no automatic claim
 * on the second.
 */
const register = ({ strapi }: { strapi: Core.Strapi }) => {
  const actions = [
    {
      section: 'plugins',
      displayName: 'Export content',
      uid: 'export',
      pluginName: PLUGIN_ID,
    },
    {
      section: 'plugins',
      displayName: 'Import content',
      uid: 'import',
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
