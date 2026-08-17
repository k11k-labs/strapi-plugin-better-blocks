import { describe, it, expect, vi, afterEach } from 'vitest';

import { readAssetText } from '../src/media';

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFetch = (impl: () => Promise<Response> | Response) => vi.stubGlobal('fetch', vi.fn(impl));

describe('reading a Media Library file', () => {
  it('returns the file contents', async () => {
    stubFetch(() => new Response('Q1,420\nQ2,610'));

    const result = await readAssetText({ url: '/uploads/data.csv', ext: '.csv' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('Q1,420');
  });

  it('refuses a file that cannot be a table, before parsing it', async () => {
    // A PDF handed to the CSV parser produces a confident table of nonsense
    // rather than an error, so the extension is checked first.
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await readAssetText({ url: '/uploads/report.pdf', ext: '.pdf' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('.pdf');
    // And it did not even fetch it.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts csv, tsv and plain text', async () => {
    stubFetch(() => new Response('a,1'));

    for (const ext of ['.csv', '.tsv', '.txt']) {
      expect((await readAssetText({ url: `/uploads/x${ext}`, ext })).ok, ext).toBe(true);
    }
  });

  it('falls back to the extension in the URL when the asset has none', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await readAssetText({ url: '/uploads/report.pdf' });

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('explains a failed request instead of throwing', async () => {
    stubFetch(() => new Response('nope', { status: 404 }));

    const result = await readAssetText({ url: '/uploads/gone.csv', ext: '.csv' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('404');
  });

  it('explains a fetch that cannot happen at all', async () => {
    // The likely cause is an upload provider on another origin, which the
    // author can act on - unlike a stack trace.
    stubFetch(() => Promise.reject(new Error('CORS')));

    const result = await readAssetText({ url: 'https://cdn.example.com/x.csv', ext: '.csv' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('cannot fetch');
  });

  it('treats an empty file as nothing to import', async () => {
    stubFetch(() => new Response('   \n  '));

    const result = await readAssetText({ url: '/uploads/blank.csv', ext: '.csv' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('empty');
  });

  it('says so when the asset has no URL', async () => {
    const result = await readAssetText({ name: 'orphan.csv' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('no URL');
  });
});
