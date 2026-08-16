/**
 * Vitest options every suite that boots Strapi needs. See the JavaScript file
 * for why each one is here, and why it is not written in TypeScript.
 */
export declare const strapiTestOptions: {
  testTimeout: number;
  hookTimeout: number;
  pool: 'threads';
};
