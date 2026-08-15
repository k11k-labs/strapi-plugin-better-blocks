import react from '@k11k/eslint-config/react';

export default [
  ...react,
  {
    ignores: [
      'playground/**',
      'docs/**',
      // Compiled output emitted next to the TypeScript sources (gitignored).
      'server/src/**/*.js',
    ],
  },
];
