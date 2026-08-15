import { describe, it, expect } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  detectSchemaVersion,
  migrateDocument,
  validateDocument,
} from '../src';
import type { BlocksContent } from '../src';

const mediaEmbed = (url: string, originalUrl?: string) =>
  ({
    type: 'media-embed',
    url,
    ...(originalUrl ? { originalUrl } : {}),
    children: [{ type: 'text', text: '' }],
  }) as unknown as BlocksContent[number];

const paragraph = {
  type: 'paragraph',
  children: [{ type: 'text', text: 'untouched' }],
} as BlocksContent[number];

describe('detectSchemaVersion', () => {
  it('treats a document containing media-embed as version 1', () => {
    expect(detectSchemaVersion([mediaEmbed('https://example.com/embed')])).toBe(1);
  });

  it('treats everything else as current, including an empty document', () => {
    expect(detectSchemaVersion([])).toBe(CURRENT_SCHEMA_VERSION);
    expect(detectSchemaVersion([paragraph])).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('migrateDocument', () => {
  it('returns a current document untouched, by reference', () => {
    const content: BlocksContent = [paragraph];
    const result = migrateDocument(content);
    expect(result.changed).toBe(false);
    expect(result.from).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.content).toBe(content);
  });

  it('converts media-embed into the embed block that replaced it', () => {
    const result = migrateDocument([mediaEmbed('https://player.vimeo.com/video/123')]);

    expect(result.changed).toBe(true);
    expect(result.from).toBe(1);
    expect(result.to).toBe(CURRENT_SCHEMA_VERSION);

    const node = result.content[0] as Record<string, unknown>;
    expect(node.type).toBe('embed');
    expect(node.source).toBe('url');
    expect(node.embedSrc).toBe('https://player.vimeo.com/video/123');
    // The old block hardcoded 16:9; the new one has to say so explicitly.
    expect(node.aspectRatio).toBe('16:9');
  });

  it('rebuilds the same iframe the old block rendered', () => {
    const result = migrateDocument([mediaEmbed('https://player.vimeo.com/video/123')]);
    const html = (result.content[0] as Record<string, string>).embedHtml;

    expect(html).toContain('src="https://player.vimeo.com/video/123"');
    expect(html).toContain('allowfullscreen');
    expect(html).toContain('width:100%');
    expect(html).toContain('height:100%');
  });

  it('keeps the original watch url when the old block carried one', () => {
    const result = migrateDocument([
      mediaEmbed('https://www.youtube.com/embed/abc', 'https://www.youtube.com/watch?v=abc'),
    ]);
    const node = result.content[0] as Record<string, unknown>;
    expect(node.url).toBe('https://www.youtube.com/watch?v=abc');
    expect(node.embedSrc).toBe('https://www.youtube.com/embed/abc');
  });

  it('escapes the url so it cannot break out of the attribute', () => {
    const result = migrateDocument([
      mediaEmbed('https://example.com/a"><script>alert(1)</script>'),
    ]);
    const html = (result.content[0] as Record<string, string>).embedHtml;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });

  it('leaves a media-embed it cannot vouch for alone, and says why', () => {
    const content = [mediaEmbed('javascript:alert(1)')];
    const result = migrateDocument(content);

    expect(result.changed).toBe(false);
    expect((result.content[0] as Record<string, unknown>).type).toBe('media-embed');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toEqual({
      path: '[0]',
      reason: 'media-embed has no usable http(s) url, so no iframe could be built for it',
    });
  });

  it('does not mutate the input', () => {
    const content: BlocksContent = [mediaEmbed('https://example.com/e')];
    const snapshot = JSON.stringify(content);
    migrateDocument(content);
    expect(JSON.stringify(content)).toBe(snapshot);
  });

  it('carries surrounding blocks over untouched, by reference', () => {
    const content: BlocksContent = [paragraph, mediaEmbed('https://example.com/e'), paragraph];
    const result = migrateDocument(content);
    expect(result.content[0]).toBe(paragraph);
    expect(result.content[2]).toBe(paragraph);
  });

  it('produces a document that validates, and is then already current', () => {
    const result = migrateDocument([mediaEmbed('https://example.com/e')]);
    expect(validateDocument(result.content).valid).toBe(true);
    expect(detectSchemaVersion(result.content)).toBe(CURRENT_SCHEMA_VERSION);
    // Running it again is a no-op.
    expect(migrateDocument(result.content).changed).toBe(false);
  });
});
