import type { Core } from '@strapi/strapi';

import { stageFilter } from './middlewares/stageFilter';
import { TABLES } from './uids';
import { createIndexes } from './utils/indexes';
import { persistTables } from './utils/persistTable';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Before anything else: without this, one boot with the plugin disabled takes
  // the workflow configuration with it, and the gate comes back up gating nothing.
  await persistTables(strapi, TABLES);
  await createIndexes(strapi);

  /**
   * The list view's review-stage filter.
   *
   * Registered here rather than in `register()` on purpose. Strapi adds its own
   * application middlewares during bootstrap but *before* plugin bootstraps run,
   * and mounts the router only when the server starts listening - so this lands
   * after authentication and error formatting, and still ahead of every route.
   */
  strapi.server.use(stageFilter(strapi));

  warnIfEnterpriseFeatureActive(strapi);
};

/**
 * Strapi's own Review Workflows is an Enterprise feature, and this plugin is not
 * it. Where both are live the editor gets two side panels that disagree, which is
 * a guaranteed bug report - so say so once, at boot, in the logs.
 *
 * Every hop is optional-chained: `strapi.ee` exists in Community Edition too, but
 * its shape is not part of any contract we can rely on.
 */
const warnIfEnterpriseFeatureActive = (strapi: Core.Strapi): void => {
  try {
    const ee = (strapi as unknown as { ee?: { features?: { isEnabled?: (f: string) => boolean } } })
      .ee;

    if (ee?.features?.isEnabled?.('review-workflows')) {
      strapi.log.warn(
        "[greenlight] Strapi's own Review Workflows feature is enabled on this licence. Both plugins will show a panel in the edit view. Greenlight's publish gate still applies; consider running only one of the two."
      );
    }
  } catch {
    // Reading a licence must never be the reason a boot fails.
  }
};

export default bootstrap;
