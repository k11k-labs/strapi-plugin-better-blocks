export default {
  default: {
    /**
     * Which content types sit under a review workflow is **not** configured
     * here. It lives in the database, on the workflow itself, and is edited from
     * the admin panel - so an editor can put a content type under review without
     * a deploy, and so one content type cannot end up claimed by two workflows.
     *
     * What is left in config is the part a developer owns.
     */

    hooks: {
      /**
       * Called after a document changes stage, with the transition that was
       * just recorded. The hook for notifications, which this plugin
       * deliberately does not implement itself.
       *
       * Errors are logged and swallowed: someone else's Slack outage must not
       * be able to fail a review transition that has already been written.
       *
       *   (payload) => void | Promise<void>
       */
      onTransition: null as null | ((payload: unknown) => void | Promise<void>),
    },

    /**
     * How long the transition log is kept, in days.
     *
     * The log is append-only and one row per stage change, so it grows far more
     * slowly than a version history would - a year is generous rather than
     * risky.
     */
    transitionRetentionDays: 365,
  },

  validator(
    config: { transitionRetentionDays?: unknown; hooks?: { onTransition?: unknown } } = {}
  ) {
    const { transitionRetentionDays, hooks } = config;

    if (transitionRetentionDays !== undefined) {
      if (
        typeof transitionRetentionDays !== 'number' ||
        !Number.isFinite(transitionRetentionDays) ||
        transitionRetentionDays < 1
      ) {
        throw new Error(
          `[greenlight] config.transitionRetentionDays must be a number of days >= 1, received: ${String(
            transitionRetentionDays
          )}`
        );
      }
    }

    if (hooks?.onTransition != null && typeof hooks.onTransition !== 'function') {
      throw new Error(
        `[greenlight] config.hooks.onTransition must be a function or null, received: ${typeof hooks.onTransition}`
      );
    }
  },
};
