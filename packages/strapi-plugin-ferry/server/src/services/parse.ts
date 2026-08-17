import { decode } from './csv';
import type { Archive, Format, Plan, Status } from '../types';

export interface Parsed {
  /** What the file says it holds, when it says anything. */
  contentType?: string;
  status?: Status;
  locale?: string;
  documents: Array<Record<string, unknown>>;
  warnings: string[];
}

/**
 * A cell, back into the type the schema says it is.
 *
 * CSV has one type, and it is string. Everything a spreadsheet hands back has
 * to be talked out of being text before Strapi will accept it, and the schema
 * is the only thing that knows into what.
 */
export const coerce = (raw: string, type: string): unknown => {
  const value = raw.trim();

  switch (type) {
    case 'integer':
    case 'biginteger': {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
    }
    case 'decimal':
    case 'float': {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case 'boolean': {
      const lowered = value.toLowerCase();
      if (['true', '1', 'yes'].includes(lowered)) return true;
      if (['false', '0', 'no'].includes(lowered)) return false;
      return undefined;
    }
    case 'json': {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    default:
      return raw;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read a file into documents, without deciding anything about them.
 *
 * Parsing and importing are kept apart so that a malformed file fails before
 * the database is opened, and so the dry run and the real run read exactly the
 * same thing.
 */
export const parseFile = (text: string, format: Format, plan: Plan): Parsed => {
  if (format === 'csv') return parseCsv(text, plan);
  return parseJson(text);
};

const parseJson = (text: string): Parsed => {
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`[ferry] the file is not valid JSON: ${(error as Error).message}`, {
      cause: error,
    });
  }

  const warnings: string[] = [];

  // A bare array is not what Ferry writes, but it is what a person assembles by
  // hand or gets out of another tool, and refusing it would be pedantry.
  if (Array.isArray(data)) {
    warnings.push('Read as a plain list of documents, with no header to check against.');
    return { documents: data.filter(isPlainObject), warnings };
  }

  if (!isPlainObject(data)) {
    throw new Error('[ferry] expected an object or an array of documents.');
  }

  const archive = data as unknown as Archive;

  if (archive.ferry !== undefined && archive.ferry !== 1) {
    throw new Error(
      `[ferry] this file was written by a newer format (version ${archive.ferry}) than this plugin can read.`
    );
  }

  if (!Array.isArray(archive.documents)) {
    throw new Error('[ferry] the file has no `documents` array.');
  }

  return {
    contentType: archive.contentType,
    status: archive.status,
    locale: archive.locale,
    documents: archive.documents.filter(isPlainObject),
    warnings,
  };
};

const parseCsv = (text: string, plan: Plan): Parsed => {
  const { columns, rows } = decode(text);
  const warnings: string[] = [];

  const scalarTypes = new Map(plan.scalars.map((field) => [field.name, field.type]));
  const relationNames = new Set(plan.relations.map((relation) => relation.name));
  const known = new Set([
    'documentId',
    'locale',
    ...scalarTypes.keys(),
    ...relationNames,
    ...plan.media.map((field) => field.name),
  ]);

  const unknown = columns.filter((column) => column && !known.has(column));
  if (unknown.length > 0) {
    warnings.push(`Ignored columns not in the schema: ${unknown.join(', ')}.`);
  }

  if (!columns.includes('documentId')) {
    warnings.push(
      'No documentId column, so every row will be created as a new document rather than matched against an existing one.'
    );
  }

  const documents = rows.map((row) => {
    const document: Record<string, unknown> = {};

    for (const column of columns) {
      if (!known.has(column)) continue;

      const raw = row[column] ?? '';

      // A blank cell is not the same as an instruction to blank the field. CSV
      // cannot tell the two apart, so the safe reading wins: leave it alone.
      // Anything else would let an import quietly erase content that simply was
      // not in the spreadsheet.
      if (raw === '') continue;

      if (column === 'documentId' || column === 'locale') {
        document[column] = raw.trim();
        continue;
      }

      if (relationNames.has(column)) {
        document[column] = raw
          .split(',')
          .map((key) => key.trim())
          .filter(Boolean);
        continue;
      }

      const type = scalarTypes.get(column);
      const value = type ? coerce(raw, type) : raw;
      if (value !== undefined) document[column] = value;
    }

    return document;
  });

  return { documents, warnings };
};
