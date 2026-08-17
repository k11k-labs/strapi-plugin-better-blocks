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

    /**
     * How long history is kept.
     *
     * On by default, because a version table that only grows is a problem the
     * plugin would be creating rather than solving. The defaults are gentle:
     * a full week of every save, then a version a day for a month, then one a
     * week - and anchors (publish, unpublish, discard, restore) and pinned
     * versions are never removed at all, whatever their age.
     *
     * Set `enabled: false` to keep everything forever and manage it yourself.
     */
    retention: {
      enabled: true,
      keepAllDays: 7,
      dailyUntilDays: 30,
      maxAgeDays: 365,
      keepAnchors: true,
    },

    /** When the thinning runs. Standard cron, in the server's timezone. */
    cron: '0 3 * * *',
  },

  validator(
    config: {
      contentTypes?: unknown;
      retention?: {
        keepAllDays?: number;
        dailyUntilDays?: number;
        maxAgeDays?: number;
      };
    } = {}
  ) {
    const { contentTypes, retention } = config;

    if (retention) {
      const { keepAllDays = 7, dailyUntilDays = 30, maxAgeDays = 365 } = retention;
      // Out of order, the buckets overlap and the policy stops meaning what it
      // reads like - better to refuse at boot than to delete on a guess.
      if (!(keepAllDays <= dailyUntilDays && dailyUntilDays <= maxAgeDays)) {
        throw new Error(
          `[rewind] config.retention needs keepAllDays <= dailyUntilDays <= maxAgeDays (received ${keepAllDays}, ${dailyUntilDays}, ${maxAgeDays})`
        );
      }
    }

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
