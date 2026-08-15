import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint exists in this repo for one reason: to enforce the dependency
 * direction between packages mechanically instead of describing it in a README.
 * The rule set is deliberately small — this was added to a codebase that had
 * never run ESLint, so switching on the full recommended sets would bury the
 * boundary violations we actually care about under thousands of pre-existing
 * findings. Style is prettier's job; correctness is TypeScript's.
 */
export const ignores = {
  ignores: [
    '**/dist/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/.astro/**',
    '**/.strapi/**',
    '**/.tmp/**',
    '**/build/**',
  ],
};

/**
 * Every package may only depend on packages its tag allows. `scope:core` is a
 * leaf; renderers and plugins may reach into core but never into each other,
 * and nothing may ever depend on a strapi-plugin-* package — installing a
 * renderer must not drag an editor plugin along.
 *
 * Note when testing this rule: it only inspects imports it can resolve to a
 * project. The Strapi plugin publishes no "." export, only ./strapi-admin and
 * ./strapi-server, so a bare `import '@k11k/strapi-plugin-better-blocks'`
 * resolves to nothing and is skipped — it would not build either. Verify with
 * a real entry point, e.g. '@k11k/strapi-plugin-better-blocks/strapi-admin'.
 */
export const boundaries = {
  files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
  plugins: { '@nx': nx },
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        // tooling/* are private, non-buildable config packages that every
        // package legitimately imports from its eslint.config.mjs. This
        // sub-option is about Nx's buildable-library notion, not about the
        // scope constraints below, which are the point of this rule.
        enforceBuildableLibDependency: false,
        allow: [],
        depConstraints: [
          {
            // Build-time config only; tooling/* ships no runtime code.
            sourceTag: 'scope:tooling',
            onlyDependOnLibsWithTags: ['scope:tooling'],
          },
          {
            sourceTag: 'scope:core',
            onlyDependOnLibsWithTags: ['scope:tooling'],
          },
          {
            sourceTag: 'scope:renderer',
            onlyDependOnLibsWithTags: ['scope:core', 'scope:tooling'],
          },
          {
            sourceTag: 'scope:plugin',
            onlyDependOnLibsWithTags: ['scope:core', 'scope:tooling'],
          },
          {
            sourceTag: 'scope:example',
            onlyDependOnLibsWithTags: [
              'scope:core',
              'scope:renderer',
              'scope:plugin',
              'scope:tooling',
            ],
          },
        ],
      },
    ],
  },
};

export default [
  ignores,
  {
    linterOptions: {
      // With a rule set this small, most inline eslint-disable comments in the
      // codebase refer to rules we deliberately do not enable. Reporting them
      // as unused would be noise, not signal.
      reportUnusedDisableDirectives: 'off',
    },
  },
  js.configs.recommended,
  // The parser only — not the recommended rule set. See the note above.
  tseslint.configs.base,
  boundaries,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // TypeScript already reports genuinely undefined identifiers, and the
      // base rule cannot see type-only globals.
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    rules: {
      // Flags `let x = <initial>` that every branch immediately overwrites.
      // That pattern reads fine and the rule finds no bugs here — it only
      // asks for source churn in code this stage is not meant to touch.
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
