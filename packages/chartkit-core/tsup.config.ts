import { defineConfig } from 'tsup';

export default defineConfig({
  // The fixture set ships as its own entry point. It is deliberately public:
  // it is the set of inputs that break chart geometry, so it is what the
  // gallery renders and what anyone extending this package should test
  // against — and keeping it out of the main entry means it costs nothing to
  // consumers who never import it.
  entry: ['src/index.ts', 'src/fixtures.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // The d3 modules are ESM-only, so a CJS build cannot require() them. They are
  // bundled in rather than declared as dependencies, which also means tree
  // shaking cuts them down to the handful of functions this package calls —
  // consumers never ship the parts of d3 we do not use.
  noExternal: [/^d3-/],
});
