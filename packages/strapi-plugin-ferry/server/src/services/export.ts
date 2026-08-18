import type { Core } from '@strapi/strapi';

import { encode } from './csv';
import { buildPopulate } from './populate';
import { makeSerialiser } from './serialise';
import type { Archive, ExportOptions, ExportedDocument, Plan } from '../types';

export interface ExportResult {
  filename: string;
  mime: string;
  body: string;
  count: number;
  /** Things left out, said plainly rather than discovered later. */
  warnings: string[];
}

export const DEFAULTS: Omit<ExportOptions, 'uid'> = {
  format: 'json',
  status: 'draft',
  relations: true,
  media: true,
};

/** `api::article.article` -> `article`, for a filename a person can read. */
const shortName = (uid: string): string => uid.split('.').pop() ?? uid;

/**
 * The columns a spreadsheet gets.
 *
 * Scalars and relation keys, and nothing else. A component is a tree, and a
 * tree in a spreadsheet cell is a JSON blob that no one can edit and that
 * defeats the reason for choosing CSV. Rather than pretend, the export names
 * what it left behind and points at the JSON format, which carries everything.
 */
const csvColumns = (plan: Plan, options: ExportOptions): string[] => [
  'documentId',
  ...(plan.localized ? ['locale'] : []),
  ...plan.scalars.map((field) => field.name),
  ...(options.relations ? plan.relations.map((relation) => relation.name) : []),
];

const flatten = (document: ExportedDocument, columns: string[]): Record<string, unknown> => {
  const row: Record<string, unknown> = {};

  for (const column of columns) {
    const value = document[column];
    // A to-many relation is a list of keys; a cell holds one string, and the
    // parser puts it back by splitting on the same comma. Quoting is the CSV
    // encoder's problem, not this one's.
    row[column] = Array.isArray(value) ? value.join(',') : value;
  }

  return row;
};

const exportService = ({ strapi }: { strapi: Core.Strapi }) => {
  const serialiser = makeSerialiser(strapi);
  const schema = () => strapi.plugin('ferry').service('schema');

  const self = {
    /** Everything of one content type that matches, as a file. */
    async run(options: ExportOptions): Promise<ExportResult> {
      const opts = { ...DEFAULTS, ...options };

      if (!schema().allowed(opts.uid)) {
        throw new Error(`[ferry] ${opts.uid} is not available for transfer.`);
      }

      const plan: Plan = schema().plan(opts.uid);
      const warnings: string[] = [];

      const maxExport = Number(strapi.plugin('ferry').config('maxExport')) || 10_000;

      const populate = buildPopulate(strapi, plan, {
        relations: opts.relations,
        media: opts.media,
      });

      const query: Record<string, unknown> = { populate };

      // `status` is meaningless on a content type without draft and publish,
      // and passing it anyway is the sort of thing that works until a Strapi
      // minor decides to validate it.
      if (plan.draftAndPublish) query.status = opts.status;
      if (opts.locale) query.locale = opts.locale;

      const filters: Record<string, unknown> = { ...(opts.filters ?? {}) };
      if (opts.documentIds?.length) filters.documentId = { $in: opts.documentIds };
      if (Object.keys(filters).length > 0) query.filters = filters;
      if (opts.sort) query.sort = opts.sort;

      // The whole result is held in memory to be written as one file, so the
      // cap is a statement of what this can actually do rather than a policy.
      // Silently returning the first page instead would be worse: a truncated
      // export looks exactly like a complete one.
      const limit = Math.min(opts.limit ?? maxExport, maxExport);
      query.limit = limit;

      const documents =
        plan.kind === 'singleType'
          ? await self.readSingle(opts.uid, query)
          : await strapi.documents(opts.uid as any).findMany(query as any);

      const serialised = documents.map((raw: any) =>
        serialiser.document(raw, plan, { relations: opts.relations, media: opts.media })
      );

      // Sorted by the one key that is the same in every environment, so two
      // exports of the same content are the same bytes and a diff means a real
      // change. An explicit sort is the user overriding that on purpose.
      if (!opts.sort) {
        serialised.sort((a: ExportedDocument, b: ExportedDocument) =>
          a.documentId.localeCompare(b.documentId)
        );
      }

      if (serialised.length >= limit) {
        warnings.push(
          `Stopped at ${limit} documents, which is this environment's export limit. There may be more - narrow the export with filters, or raise \`maxExport\` in the plugin config.`
        );
      }

      if (plan.media.length > 0 && opts.media) {
        warnings.push(
          `Media fields (${plan.media.map((f) => f.name).join(', ')}) travel as a reference, not as the file. The import reconnects them when the same upload already exists.`
        );
      }

      if (opts.format === 'csv') {
        const dropped = [
          ...plan.components.map((c) => c.name),
          ...plan.dynamicZones.map((z) => z.name),
          ...(opts.media ? plan.media.map((m) => m.name) : []),
        ];

        if (dropped.length > 0) {
          warnings.push(
            `CSV carries flat fields only, so ${dropped.join(', ')} ${dropped.length === 1 ? 'is' : 'are'} not in this file. Export as JSON to keep them.`
          );
        }

        const columns = csvColumns(plan, opts);

        return {
          filename: `${shortName(opts.uid)}.csv`,
          mime: 'text/csv; charset=utf-8',
          body: encode(
            serialised.map((document: ExportedDocument) => flatten(document, columns)),
            columns
          ),
          count: serialised.length,
          warnings,
        };
      }

      const archive: Archive = {
        ferry: 1,
        contentType: opts.uid,
        status: opts.status,
        ...(opts.locale ? { locale: opts.locale } : {}),
        count: serialised.length,
        documents: serialised,
      };

      return {
        filename: `${shortName(opts.uid)}.json`,
        mime: 'application/json',
        body: `${JSON.stringify(archive, null, 2)}\n`,
        count: serialised.length,
        warnings,
      };
    },

    /**
     * A single type is one document, or none at all before anyone has saved it.
     * The document service still answers `findFirst`, so the only difference
     * from a collection is the shape of the answer.
     */
    async readSingle(uid: string, query: Record<string, unknown>): Promise<any[]> {
      const document = await strapi.documents(uid as any).findFirst(query as any);
      return document ? [document] : [];
    },
  };

  return self;
};

export default exportService;
