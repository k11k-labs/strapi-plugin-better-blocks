/**
 * CSV, done properly, with no dependency.
 *
 * "Split on commas" handles the CSV nobody has, and the abandoned plugin in
 * this niche has two open bug reports that read exactly like a split: a comma
 * inside a title, a newline inside a body. RFC 4180 is small enough to
 * implement once and be done with, so it is implemented here as a state machine
 * over characters rather than as a regular expression that is nearly right.
 */

/** What Excel writes at the top of a UTF-8 file, and what nothing else wants. */
const BOM = '﻿';

const DELIMITERS = [',', ';', '\t', '|'] as const;

export type Delimiter = (typeof DELIMITERS)[number];

/**
 * Guess the delimiter from the header line.
 *
 * A comma is the standard and a semicolon is what a spreadsheet saves in every
 * locale that uses a comma as the decimal separator - which is most of Europe.
 * Getting this wrong turns the whole file into one column, so it is worth the
 * twenty lines: count candidates outside quotes and take the winner.
 */
export const sniffDelimiter = (text: string): Delimiter => {
  const line = text.replace(BOM, '').split(/\r?\n/, 1)[0] ?? '';

  let best: Delimiter = ',';
  let bestCount = 0;

  for (const candidate of DELIMITERS) {
    let count = 0;
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (!quoted && char === candidate) count += 1;
    }

    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
};

/** True when a value cannot be written bare. */
const needsQuotes = (value: string, delimiter: string): boolean =>
  value.includes(delimiter) ||
  value.includes('"') ||
  value.includes('\n') ||
  value.includes('\r') ||
  value !== value.trim();

/**
 * One value, as a cell.
 *
 * `null` and `undefined` both become empty, and that is a real loss of
 * information the format cannot avoid: a CSV has no way to say "this field is
 * null" as distinct from "this field is blank". The importer resolves the
 * ambiguity in the safe direction by leaving blank cells alone rather than
 * writing empty values over existing content. Anything structured is written as
 * JSON, which survives the round trip and is at least readable in a cell.
 */
export const cell = (value: unknown, delimiter: string): string => {
  if (value === null || value === undefined) return '';

  const text =
    typeof value === 'string'
      ? value
      : value instanceof Date
        ? value.toISOString()
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

  return needsQuotes(text, delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
};

export interface EncodeOptions {
  delimiter?: string;
  /**
   * Prefix the byte order mark. Excel opens a UTF-8 CSV as the local codepage
   * without it, which turns every accented character into mojibake - so it is
   * on by default and can be turned off for anything that is not a spreadsheet.
   */
  bom?: boolean;
  /** Excel wants CRLF; everything else tolerates it. */
  newline?: '\n' | '\r\n';
}

export const encode = (
  rows: Array<Record<string, unknown>>,
  columns: string[],
  options: EncodeOptions = {}
): string => {
  const { delimiter = ',', bom = true, newline = '\r\n' } = options;

  const lines = [columns.map((column) => cell(column, delimiter)).join(delimiter)];

  for (const row of rows) {
    lines.push(columns.map((column) => cell(row[column], delimiter)).join(delimiter));
  }

  return (bom ? BOM : '') + lines.join(newline) + newline;
};

/**
 * The parser.
 *
 * Character by character, tracking whether it is inside quotes, because that is
 * the only thing that decides whether a delimiter or a newline is data or
 * structure. A doubled quote inside a quoted field is one literal quote, which
 * is the rule everyone forgets.
 */
export const parse = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let hasContent = false;

  const endField = () => {
    row.push(field);
    field = '';
    hasContent = true;
  };

  const endRow = () => {
    endField();
    // A trailing newline is not a row of one empty field.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    hasContent = false;
  };

  const body = text.startsWith(BOM) ? text.slice(BOM.length) : text;

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];

    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 1;
          continue;
        }
        quoted = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      endField();
      continue;
    }

    if (char === '\r') {
      if (body[i + 1] === '\n') i += 1;
      endRow();
      continue;
    }

    if (char === '\n') {
      endRow();
      continue;
    }

    field += char;
  }

  if (field !== '' || quoted || hasContent || row.length > 0) endRow();

  return rows;
};

export interface Decoded {
  columns: string[];
  /** Rows keyed by column name. Extra cells beyond the header are dropped. */
  rows: Array<Record<string, string>>;
}

export const decode = (text: string, delimiter?: string): Decoded => {
  const chosen = delimiter ?? sniffDelimiter(text);
  const table = parse(text, chosen);

  if (table.length === 0) return { columns: [], rows: [] };

  const [header, ...body] = table;
  const columns = header.map((column) => column.trim());

  const rows = body.map((cells) => {
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = cells[index] ?? '';
    });
    return row;
  });

  return { columns, rows };
};
