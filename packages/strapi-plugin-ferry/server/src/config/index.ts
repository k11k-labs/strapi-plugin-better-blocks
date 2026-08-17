export default {
  default: {
    /**
     * Content types Ferry will not carry, whatever the UI asks for.
     *
     * For anything that must not leave the environment it is in - a table of
     * customer records, an integration's bookkeeping. The picker hides them and
     * the endpoints refuse them, so a hidden thing cannot be exported by
     * guessing its uid.
     *
     *   ferry: {
     *     enabled: true,
     *     config: { exclude: ['api::invoice.invoice'] },
     *   }
     */
    exclude: [] as string[],

    /**
     * The most documents one request will read out.
     *
     * An export holds its whole result in memory before writing it, so this is
     * the honest limit rather than a policy: past it, use the filters.
     */
    maxExport: 10_000,
  },
  validator(config: { exclude?: unknown; maxExport?: unknown }) {
    if (config.exclude !== undefined && !Array.isArray(config.exclude)) {
      throw new Error('[ferry] `exclude` must be an array of content-type uids.');
    }
    if (
      config.maxExport !== undefined &&
      (typeof config.maxExport !== 'number' || config.maxExport <= 0)
    ) {
      throw new Error('[ferry] `maxExport` must be a positive number.');
    }
  },
};
