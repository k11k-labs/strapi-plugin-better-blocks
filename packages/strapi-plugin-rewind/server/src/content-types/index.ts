import version from './version/schema.json';

/**
 * The versions table.
 *
 * `relatedDocumentId`, not `documentId`: Strapi injects a `documentId` into
 * every content type and rejects the name outright — "The attribute
 * "documentId" is reserved and cannot be used in a model" — at boot, before
 * anything else runs. Strapi's own history model calls it `relatedDocumentId`
 * for the same reason.
 *
 * It is a plain string rather than a relation on purpose: a cascading delete
 * would erase a document's history at the exact moment it becomes most useful.
 *
 * `userId` is not `createdById` for a related reason: Strapi adds its own
 * `createdBy` relation to every content type, which occupies the `created_by_id`
 * column, and a second attribute snake-casing to the same name fails the table
 * creation outright.
 */
export default {
  version: { schema: version },
};
