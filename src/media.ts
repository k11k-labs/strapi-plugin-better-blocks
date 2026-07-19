import type { CSSProperties } from 'react';

import type { AspectRatio, MediaAlignment } from './types';

// Alignment → flexbox cross-axis placement of the media box within its figure.
// `none` stretches it to fill the available width. Mirrors the `audio` block.
export const MEDIA_ALIGN_ITEMS: Record<MediaAlignment, CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
  none: 'stretch',
};

// Width cap for aligned media. Without it `left` / `center` / `right` would all
// look identical, since a full-width box has nowhere to sit. `none` opts out.
export const MEDIA_MAX_WIDTH = '48rem';

/**
 * Converts the block's `aspectRatio` to a CSS `aspect-ratio` value: `"16:9"` →
 * `"16 / 9"`, and `"custom"` → `customAspectRatio` verbatim. Falls back to 16:9,
 * which matches the aspect the (deprecated) `media-embed` block hard-coded.
 */
export function getAspectRatio(aspectRatio?: AspectRatio, customAspectRatio?: string): string {
  if (aspectRatio === 'custom') return customAspectRatio?.trim() || '16 / 9';
  return aspectRatio ? aspectRatio.replace(':', ' / ') : '16 / 9';
}

/** Figure wrapper shared by the `embed` and `video` blocks. */
export function getMediaFigureStyle(alignment: MediaAlignment): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    margin: '1rem 0',
    alignItems: MEDIA_ALIGN_ITEMS[alignment],
  };
}

/** The aspect-ratio box holding the iframe / video element. */
export function getMediaFrameStyle(alignment: MediaAlignment, aspectRatio: string): CSSProperties {
  return {
    width: '100%',
    maxWidth: alignment === 'none' ? '100%' : MEDIA_MAX_WIDTH,
    aspectRatio,
  };
}

export const MEDIA_CAPTION_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  color: '#6b7280',
};
