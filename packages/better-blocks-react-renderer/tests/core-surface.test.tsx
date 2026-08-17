import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { BlocksRenderer } from '../src';
import { getAspectRatio } from '../src/media';
import { migrateDocument } from '@qkix/better-blocks-core';
import type { BlocksContent } from '../src';

/**
 * Characterization tests for the framework-independent behavior this renderer
 * shares with the Astro one. They pin down today's output so extracting the
 * shared core can be shown to change nothing: the same expectations run against
 * both renderers before the move and against the core package after it.
 *
 * Most of these helpers are module-private here, so the shared behavior is
 * asserted through rendered markup rather than by calling them directly.
 */

describe('getAspectRatio', () => {
  it('converts a colon ratio to a CSS ratio', () => {
    expect(getAspectRatio('16:9')).toBe('16 / 9');
    expect(getAspectRatio('4:3')).toBe('4 / 3');
    expect(getAspectRatio('21:9')).toBe('21 / 9');
    expect(getAspectRatio('1:1')).toBe('1 / 1');
  });

  it('uses the custom value verbatim when the ratio is "custom"', () => {
    expect(getAspectRatio('custom', '2 / 1')).toBe('2 / 1');
    expect(getAspectRatio('custom', '  2 / 1  ')).toBe('2 / 1');
  });

  it('falls back to 16 / 9 when custom is blank or missing', () => {
    expect(getAspectRatio('custom', '   ')).toBe('16 / 9');
    expect(getAspectRatio('custom')).toBe('16 / 9');
  });

  it('falls back to 16 / 9 when no ratio is given', () => {
    expect(getAspectRatio()).toBe('16 / 9');
  });
});

describe('text mark nesting', () => {
  it('nests every mark outer to inner in a fixed order', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: 'styled',
            bold: true,
            italic: true,
            underline: true,
            strikethrough: true,
            code: true,
            uppercase: true,
            superscript: true,
            subscript: true,
            color: '#f00',
            backgroundColor: '#ff0',
            fontFamily: 'serif',
            fontSize: '2rem',
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);

    // fontSize is outermost and code innermost - the Astro renderer builds the
    // same order from buildTextMarks(), so both produce identical nesting.
    const chain = [
      'span[style*="font-size"]',
      'span[style*="font-family"]',
      'span[style*="background-color"]',
      'span[style*="color"]',
      'strong',
      'em',
      'span[style*="text-transform"]',
      'span[style*="text-decoration"]',
      'del',
      'sup',
      'sub',
      'code',
    ].join(' > ');

    const innermost = container.querySelector(`p > ${chain}`);
    expect(innermost).not.toBeNull();
    expect(innermost?.textContent).toBe('styled');
  });

  it('emits no wrappers for unmarked text', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'plain' }] },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const p = container.querySelector('p');
    expect(p?.innerHTML).toBe('plain');
  });

  it('wraps only the marks that are set', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'x', bold: true, color: '#f00' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('p > span[style*="color"] > strong')).not.toBeNull();
    expect(container.querySelector('em')).toBeNull();
  });
});

describe('block style attributes', () => {
  it('maps textAlign, lineHeight and indent onto one style', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        textAlign: 'right',
        lineHeight: '2',
        indent: 1,
        children: [{ type: 'text', text: 'x' }],
      } as BlocksContent[number],
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('p')).toHaveStyle({
      textAlign: 'right',
      lineHeight: '2',
      marginLeft: '2rem',
    });
  });

  it('sets no style when no attribute is present', () => {
    const content: BlocksContent = [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull();
  });
});

describe('file button size and icon', () => {
  const fileButton = (
    file: { url: string; name: string; ext?: string; mime?: string; size?: number },
    extra: Record<string, unknown> = {}
  ): BlocksContent =>
    [
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download',
        file,
        showFileIcon: true,
        showFileSize: true,
        ...extra,
      },
    ] as unknown as BlocksContent;

  it('formats the size in the nearest unit', () => {
    const { container } = render(
      <BlocksRenderer
        content={fileButton({ url: '/a.pdf', name: 'a.pdf', ext: '.pdf', size: 1024 * 1024 })}
      />
    );
    expect(container.querySelector('.bb-button-size')?.textContent).toContain('1 MB');
  });

  it('formats sub-kilobyte sizes in bytes', () => {
    const { container } = render(
      <BlocksRenderer
        content={fileButton({ url: '/a.pdf', name: 'a.pdf', ext: '.pdf', size: 512 })}
      />
    );
    expect(container.querySelector('.bb-button-size')?.textContent).toContain('512 B');
  });

  it('resolves the icon from the extension case-insensitively', () => {
    const lower = render(
      <BlocksRenderer content={fileButton({ url: '/a.pdf', name: 'a.pdf', ext: '.pdf' })} />
    );
    const upper = render(
      <BlocksRenderer content={fileButton({ url: '/a.pdf', name: 'a.pdf', ext: '.PDF' })} />
    );
    const icon = (c: HTMLElement) => c.querySelector('.bb-button-icon')?.textContent?.trim();
    expect(icon(lower.container)).toBe(icon(upper.container));
    expect(icon(lower.container)).toBeTruthy();
  });

  it('falls back to the mime family when the extension is unknown', () => {
    const { container } = render(
      <BlocksRenderer
        content={fileButton({ url: '/a.qqq', name: 'a.qqq', ext: '.qqq', mime: 'image/webp' })}
      />
    );
    expect(container.querySelector('.bb-button-icon')?.textContent?.trim()).toBe('🖼️');
  });

  it('omits size and icon when not requested', () => {
    const { container } = render(
      <BlocksRenderer
        content={fileButton(
          { url: '/a.pdf', name: 'a.pdf', ext: '.pdf', size: 2048 },
          { showFileIcon: false, showFileSize: false }
        )}
      />
    );
    expect(container.querySelector('.bb-button-size')).toBeNull();
    expect(container.querySelector('.bb-button-icon')).toBeNull();
  });
});

describe('media-embed migration', () => {
  const url = 'https://player.vimeo.com/video/12345';
  const legacy: BlocksContent = [
    { type: 'media-embed', url, children: [{ type: 'text', text: '' }] },
  ];

  it('renders the migrated block from the same source, in the same 16:9 box', () => {
    const before = render(<BlocksRenderer content={legacy} />);
    const beforeIframe = before.container.querySelector('iframe');
    expect(beforeIframe?.getAttribute('src')).toBe(url);

    const { content } = migrateDocument(legacy);
    const after = render(<BlocksRenderer content={content} />);
    const afterIframe = after.container.querySelector('iframe');

    // The wrapper changes - an `embed` renders as a bb-embed figure rather than
    // the old bare div - but what the reader sees is the same frame, same
    // source, same aspect ratio.
    expect(afterIframe?.getAttribute('src')).toBe(url);
    expect(after.container.querySelector('.bb-embed-frame')).toHaveStyle({
      aspectRatio: '16 / 9',
    });
  });

  it('leaves the document alone when it has nothing to migrate', () => {
    const content: BlocksContent = [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }];
    expect(migrateDocument(content).content).toBe(content);
  });
});
