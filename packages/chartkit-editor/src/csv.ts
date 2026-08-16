/**
 * Turning pasted spreadsheet data into a chart.
 *
 * This is the path most charts will actually be created by: the numbers already
 * exist in Sheets or Excel, and retyping them into a grid is the worst part of
 * every charting tool. Copying a range and pasting it should just work.
 *
 * Which means being generous about the input. A paste from Excel is
 * tab-separated; a downloaded file is comma-separated; a European locale writes
 * `1.234,5`; a copied column of currency carries `€` and thousands separators.
 * None of that is the author's mistake, and all of it is recoverable.
 */

import type { Series } from '@qkix/chartkit-core';

export type ParsedTable = {
  labels: string[];
  series: Series[];
  /** What the parser had to assume, so the editor can say so before committing. */
  notes: string[];
};

export type ParseResult = { ok: true; table: ParsedTable } | { ok: false; reason: string };

/**
 * Parses a pasted block of delimited text.
 *
 * Shape expected — the one a spreadsheet selection produces:
 *
 * ```
 *          Revenue  Costs      <- header: first cell blank or a category title
 * Q1       420      310
 * Q2       610      480
 * ```
 *
 * The first column is category labels, every other column is a series. A header
 * row is used for series names when it is not numeric; without one the series
 * are named `Series 1`, `Series 2` and so on.
 */
export function parseDelimited(input: string): ParseResult {
  // Blank lines off each end only. A full trim would eat the leading tab of a
  // spreadsheet header row — `\tRevenue\tCosts` — taking the empty first cell
  // with it, and the header would then be read as a row of data.
  const text = input.replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
  if (!text.trim()) return { ok: false, reason: 'Nothing to paste.' };

  const delimiter = detectDelimiter(text);
  const rows = text
    .split('\n')
    .map((line) => splitRow(line, delimiter))
    .filter((cells) => cells.some((cell) => cell.trim() !== ''));

  if (rows.length === 0) return { ok: false, reason: 'Nothing to paste.' };

  const width = Math.max(...rows.map((row) => row.length));
  if (width < 2) {
    return {
      ok: false,
      reason: 'Needs at least two columns: category labels, then one column per series.',
    };
  }

  const notes: string[] = [];

  // A first row whose data cells are not numbers is a header. Guessing wrong
  // either way costs a row of data or a row of nonsense names, so it is decided
  // by what the cells actually contain rather than by a setting nobody will
  // find.
  const hasHeader = rows[0].slice(1).some((cell) => cell.trim() !== '' && !isNumeric(cell));
  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;

  if (!hasHeader) notes.push('No header row found, so the series are numbered.');
  if (body.length === 0) return { ok: false, reason: 'No data rows found below the header.' };

  const labels = body.map((row, i) => {
    const label = (row[0] ?? '').trim();
    return label === '' ? `Category ${i + 1}` : label;
  });

  const seriesCount = width - 1;
  const series: Series[] = Array.from({ length: seriesCount }, (_, column) => {
    const name = header?.[column + 1]?.trim();

    return {
      name: name && name !== '' ? name : `Series ${column + 1}`,
      values: body.map((row) => toNumber(row[column + 1])),
    };
  });

  const holes = series.reduce(
    (count, one) => count + one.values.filter((value) => value === null).length,
    0
  );
  if (holes > 0) {
    notes.push(
      `${holes} cell${holes === 1 ? '' : 's'} could not be read as a number and became gaps.`
    );
  }

  return { ok: true, table: { labels, series, notes } };
}

/**
 * Picks the delimiter by counting candidates on the first line.
 *
 * Tab first: a paste from a spreadsheet is tab-separated, and that is the case
 * worth getting right without asking. Semicolon before comma, because a
 * semicolon-separated file is usually one written by a locale that also uses
 * the comma as a decimal mark — treating those commas as separators would
 * shred every number.
 */
function detectDelimiter(text: string): string {
  const line = text.split('\n')[0] ?? '';

  for (const candidate of ['\t', ';']) {
    if (line.includes(candidate)) return candidate;
  }

  return ',';
}

/** Splits one row, honouring double quotes so a quoted delimiter survives. */
function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // A doubled quote inside a quoted cell is an escaped quote.
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

/**
 * Reads a cell as a number, or as a hole.
 *
 * Strips currency symbols, spaces and thousands separators, and copes with both
 * decimal conventions. A cell that still is not a number becomes `null` rather
 * than `0` — an unreadable cell is a missing reading, and a zero would be a
 * measurement nobody took.
 */
export function toNumber(cell: string | undefined): number | null {
  if (cell === undefined) return null;

  const trimmed = cell.trim().replace(/^["']|["']$/g, '');
  if (trimmed === '') return null;

  // Everything that is not part of a number: currency, percent signs, spaces,
  // and the non-breaking space spreadsheets like to use as a thousands mark.
  let cleaned = trimmed.replace(/[^\d,.\-+eE]/g, '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal mark, the other groups.
    cleaned =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Only commas. `1,5` is a decimal; `1,500` and `1,234,567` are groupings.
    const decimals = cleaned.length - lastComma - 1;
    cleaned = decimals === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  }

  // `Number('')` is 0, so a cell that cleaned down to nothing — `n/a`, `—`, a
  // stray currency symbol — would come back as a measured zero. Requiring a
  // digit is what keeps "unreadable" and "zero" apart.
  if (!/\d/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function isNumeric(cell: string): boolean {
  return toNumber(cell) !== null;
}
