import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Library build, matching the Better Blocks Vue renderer: a `.vue` file has to
 * arrive pre-compiled, because Vite does not process SFCs inside `node_modules`
 * unless the consumer opts in. ESM only.
 */
export default defineConfig({
  plugins: [vue(), dts({ entryRoot: 'src', include: ['src'], staticImport: true })],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      // Vue and the Better Blocks renderer belong to the consumer; the chart
      // engine is a real dependency, left external so an app that draws charts
      // outside a document links against one copy of it.
      external: ['vue', '@qkix/chartkit-core', '@qkix/better-blocks-vue-renderer'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
