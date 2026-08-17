/**
 * The same string as `strapi.name` in package.json, and the same one the user
 * writes in `config/plugins.ts`.
 *
 * Deliberately not `review-workflows`: Strapi registers a plugin under that name
 * in the stock Community Edition build, so it was never available. Everything
 * here — the package, the plugin id, the table prefix, the config key — is
 * `greenlight` so that there is only ever one name to remember. A user who
 * copies the package name into their config gets a working plugin rather than a
 * silent no-op.
 */
export const PLUGIN_ID = 'greenlight';
