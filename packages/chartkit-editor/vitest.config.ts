import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

/** The workspace root, where the hoisted React lives. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  // This package pins React 18 while the workspace root carries 19, and with a
  // hoisted linker a test can end up calling React 18's hooks through React
  // 19's renderer - which surfaces as `Cannot read properties of null (reading
  // 'useState')` rather than as anything resembling a version conflict.
  //
  // Testing Library is hoisted to the root and pulls React 19 with it, so the
  // root copy is the one that has to win; aliasing to this package's React 18
  // leaves the renderer on 19 and the conflict intact. Hooks behave the same in
  // both, and the shipped code runs against whatever React the host provides.
  resolve: {
    alias: {
      react: require.resolve('react', { paths: [ROOT] }),
      'react-dom': require.resolve('react-dom', { paths: [ROOT] }),
      'react-dom/client': require.resolve('react-dom/client', { paths: [ROOT] }),
      'react/jsx-runtime': require.resolve('react/jsx-runtime', { paths: [ROOT] }),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Testing Library lives in the hoisted root, so its own `react-dom/client`
    // import resolves from there and bypasses the aliases above unless it is
    // processed by Vite rather than required straight off disk.
    server: {
      deps: { inline: ['@testing-library/react'] },
    },
  },
});
