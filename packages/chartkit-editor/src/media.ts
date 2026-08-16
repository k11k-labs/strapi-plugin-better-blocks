/**
 * Reading a data file's contents.
 *
 * Deliberately free of any Strapi import. The dialog that picks the file needs
 * the admin's component registry; turning the file into text does not, and
 * keeping the two apart is what lets this half be tested without booting an
 * admin panel.
 */

/** The subset of a Media Library asset this needs. */
export type MediaAsset = {
  id?: number;
  url?: string;
  name?: string;
  mime?: string;
  ext?: string;
};

export type ReadResult =
  { ok: true; text: string; asset: MediaAsset } | { ok: false; reason: string };

/**
 * Extensions worth trying to read as a table.
 *
 * The Media Library holds every kind of file, and handing a PDF to a CSV parser
 * produces a confident table of nonsense rather than an error. Checking first
 * turns that into a sentence the author can act on.
 */
const READABLE = new Set(['csv', 'tsv', 'txt', 'tab']);

/** Fetches an asset's contents as text. */
export async function readAssetText(asset: MediaAsset): Promise<ReadResult> {
  const url = asset.url;
  if (!url) return { ok: false, reason: 'That file has no URL to read.' };

  const extension = (asset.ext ?? url.split('.').pop() ?? '').replace('.', '').toLowerCase();
  if (extension && !READABLE.has(extension)) {
    return {
      ok: false,
      reason: `A .${extension} file cannot be read as a table. Upload a CSV, TSV or plain text file.`,
    };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, reason: `Could not read the file (${response.status}).` };
    }

    const text = await response.text();
    if (!text.trim()) return { ok: false, reason: 'That file is empty.' };

    return { ok: true, text, asset };
  } catch {
    // A cross-origin upload provider is the likely cause, and the author can do
    // something about that — unlike a stack trace.
    return {
      ok: false,
      reason: 'Could not read the file. It may be stored somewhere this browser cannot fetch.',
    };
  }
}
