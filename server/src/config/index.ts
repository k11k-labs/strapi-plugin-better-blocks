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
    /**
     * Defaults for the WordPress-style Button block. `defaultStyle` is applied to
     * a freshly inserted button; authors can then override it per-button.
     */
    button: {
      defaultStyle: {
        backgroundColor: '#4945ff',
        textColor: '#ffffff',
        borderRadius: '4px',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: '600',
      },
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
