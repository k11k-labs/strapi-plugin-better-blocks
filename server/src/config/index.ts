export default {
  default: {
    /**
     * Defaults for the collapsible Details / Summary block.
     * Override in the consuming app via config/plugins.{js,ts}:
     *
     *   'better-blocks': {
     *     enabled: true,
     *     config: {
     *       details: {
     *         defaultSummary: 'Show more',
     *         style: 'custom', // 'github' | 'custom'
     *       },
     *     },
     *   }
     */
    details: {
      defaultSummary: 'Click to expand',
      style: 'github',
    },
  },
  validator(config: { details?: { style?: string } } = {}) {
    const style = config?.details?.style;
    if (style && style !== 'github' && style !== 'custom') {
      throw new Error(
        `[better-blocks] config.details.style must be "github" or "custom" (received "${style}")`
      );
    }
  },
};
