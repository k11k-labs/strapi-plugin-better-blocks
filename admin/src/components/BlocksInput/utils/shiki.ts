import {
  createHighlighter,
  bundledLanguages,
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
} from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/* ---------------------------------------------------------------------------
 * Lazy singleton Shiki highlighter
 *
 * Slate's `decorate` callback is synchronous, but creating a Shiki highlighter
 * (and loading individual grammars) is async. We keep a module-level singleton
 * that `decorate` can poll: it returns `null`/`false` until ready, and notifies
 * subscribers once the highlighter (or a freshly requested language) finishes
 * loading so the editor can re-decorate.
 * -------------------------------------------------------------------------*/

export const LIGHT_THEME = 'github-light';
export const DARK_THEME = 'github-dark';

// A small set of common languages loaded up-front; everything else is loaded
// on demand via ensureLanguage().
const INITIAL_LANGS = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'bash',
  'html',
  'css',
  'python',
];

// Plugin language values whose id differs from the Shiki grammar id.
const LANG_ALIASES: Record<string, string> = {
  objectivec: 'objective-c',
  fortran: 'fortran-free-form',
  vbnet: 'vb',
};

let highlighter: Highlighter | null = null;
let initStarted = false;
const loadedLangs = new Set<string>();
const loadingLangs = new Set<string>();
const listeners = new Set<() => void>();

// Cache tokenization results: identical (lang|theme|text) is common across
// re-renders/keystrokes, and re-tokenizing on every decorate pass is wasteful.
const tokenCache = new Map<string, unknown>();
const MAX_CACHE_ENTRIES = 200;

const notify = () => {
  listeners.forEach((cb) => cb());
};

/**
 * Subscribe to highlighter/language load events. Returns an unsubscribe fn.
 */
export const subscribeShiki = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/**
 * Map a plugin code language value to a Shiki grammar id, or `null` when there
 * is no highlighting to apply (plaintext / unknown).
 */
export const normalizeLang = (value?: string): string | null => {
  if (!value || value === 'plaintext' || value === 'text') {
    return null;
  }
  const id = LANG_ALIASES[value] ?? value;
  return id in bundledLanguages ? id : null;
};

/**
 * Return the highlighter instance, kicking off async init on first call.
 * Returns `null` until the highlighter is ready.
 */
export const getShiki = (): Highlighter | null => {
  if (!initStarted) {
    initStarted = true;
    createHighlighter({
      themes: [LIGHT_THEME, DARK_THEME],
      langs: INITIAL_LANGS,
      // Use the pure-JS regex engine instead of the default oniguruma WASM
      // engine: Strapi's admin CSP forbids 'unsafe-eval', which WebAssembly
      // instantiation requires. `forgiving` skips grammar patterns the JS
      // engine can't translate rather than throwing.
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
      .then((hl) => {
        highlighter = hl;
        INITIAL_LANGS.forEach((l) => loadedLangs.add(l));
        notify();
      })
      .catch(() => {
        // Highlighting is a progressive enhancement; ignore init failures.
      });
  }
  return highlighter;
};

/**
 * Ensure a Shiki grammar is loaded. Returns `true` when ready to tokenize,
 * `false` while loading (a `notify()` fires once it resolves).
 */
export const ensureLanguage = (lang: string): boolean => {
  if (!highlighter) {
    return false;
  }
  if (loadedLangs.has(lang)) {
    return true;
  }
  if (loadingLangs.has(lang)) {
    return false;
  }
  if (!(lang in bundledLanguages)) {
    return false;
  }
  loadingLangs.add(lang);
  highlighter
    .loadLanguage(lang as keyof typeof bundledLanguages)
    .then(() => {
      loadedLangs.add(lang);
      loadingLangs.delete(lang);
      notify();
    })
    .catch(() => {
      loadingLangs.delete(lang);
    });
  return false;
};

type CachedTokens = ReturnType<Highlighter['codeToTokens']>;

/**
 * Tokenize `code` with caching. Caller must have confirmed the highlighter and
 * language are ready (getShiki()/ensureLanguage()).
 */
export const tokenizeCode = (
  code: string,
  lang: string,
  theme: string
): CachedTokens | null => {
  const hl = highlighter;
  if (!hl) {
    return null;
  }
  const key = `${lang}|${theme}|${code}`;
  const cached = tokenCache.get(key);
  if (cached) {
    return cached as CachedTokens;
  }
  let result: CachedTokens;
  try {
    result = hl.codeToTokens(code, {
      lang: lang as BundledLanguage,
      theme: theme as BundledTheme,
    });
  } catch {
    return null;
  }
  if (tokenCache.size >= MAX_CACHE_ENTRIES) {
    // Cheap eviction: drop the oldest inserted entry.
    const oldest = tokenCache.keys().next().value;
    if (oldest !== undefined) {
      tokenCache.delete(oldest);
    }
  }
  tokenCache.set(key, result);
  return result;
};
