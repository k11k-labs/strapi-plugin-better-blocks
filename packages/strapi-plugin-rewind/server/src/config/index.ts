export default {
  default: {
    /**
     * Content types to version, by uid. Empty means nothing is tracked.
     *
     * The default is deliberate. A plugin that silently starts writing a row on
     * every save the moment it is installed is a plugin that gets uninstalled
     * after the first disk alert.
     *
     *   'rewind': {
     *     enabled: true,
     *     config: { contentTypes: ['api::article.article'] },
     *   }
     */
    contentTypes: [] as string[],

    /**
     * Whether to version writes that do not come from the Content Manager.
     *
     * Strapi's own history ignores them, so `false` keeps the out-of-the-box
     * behaviour familiar. With `true`, REST/GraphQL and programmatic writes are
     * versioned too, with `createdById` left null.
     *
     * Either way this only ever sees the Document Service. Writes made through
     * `strapi.db.query()` or the legacy entity service do not pass through the
     * middleware and cannot be captured.
     */
    trackApiWrites: false,
  },

  validator(config: { contentTypes?: unknown } = {}) {
    const { contentTypes } = config;
    if (contentTypes === undefined) return;

    if (!Array.isArray(contentTypes) || contentTypes.some((uid) => typeof uid !== 'string')) {
      throw new Error(
        '[rewind] config.contentTypes must be an array of content type uids, e.g. ["api::article.article"]'
      );
    }

    const invalid = contentTypes.filter((uid) => !uid.startsWith('api::'));
    if (invalid.length > 0) {
      throw new Error(
        `[rewind] config.contentTypes only supports api:: content types, received: ${invalid.join(', ')}`
      );
    }
  },
};
