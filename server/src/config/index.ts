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
     * `presets` are brand variants offered in the editor's "Style preset" picker;
     * override any of them to match your design system.
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
      presets: {
        primary: {
          backgroundColor: '#4945ff',
          textColor: '#ffffff',
          border: 'none',
        },
        secondary: {
          backgroundColor: '#dcdce4',
          textColor: '#32324d',
          border: 'none',
        },
        outline: {
          backgroundColor: 'transparent',
          textColor: '#4945ff',
          border: '2px solid #4945ff',
        },
        filled: {
          backgroundColor: '#32324d',
          textColor: '#ffffff',
          border: 'none',
        },
      },
    },
    /**
     * Social media embed block. The editor fetches each post's official embed
     * via the server oEmbed proxy (`GET /better-blocks/oembed`), so no platform
     * tokens ever reach the browser. Instagram and Facebook require a Facebook
     * app access token; the other platforms work without one.
     *
     *   'better-blocks': {
     *     config: {
     *       social: {
     *         platforms: ['twitter', 'tiktok', 'pinterest'],
     *         instagram: { accessToken: env('FB_OEMBED_TOKEN') },
     *         facebook: { accessToken: env('FB_OEMBED_TOKEN') },
     *       },
     *     },
     *   }
     */
    social: {
      enabled: true,
      platforms: [
        'twitter',
        'instagram',
        'facebook',
        'tiktok',
        'linkedin',
        'pinterest',
      ],
      cache: true,
      cacheTTL: 86400, // seconds (24h)
      instagram: { accessToken: undefined },
      facebook: { accessToken: undefined },
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
