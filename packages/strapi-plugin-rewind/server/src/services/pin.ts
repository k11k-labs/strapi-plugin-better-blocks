import type { Core } from '@strapi/strapi';

import { VERSION_UID } from './snapshot';

/**
 * Pinning is the only write an editor makes to the history itself rather than
 * to a document, so it is deliberately the smallest one available: a boolean on
 * a row, no cascade, and no effect beyond prune skipping that row from then on
 * (see `selectExpendable` in ../utils/thinning).
 *
 * It is kept out of the controller so that it can be exercised against a real
 * database in the integration tests, which have no HTTP layer to call.
 */
const pin = ({ strapi }: { strapi: Core.Strapi }) => ({
  async set(versionId: number, pinned: boolean): Promise<{ id: number; pinned: boolean }> {
    if (!Number.isInteger(versionId)) {
      throw new Error('A version id is required.');
    }

    const version = await strapi.db
      .query(VERSION_UID)
      .findOne({ where: { id: versionId }, select: ['id', 'pinned'] });

    if (!version) {
      throw new Error(`No version with id ${versionId}`);
    }

    // A toggle invites double-clicks, and prune reads this column on every run.
    // Writing a value the row already holds would only add churn.
    if (Boolean(version.pinned) === pinned) {
      return { id: versionId, pinned };
    }

    await strapi.db.query(VERSION_UID).update({ where: { id: versionId }, data: { pinned } });

    return { id: versionId, pinned };
  },
});

export default pin;
