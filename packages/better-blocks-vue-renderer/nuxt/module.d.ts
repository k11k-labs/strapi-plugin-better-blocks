import type { NuxtModule } from '@nuxt/schema';

export interface ModuleOptions {
  /**
   * Prefix for the auto-imported component name, e.g. `'Bb'` registers
   * `<BbBlocksRenderer>`. Empty by default.
   */
  prefix?: string;
  /** Add the renderer's stylesheet to `nuxt.options.css`. On by default. */
  css?: boolean;
  /**
   * Add KaTeX's stylesheet, which server-rendered math needs to display
   * correctly. On by default; turn it off if the app imports it itself.
   */
  katexCss?: boolean;
  /** Register `<BlocksRenderer>` as an auto-imported component. On by default. */
  components?: boolean;
}

declare const module: NuxtModule<ModuleOptions>;
export default module;

declare module '@nuxt/schema' {
  interface NuxtConfig {
    betterBlocks?: ModuleOptions;
  }
  interface NuxtOptions {
    betterBlocks?: ModuleOptions;
  }
}
