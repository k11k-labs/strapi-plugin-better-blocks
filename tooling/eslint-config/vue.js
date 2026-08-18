import globals from 'globals';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';

import base, { boundaries } from './base.js';

export default [
  ...base,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // Same reasoning as the .ts block in base.js: a component's script is
      // TypeScript, which already reports undefined identifiers and knows about
      // type-only globals the base rules cannot see.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      // A renderer component maps one document node to one element; naming them
      // `TableCell` to satisfy multi-word would only make them harder to line up
      // with the block types they draw.
      'vue/multi-word-component-names': 'off',
      // Prettier owns formatting here as it does everywhere else in the repo.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      // A renderer's templates are whitespace-sensitive: a line break the rule
      // asks for around `{{ }}` becomes a space in the rendered text. Where an
      // element's content is written tight, that is deliberate.
      'vue/multiline-html-element-content-newline': 'off',
      // `v-html` is how a renderer emits markup it produced itself (KaTeX,
      // Mermaid, Shiki) or markup the CMS is trusted for (oEmbed payloads). The
      // trust boundary is documented per call site and in the README.
      'vue/no-v-html': 'off',
    },
  },
  // The boundary rule has to see .vue files too - the Vue renderer's imports
  // live in component script blocks, not only in .ts files.
  { ...boundaries, files: ['**/*.vue'] },
];
