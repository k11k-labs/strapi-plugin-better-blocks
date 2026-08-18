/**
 * Nuxt module for `@qkix/better-blocks-vue-renderer`.
 *
 * The components work in Nuxt without it - they are ordinary Vue 3 SFCs. What
 * the module removes is the setup every Nuxt app would otherwise write by hand:
 * registering `<BlocksRenderer>` as an auto-imported component and adding the
 * two stylesheets (the renderer's own, and KaTeX's, which server-rendered math
 * needs to display correctly).
 *
 * Plain JavaScript on purpose: a Nuxt module is loaded by the app's build, not
 * bundled into ours, so shipping it as source with a hand-written `.d.ts` keeps
 * it out of the library build entirely.
 *
 *   export default defineNuxtConfig({
 *     modules: ['@qkix/better-blocks-vue-renderer/nuxt'],
 *   })
 */
import { createRequire } from 'node:module';

import { addComponent, defineNuxtModule } from '@nuxt/kit';

const PACKAGE = '@qkix/better-blocks-vue-renderer';

// Resolves from this file, so KaTeX is found in the renderer's own dependencies
// rather than the app's - it stays installed even under a strict node_modules layout.
const localRequire = createRequire(import.meta.url);

export default defineNuxtModule({
  meta: {
    name: PACKAGE,
    configKey: 'betterBlocks',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    prefix: '',
    css: true,
    katexCss: true,
    components: true,
  },
  setup(options, nuxt) {
    if (options.css !== false) {
      nuxt.options.css.push(`${PACKAGE}/style.css`);
    }

    if (options.katexCss !== false) {
      try {
        nuxt.options.css.push(localRequire.resolve('katex/dist/katex.min.css'));
      } catch {
        // KaTeX is a dependency of this package, so this should not happen -
        // but a missing stylesheet is not worth failing the whole build over.
        // Math still renders; it just falls back to unstyled markup.
      }
    }

    if (options.components !== false) {
      addComponent({
        name: `${options.prefix ?? ''}BlocksRenderer`,
        export: 'BlocksRenderer',
        filePath: PACKAGE,
      });
    }
  },
});
