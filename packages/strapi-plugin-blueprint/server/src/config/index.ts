export default {
  default: {
    /**
     * Uids never to draw, whatever the UI asks for.
     *
     * For schemas with a corner nobody wants on the picture - a bulky
     * integration type, a legacy import table. The UI can hide things too; this
     * is the version that survives a page reload and applies to the API as well.
     *
     *   blueprint: {
     *     enabled: true,
     *     config: { exclude: ['api::import-log.import-log'] },
     *   }
     */
    exclude: [] as string[],
  },
  validator(config: { exclude?: unknown }) {
    if (config.exclude !== undefined && !Array.isArray(config.exclude)) {
      throw new Error('[blueprint] `exclude` must be an array of content-type uids.');
    }
  },
};
