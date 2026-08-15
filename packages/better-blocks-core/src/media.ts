// ── Media Aspect Ratios ──────────────────────────────────────────────

/**
 * Converts a block's `aspectRatio` to a CSS `aspect-ratio` value: `"16:9"` →
 * `"16 / 9"`, and `"custom"` → `customAspectRatio` verbatim. Falls back to
 * 16:9, the ratio the deprecated `media-embed` block hard-coded.
 */
export function getAspectRatio(aspectRatio?: string, customAspectRatio?: string): string {
  if (aspectRatio === 'custom') return customAspectRatio?.trim() || '16 / 9';
  if (aspectRatio?.includes(':')) return aspectRatio.replace(':', ' / ');
  return aspectRatio?.trim() || '16 / 9';
}
