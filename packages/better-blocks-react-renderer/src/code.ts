/**
 * Code language resolution moved to `@qkix/better-blocks-core`, where the Astro
 * renderer reads it from too. Re-exported so this package's imports - and the
 * tests that pinned the behavior down - keep working unchanged.
 */
export { normalizeCodeLang } from '@qkix/better-blocks-core';
