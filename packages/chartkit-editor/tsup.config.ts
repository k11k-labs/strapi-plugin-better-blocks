import { defineConfig } from 'tsup';

export default defineConfig({
  // Two entries, not one. `block` is the only thing here that imports Slate,
  // and the standalone custom field uses this package without it — bundling
  // them together would make a data grid drag an editor framework along.
  entry: ['src/index.ts', 'src/block.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@strapi/design-system',
    '@strapi/icons',
    'styled-components',
    'slate',
    'slate-react',
  ],
});
