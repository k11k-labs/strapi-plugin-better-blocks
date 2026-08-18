/**
 * The CSV codec, on its own.
 *
 * No Strapi here on purpose: this is the part that has to be right about a
 * format rather than about a database, and the failures people report against
 * the plugin this replaces - a comma in a title, a line break in a body - are
 * all in these twenty lines of parser.
 */
import { describe, expect, it } from 'vitest';

import { cell, decode, encode, parse, sniffDelimiter } from '../server/src/services/csv';

const BOM = '﻿';

describe('writing', () => {
  it('1. quotes a value holding the delimiter, instead of splitting the row in two', () => {
    expect(cell('Smith, Jane', ',')).toBe('"Smith, Jane"');
  });

  it('2. doubles a quote inside a value, which is how CSV escapes one', () => {
    expect(cell('He said "hello"', ',')).toBe('"He said ""hello"""');
  });

  it('3. quotes a value with a line break rather than ending the record', () => {
    expect(cell('first\nsecond', ',')).toBe('"first\nsecond"');
  });

  it('4. quotes leading and trailing spaces, which would otherwise be eaten', () => {
    expect(cell('  padded  ', ',')).toBe('"  padded  "');
  });

  it('5. leaves a plain value alone', () => {
    expect(cell('plain', ',')).toBe('plain');
  });

  it('6. writes nothing for null and undefined, which a spreadsheet reads as blank', () => {
    expect(cell(null, ',')).toBe('');
    expect(cell(undefined, ',')).toBe('');
  });

  it('7. writes an object as JSON, so it survives the trip in one cell', () => {
    expect(cell({ a: 1 }, ',')).toBe('"{""a"":1}"');
  });

  it('8. leads with a byte order mark, because Excel needs one to read UTF-8', () => {
    const text = encode([{ name: 'Zoë' }], ['name']);
    expect(text.startsWith(BOM)).toBe(true);
    expect(text).toContain('Zoë');
  });
});

describe('reading', () => {
  it('9. round-trips every value that needed quoting', () => {
    const rows = [
      { title: 'Smith, Jane', body: 'He said "hello"', note: 'first\nsecond' },
      { title: 'plain', body: '  padded  ', note: '' },
    ];

    const { rows: back } = decode(encode(rows, ['title', 'body', 'note']));

    expect(back).toEqual(rows);
  });

  it('10. strips the byte order mark instead of gluing it to the first column name', () => {
    const { columns } = decode(`${BOM}documentId,title\r\nabc,Hello\r\n`);
    expect(columns).toEqual(['documentId', 'title']);
  });

  it('11. reads a semicolon file, which is what a spreadsheet saves in half of Europe', () => {
    const { columns, rows } = decode('name;city\r\nJane;Kraków\r\n');

    expect(columns).toEqual(['name', 'city']);
    expect(rows[0]).toEqual({ name: 'Jane', city: 'Kraków' });
  });

  it('12. does not mistake a comma inside a quoted cell for the delimiter', () => {
    expect(sniffDelimiter('name;"Smith, Jane";city')).toBe(';');
  });

  it('13. accepts both line endings', () => {
    const unix = decode('a,b\n1,2\n');
    const windows = decode('a,b\r\n1,2\r\n');

    expect(unix.rows).toEqual(windows.rows);
  });

  it('14. ignores a blank line rather than reading it as an empty record', () => {
    const { rows } = decode('a,b\r\n1,2\r\n\r\n3,4\r\n');
    expect(rows).toHaveLength(2);
  });

  it('15. keeps a trailing empty cell, which is a real value and not padding', () => {
    const { rows } = decode('a,b\r\n1,\r\n');
    expect(rows[0]).toEqual({ a: '1', b: '' });
  });

  it('16. pads a short row instead of shifting the columns along', () => {
    const { rows } = decode('a,b,c\r\n1\r\n');
    expect(rows[0]).toEqual({ a: '1', b: '', c: '' });
  });

  it('17. survives a file with no rows at all', () => {
    expect(decode('a,b\r\n')).toEqual({ columns: ['a', 'b'], rows: [] });
    expect(decode('')).toEqual({ columns: [], rows: [] });
  });

  it('18. reads a quoted field that contains the record separator', () => {
    const table = parse('a,b\r\n"one\r\ntwo",three\r\n', ',');

    expect(table).toHaveLength(2);
    expect(table[1]).toEqual(['one\r\ntwo', 'three']);
  });
});
