import { describe, it, expect } from 'vitest';

import { normalizeCodeLang } from '../src/code';

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
    // `shell` is a valid editor value, but Shiki highlights it as `bash`.
    expect(normalizeCodeLang('shell')).toBe('bash');
  });

  it('falls back to plaintext for unknown or missing languages', () => {
    expect(normalizeCodeLang('klingon')).toBe('plaintext');
    expect(normalizeCodeLang('')).toBe('plaintext');
    expect(normalizeCodeLang(undefined)).toBe('plaintext');
  });
});
