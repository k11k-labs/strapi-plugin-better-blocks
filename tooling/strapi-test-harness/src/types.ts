/**
 * Minimal shapes for the fixture app. These deliberately mirror the JSON files
 * a real Strapi app keeps on disk, because that is exactly what the harness
 * writes out — no in-memory registry shortcuts, so what boots here boots the
 * same way in a customer's project.
 */

export interface ContentTypeSchema {
  kind?: 'collectionType' | 'singleType';
  collectionName?: string;
  info: {
    singularName: string;
    pluralName: string;
    displayName: string;
    description?: string;
  };
  options?: Record<string, unknown>;
  pluginOptions?: Record<string, unknown>;
  attributes: Record<string, Record<string, unknown>>;
}

export interface ComponentSchema {
  collectionName?: string;
  info: {
    displayName: string;
    icon?: string;
    description?: string;
  };
  options?: Record<string, unknown>;
  attributes: Record<string, Record<string, unknown>>;
}

export interface PluginSpec {
  enabled: boolean;
  /**
   * Absolute path to the plugin package, or a resolvable package name. Workspace
   * packages are never discovered automatically (see the note in the example
   * app's config/plugins.ts), so tests always pass this explicitly.
   */
  resolve?: string;
  config?: Record<string, unknown>;
}

export interface TestStrapiOptions {
  /**
   * Content types keyed by API name. The API name is what shows up in the uid:
   * `{ article: schema }` yields `api::article.article`.
   */
  contentTypes?: Record<string, ContentTypeSchema>;
  /** Components keyed by `category.name`, e.g. `'blocks.author-card'`. */
  components?: Record<string, ComponentSchema>;
  /** Plugins to load, keyed by the Strapi plugin name (not the package name). */
  plugins?: Record<string, PluginSpec>;
  /**
   * i18n locales to create after bootstrap. The first entry becomes the default.
   * Leave empty to boot without localisation.
   */
  locales?: Array<{ code: string; name?: string; isDefault?: boolean }>;
  /** Extra keys merged into the generated `config/server.js`. */
  serverConfig?: Record<string, unknown>;
  /** Called after `register()` but before `bootstrap()`, with the live instance. */
  onRegistered?: (strapi: TestStrapi) => void | Promise<void>;
  /** Keep the temp app directory on disk after teardown, and log its path. */
  keepAppDir?: boolean;
}

/**
 * The booted instance. Typed loosely on purpose: `@strapi/strapi` exports its
 * Core.Strapi type, but pinning to it here would make the harness fail to
 * typecheck on every Strapi minor. Tests that want the precise type cast at the
 * call site.
 */
export type TestStrapi = {
  documents: any;
  db: any;
  plugin: (name: string) => any;
  service: (uid: string) => any;
  getModel: (uid: string) => any;
  contentTypes: Record<string, any>;
  store: any;
  log: any;
  destroy: () => Promise<void>;
  [key: string]: any;
};

export interface TestStrapiInstance {
  strapi: TestStrapi;
  /** Temp directory holding the generated app. Removed on `destroy()`. */
  appDir: string;
  /** Path to the SQLite file, for tests that want to inspect it directly. */
  dbFile: string;
  destroy: () => Promise<void>;
}
