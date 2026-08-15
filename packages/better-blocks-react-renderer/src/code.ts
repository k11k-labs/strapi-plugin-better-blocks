/**
 * Code language resolution moved to `@k11k/better-blocks-core`, where the Astro
 * renderer reads it from too. Re-exported so this package's imports — and the
 * tests that pinned the behaviour down — keep working unchanged.
 */
export { normalizeCodeLang } from '@k11k/better-blocks-core';
