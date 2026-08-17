import type { Core } from '@strapi/strapi';

/**
 * Derives the short, human-readable stand-in shown for a version in the panel.
 *
 * Without it every row is a badge and a timestamp, so two versions holding
 * completely different content look identical and nothing tells an editor what
 * pressing Restore would give them.
 *
 * The field is whatever the Content Manager displays as the entry's title, so
 * the panel agrees with the rest of the admin. The returned function caches the
 * lookup per content type: a backfill runs it once per row, and the
 * configuration behind it does not change while the server is up.
 */
export const createLabeller = (strapi: Core.Strapi) => {
  const mainFieldByUid = new Map<string, string | undefined>();

  const mainFieldFor = async (uid: string): Promise<string | undefined> => {
    if (mainFieldByUid.has(uid)) return mainFieldByUid.get(uid);

    let mainField: string | undefined;
    try {
      const configuration = await strapi
        .plugin('content-manager')
        .service('content-types')
        .findConfiguration(strapi.contentTypes[uid]);
      mainField = configuration?.settings?.mainField;
    } catch {
      // No configuration for this type - fall back to guessing below.
    }

    mainFieldByUid.set(uid, mainField);
    return mainField;
  };

  return async (
    uid: string,
    data: Record<string, unknown> | null | undefined
  ): Promise<string | null> => {
    if (!data) return null;

    const mainField = await mainFieldFor(uid);
    const candidates = [mainField, 'title', 'name', 'label'].filter(Boolean) as string[];

    for (const field of candidates) {
      const value = data[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 255);
      }
    }

    return null;
  };
};
