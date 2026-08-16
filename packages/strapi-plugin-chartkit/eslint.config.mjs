import react from '@qkix/eslint-config/react';

export default [
  ...react,
  {
    ignores: [
      // Compiled output emitted next to the TypeScript sources (gitignored).
      'server/src/**/*.js',
    ],
  },
];
