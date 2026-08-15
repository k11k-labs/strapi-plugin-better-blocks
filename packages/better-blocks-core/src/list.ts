// ── List Style Cycling ───────────────────────────────────────────────

const orderedStyles = ['decimal', 'lower-alpha', 'upper-roman'];
const unorderedStyles = ['disc', 'circle', 'square'];

/**
 * The `list-style-type` for a list at a given nesting depth. Styles cycle, so
 * deeply nested lists keep alternating instead of repeating one marker.
 */
export function getListStyleType(format: 'ordered' | 'unordered', indentLevel: number): string {
  const styles = format === 'ordered' ? orderedStyles : unorderedStyles;
  return styles[indentLevel % styles.length];
}
