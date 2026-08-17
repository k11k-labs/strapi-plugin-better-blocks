import astro from 'eslint-plugin-astro';

import base, { boundaries } from './base.js';

export default [
  ...base,
  ...astro.configs.recommended,
  // The boundary rule has to see .astro files too - the Astro renderer's
  // imports live in component frontmatter, not in .ts files.
  { ...boundaries, files: ['**/*.astro'] },
];
