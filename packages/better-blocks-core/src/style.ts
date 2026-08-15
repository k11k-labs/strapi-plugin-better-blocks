import type { BlockStyle } from './types';

// ── Block Style Attributes ───────────────────────────────────────────

/**
 * Maps a block's alignment, line-height and indent onto a neutral style record.
 * Returns `undefined` when nothing applies, so the element renders with no
 * `style` attribute at all.
 */
export function getBlockStyle(block: {
  textAlign?: string;
  lineHeight?: string;
  indent?: number;
}): BlockStyle | undefined {
  const style: Record<string, string> = {};
  if (block.textAlign) style.textAlign = block.textAlign;
  if (block.lineHeight) style.lineHeight = block.lineHeight;
  if (block.indent) style.marginLeft = `${block.indent * 2}rem`;
  return Object.keys(style).length > 0 ? style : undefined;
}
