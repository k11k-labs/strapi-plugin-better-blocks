import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.tsx', '**/*.jsx'],
    // Registered, but with no rules switched on. The codebase already carries
    // `eslint-disable react/…` and `react-hooks/…` comments; without the
    // plugins loaded ESLint fails on the unknown rule names. Turning their
    // rule sets on is a separate decision.
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
