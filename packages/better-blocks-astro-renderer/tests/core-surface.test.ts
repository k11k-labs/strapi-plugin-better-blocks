import { describe, it, expect } from 'vitest';

import {
  buildTextMarks,
  formatFileSize,
  getAspectRatio,
  getBlockStyle,
  getDefaultMarkRender,
  getFileIcon,
  getListStyleType,
  getModifierProps,
  getPlainText,
  normalizeCodeLang,
} from '../src/utils';
import type { ButtonFile, InlineNode, TextNode } from '../src/types';

/**
 * Characterization tests for the framework-independent helpers this renderer
 * shares with the React one. They pin down today's behavior so extracting the
 * shared core can be shown to change nothing: the same expectations run against
 * both renderers before the move and against the core package after it.
 */

describe('normalizeCodeLang', () => {
  it('passes known editor languages through unchanged', () => {
    expect(normalizeCodeLang('typescript')).toBe('typescript');
    expect(normalizeCodeLang('python')).toBe('python');
  });

  it('lowercases the editor value before resolving', () => {
    expect(normalizeCodeLang('TypeScript')).toBe('typescript');
  });

  it('maps editor values whose Shiki grammar id differs', () => {
    expect(normalizeCodeLang('objectivec')).toBe('objective-c');
    expect(normalizeCodeLang('fortran')).toBe('fortran-free-form');
    expect(normalizeCodeLang('vbnet')).toBe('vb');
  });

  it('resolves common shorthands that are not editor values', () => {
    expect(normalizeCodeLang('ts')).toBe('typescript');
    expect(normalizeCodeLang('yml')).toBe('yaml');
  });

  it('prefers an alias over the known-language set', () => {
    expect(normalizeCodeLang('shell')).toBe('bash');
  });

  it('falls back to plaintext for unknown or missing languages', () => {
    expect(normalizeCodeLang('klingon')).toBe('plaintext');
    expect(normalizeCodeLang('')).toBe('plaintext');
    expect(normalizeCodeLang(undefined)).toBe('plaintext');
  });
});

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
    expect(getAspectRatio('')).toBe('16 / 9');
  });
});

describe('getPlainText', () => {
  it('concatenates text nodes', () => {
    const children: InlineNode[] = [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ];
    expect(getPlainText(children)).toBe('Hello world');
  });

  it('flattens link children into the surrounding text', () => {
    const children: InlineNode[] = [
      { type: 'text', text: 'See ' },
      {
        type: 'link',
        url: 'https://example.com',
        children: [{ type: 'text', text: 'the docs' }],
      },
      { type: 'text', text: ' now' },
    ];
    expect(getPlainText(children)).toBe('See the docs now');
  });

  it('returns an empty string for content it cannot flatten', () => {
    expect(getPlainText([])).toBe('');
  });
});

describe('getListStyleType', () => {
  it('cycles unordered styles by indent level', () => {
    const styles = [0, 1, 2, 3].map((i) => getListStyleType('unordered', i));
    expect(new Set(styles.slice(0, 3)).size).toBe(3);
    expect(styles[3]).toBe(styles[0]);
  });

  it('cycles ordered styles by indent level', () => {
    const styles = [0, 1, 2, 3].map((i) => getListStyleType('ordered', i));
    expect(new Set(styles.slice(0, 3)).size).toBe(3);
    expect(styles[3]).toBe(styles[0]);
  });

  it('starts unordered at disc and ordered at decimal', () => {
    expect(getListStyleType('unordered', 0)).toBe('disc');
    expect(getListStyleType('ordered', 0)).toBe('decimal');
  });
});

describe('formatFileSize', () => {
  it('formats bytes below a kilobyte', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('steps up through the units', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('returns 0 B for zero, negative and non-finite input', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-1)).toBe('0 B');
    expect(formatFileSize(Number.NaN)).toBe('0 B');
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B');
  });
});

describe('getFileIcon', () => {
  const file = (extra: Partial<ButtonFile> = {}): ButtonFile => ({
    url: '/a',
    name: 'a',
    ...extra,
  });

  it('resolves by extension, with or without a leading dot', () => {
    expect(getFileIcon(file({ ext: '.pdf' }))).toBe(getFileIcon(file({ ext: 'pdf' })));
  });

  it('is case-insensitive about the extension', () => {
    expect(getFileIcon(file({ ext: '.PDF' }))).toBe(getFileIcon(file({ ext: '.pdf' })));
  });

  it('falls back to the mime type family when the extension is unknown', () => {
    expect(getFileIcon(file({ ext: '.qqq', mime: 'image/webp' }))).toBe('🖼️');
  });

  it('returns a generic icon when nothing matches', () => {
    const icon = getFileIcon(file());
    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });
});

describe('getBlockStyle', () => {
  it('maps textAlign, lineHeight and indent', () => {
    expect(getBlockStyle({ textAlign: 'center' })).toEqual({ textAlign: 'center' });
    expect(getBlockStyle({ lineHeight: '1.8' })).toEqual({ lineHeight: '1.8' });
    expect(getBlockStyle({ indent: 2 })).toEqual({ marginLeft: '4rem' });
  });

  it('combines every attribute that is set', () => {
    expect(getBlockStyle({ textAlign: 'right', lineHeight: '2', indent: 1 })).toEqual({
      textAlign: 'right',
      lineHeight: '2',
      marginLeft: '2rem',
    });
  });

  it('returns undefined when nothing is set', () => {
    expect(getBlockStyle({})).toBeUndefined();
    expect(getBlockStyle({ indent: 0 })).toBeUndefined();
  });
});

describe('buildTextMarks', () => {
  const base: TextNode = { type: 'text', text: 'x' };

  it('returns no marks for plain text', () => {
    expect(buildTextMarks(base)).toEqual([]);
  });

  it('orders marks outer to inner', () => {
    const node: TextNode = {
      ...base,
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
    };
    expect(buildTextMarks(node).map((m) => m.name)).toEqual([
      'fontSize',
      'fontFamily',
      'backgroundColor',
      'color',
      'bold',
      'italic',
      'uppercase',
      'underline',
      'strikethrough',
      'superscript',
      'subscript',
      'code',
    ]);
  });

  it('carries the value for value-bearing marks only', () => {
    const node: TextNode = { ...base, bold: true, color: '#f00' };
    expect(buildTextMarks(node)).toEqual([{ name: 'color', value: '#f00' }, { name: 'bold' }]);
  });
});

describe('getDefaultMarkRender', () => {
  it('maps boolean marks to their semantic tag', () => {
    expect(getDefaultMarkRender({ name: 'bold' })).toEqual({ tag: 'strong' });
    expect(getDefaultMarkRender({ name: 'italic' })).toEqual({ tag: 'em' });
    expect(getDefaultMarkRender({ name: 'code' })).toEqual({ tag: 'code' });
    expect(getDefaultMarkRender({ name: 'strikethrough' })).toEqual({ tag: 'del' });
    expect(getDefaultMarkRender({ name: 'subscript' })).toEqual({ tag: 'sub' });
    expect(getDefaultMarkRender({ name: 'superscript' })).toEqual({ tag: 'sup' });
  });

  it('maps styling marks to a span carrying the style', () => {
    expect(getDefaultMarkRender({ name: 'underline' })).toEqual({
      tag: 'span',
      style: { textDecoration: 'underline' },
    });
    expect(getDefaultMarkRender({ name: 'uppercase' })).toEqual({
      tag: 'span',
      style: { textTransform: 'uppercase' },
    });
    expect(getDefaultMarkRender({ name: 'color', value: '#f00' })).toEqual({
      tag: 'span',
      style: { color: '#f00' },
    });
    expect(getDefaultMarkRender({ name: 'backgroundColor', value: '#ff0' })).toEqual({
      tag: 'span',
      style: { backgroundColor: '#ff0' },
    });
    expect(getDefaultMarkRender({ name: 'fontFamily', value: 'serif' })).toEqual({
      tag: 'span',
      style: { fontFamily: 'serif' },
    });
    expect(getDefaultMarkRender({ name: 'fontSize', value: '2rem' })).toEqual({
      tag: 'span',
      style: { fontSize: '2rem' },
    });
  });

  it('falls back to a bare span for an unknown mark', () => {
    expect(getDefaultMarkRender({ name: 'nonsense' })).toEqual({ tag: 'span' });
  });
});

describe('getModifierProps', () => {
  it('forwards the value under the mark name', () => {
    expect(getModifierProps({ name: 'color', value: '#f00' })).toEqual({ color: '#f00' });
  });

  it('passes nothing for boolean marks', () => {
    expect(getModifierProps({ name: 'bold' })).toEqual({});
  });
});
