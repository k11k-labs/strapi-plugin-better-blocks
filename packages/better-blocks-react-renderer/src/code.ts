// ── Code Language Normalization ──────────────────────────────────────
//
// Kept byte-for-byte in sync with the Astro renderer's equivalent so both
// resolve a given editor value to the same Shiki grammar.

/**
 * The languages the Better Blocks editor can attach to a `code` block. Every
 * value here maps to a Shiki grammar (directly or via {@link CODE_LANG_ALIASES}),
 * so the highlighter never receives a name it can't load.
 */
const CODE_LANGUAGES = new Set([
  'asm',
  'bash',
  'c',
  'clojure',
  'cobol',
  'cpp',
  'csharp',
  'css',
  'dart',
  'dockerfile',
  'elixir',
  'erlang',
  'fortran',
  'fsharp',
  'go',
  'graphql',
  'groovy',
  'haskell',
  'haxe',
  'html',
  'ini',
  'java',
  'javascript',
  'jsx',
  'json',
  'julia',
  'kotlin',
  'latex',
  'lua',
  'markdown',
  'matlab',
  'makefile',
  'objectivec',
  'perl',
  'php',
  'plaintext',
  'powershell',
  'python',
  'r',
  'ruby',
  'rust',
  'sas',
  'scala',
  'scheme',
  'shell',
  'sql',
  'stata',
  'swift',
  'typescript',
  'tsx',
  'vbnet',
  'xml',
  'yaml',
]);

/**
 * Editor language values (and a few common shorthands) whose Shiki grammar id
 * differs from the stored value. Anything not covered here is passed through
 * unchanged when it's a known language, or falls back to `plaintext`.
 */
const CODE_LANG_ALIASES: Record<string, string> = {
  fortran: 'fortran-free-form',
  objectivec: 'objective-c',
  vbnet: 'vb',
  ts: 'typescript',
  yml: 'yaml',
  shell: 'bash',
};

/**
 * Resolves a `code` block's `language` to a Shiki grammar name. Unknown or
 * missing languages become `plaintext` (rendered themed but unhighlighted) so a
 * stray value never breaks rendering.
 */
export function normalizeCodeLang(language?: string): string {
  if (!language) return 'plaintext';
  const lang = language.toLowerCase();
  // Aliases win over the known-language set, so `shell` still resolves to the
  // `bash` grammar even though it's a valid editor value in its own right.
  const alias = CODE_LANG_ALIASES[lang];
  if (alias) return alias;
  return CODE_LANGUAGES.has(lang) ? lang : 'plaintext';
}
