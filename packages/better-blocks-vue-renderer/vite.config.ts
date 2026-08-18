import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Library build. Unlike the Astro renderer, which ships its `.astro` source and
 * lets the consumer's build compile it, a Vue package is expected to arrive
 * pre-compiled: Vite does not process `.vue` files inside `node_modules` unless
 * the app opts in, so shipping source would make every consumer add a
 * `build.transpile` entry before the first block renders.
 *
 * ESM only. Every environment that can render a Vue SFC - Vite, Nuxt's Nitro
 * server bundle, Vitest - is ESM, and a second CJS copy of the components would
 * only invite the dual-package hazard around Vue's own runtime.
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      include: ['src'],
      // Type declarations for the SFCs come from vue-tsc, which vite-plugin-dts
      // drives for us; the components are typed from their `defineProps`.
      staticImport: true,
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.mjs',
      cssFileName: 'style',
    },
    rollupOptions: {
      // Vue is the consumer's; KaTeX, the Mermaid renderer and Shiki are real
      // `dependencies`, so `npm install` still brings them - they are left
      // external rather than bundled. That keeps Shiki's dynamic import a real
      // chunk boundary (it is client-only and must stay out of the server
      // bundle), and stops a second copy of KaTeX from landing in an app that
      // already uses it.
      external: [
        'vue',
        'katex',
        'shiki',
        'beautiful-mermaid',
        /^katex\//,
        /^shiki\//,
        /^beautiful-mermaid\//,
      ],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
