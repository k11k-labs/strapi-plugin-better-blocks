/**
 * The icon shown against the field in the content-type builder.
 *
 * Drawn here rather than taken from `@strapi/icons`, which has no chart glyph
 * that reads as one at 16px.
 */
const PluginIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 14V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="4" y="7" width="2.5" height="5" fill="currentColor" />
    <rect x="8" y="4" width="2.5" height="8" fill="currentColor" />
    <rect x="12" y="9" width="2.5" height="3" fill="currentColor" />
  </svg>
);

export { PluginIcon };
