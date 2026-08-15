import astro from '@qkix/eslint-config/astro';

export default [
  ...astro,
  { ignores: ['playground/**', 'docs/**'] },
  {
    // Fixtures stand in for components a consumer would write, so their
    // frontmatter destructures the whole prop contract the renderer passes,
    // used or not. That is the point of the fixture, not an oversight.
    files: ['tests/fixtures/**'],
    rules: { 'no-unused-vars': 'off' },
  },
];
