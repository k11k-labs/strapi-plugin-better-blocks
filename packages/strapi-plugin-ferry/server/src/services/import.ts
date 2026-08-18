import { collectRelations, filterRelations, stripRelations } from './nested';
import type { Parsed } from './parse';
import type { Core } from '@strapi/strapi';

import type { ImportOptions, Plan, Report, RowReport, UnresolvedRelation } from '../types';
import { UPLOAD_FILE } from '../uids';

export const DEFAULTS: Omit<ImportOptions, 'uid'> = {
  status: 'draft',
  onExisting: 'update',
  onMissingRelation: 'skip',
  publish: true,
  continueOnError: false,
};

/** Enough keys to see the shape of a problem without printing a database. */
const MAX_REPORTED_KEYS = 10;

/**
 * One row of the file, before anything has been decided about it.
 *
 * Exported because it turns up in the signatures of the service's own methods,
 * and a name that a declaration file cannot reach fails the build rather than
 * merely being inconvenient.
 */
export interface Entry {
  row: number;
  documentId?: string;
  data: Record<string, unknown>;
}

/** Thrown to roll the transaction back once the report is already written. */
class Abort extends Error {}

const importService = ({ strapi }: { strapi: Core.Strapi }) => {
  const schema = () => strapi.plugin('ferry').service('schema');
  const planFor = (uid: string): Plan => schema().componentPlan(uid);

  const self = {
    /**
     * A dry run: the whole resolution, none of the writes.
     *
     * Same code path as the real thing, so what it promises is what happens.
     */
    preview(options: Partial<ImportOptions> & { uid: string }, parsed: Parsed): Promise<Report> {
      return self.run(options, parsed, false);
    },

    apply(options: Partial<ImportOptions> & { uid: string }, parsed: Parsed): Promise<Report> {
      return self.run(options, parsed, true);
    },

    async run(
      options: Partial<ImportOptions> & { uid: string },
      parsed: Parsed,
      apply: boolean
    ): Promise<Report> {
      const opts: ImportOptions = { ...DEFAULTS, ...options };

      if (!schema().allowed(opts.uid)) {
        throw new Error(`[ferry] ${opts.uid} is not available for transfer.`);
      }

      const plan = schema().plan(opts.uid);
      const warnings = [...parsed.warnings];

      if (parsed.contentType && parsed.contentType !== opts.uid) {
        warnings.push(
          `This file was exported from ${parsed.contentType} and is being imported into ${opts.uid}.`
        );
      }

      const entries: Entry[] = parsed.documents.map((data, index) => ({
        row: index + 1,
        documentId: typeof data.documentId === 'string' ? data.documentId : undefined,
        data,
      }));

      const report: Report = {
        contentType: opts.uid,
        applied: false,
        total: entries.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errored: 0,
        rows: [],
        unresolved: [],
        warnings,
      };

      if (entries.length === 0) {
        warnings.push('The file holds no documents.');
        return report;
      }

      const existing = await self.existingDocuments(plan, opts, entries);
      const resolved = await self.resolveRelations(plan, opts, entries, report);
      const media = await self.resolveMedia(plan, entries, report);

      // A document this import is about to create counts as present, or every
      // link between two documents in the same file would be reported missing.
      const incoming = new Set(
        entries.map((entry) => entry.documentId).filter(Boolean) as string[]
      );
      const exists = (target: string, key: string): boolean =>
        resolved.get(target)?.has(key) === true || (target === opts.uid && incoming.has(key));

      const hasRelations = entries.some(
        (entry) => collectRelations(entry.data, plan, planFor).length > 0
      );

      // Decide every row before writing any of them, so the dry run and the
      // real run agree by construction rather than by care.
      const decided = entries.map((entry) => ({
        entry,
        outcome: self.decide(entry, plan, existing, opts),
      }));

      for (const { entry, outcome } of decided) {
        if (outcome === 'create') report.created += 1;
        else if (outcome === 'update') report.updated += 1;
        else report.skipped += 1;

        report.rows.push({
          row: entry.row,
          documentId: entry.documentId,
          outcome,
          ...(outcome === 'skip' ? { message: 'already present, and existing rows are kept' } : {}),
        });
      }

      const blocking = opts.onMissingRelation === 'fail' && report.unresolved.length > 0;
      if (blocking) {
        warnings.push(
          'Nothing was written: a relation points at a document that is not in the file and not in this environment.'
        );
        return report;
      }

      if (!apply) return report;

      try {
        await strapi.db.transaction(async () => {
          await self.write(decided, plan, opts, { media, exists, hasRelations }, report);

          if (report.errored > 0 && !opts.continueOnError) {
            throw new Abort();
          }
        });

        report.applied = true;
      } catch (error) {
        if (!(error instanceof Abort)) throw error;
        report.applied = false;
        warnings.push(
          `Rolled back: ${report.errored} row(s) failed and the import is set to all or nothing.`
        );
      }

      return report;
    },

    decide(
      entry: Entry,
      plan: Plan,
      existing: Set<string>,
      opts: ImportOptions
    ): 'create' | 'update' | 'skip' {
      // A single type is one document by definition: whatever is in the file
      // updates the one that is there, or becomes it.
      if (plan.kind === 'singleType') return existing.size > 0 ? 'update' : 'create';

      if (!entry.documentId) return 'create';
      if (!existing.has(entry.documentId)) return 'create';
      return opts.onExisting === 'skip' ? 'skip' : 'update';
    },

    /** Which of the documents in the file are already here. */
    async existingDocuments(
      plan: Plan,
      opts: ImportOptions,
      entries: Entry[]
    ): Promise<Set<string>> {
      const found = new Set<string>();

      const query: Record<string, unknown> = { fields: ['documentId'] };
      if (plan.draftAndPublish) query.status = 'draft';
      if (plan.localized && opts.locale) query.locale = opts.locale;

      if (plan.kind === 'singleType') {
        const one = await strapi.documents(plan.uid as any).findFirst(query as any);
        if (one) found.add(one.documentId);
        return found;
      }

      const ids = entries.map((entry) => entry.documentId).filter(Boolean) as string[];
      if (ids.length === 0) return found;

      const documents = await strapi
        .documents(plan.uid as any)
        .findMany({ ...query, filters: { documentId: { $in: ids } } } as any);

      for (const document of documents) found.add(document.documentId);
      return found;
    },

    /**
     * Which relation targets are really there.
     *
     * One query per target content type rather than one per key. A file of a
     * thousand articles all pointing at the same twenty authors asks about
     * twenty authors once, not a thousand times - and the abandoned plugin's
     * habit of resolving inside the row loop is why importing anything sizeable
     * takes minutes.
     */
    async resolveRelations(
      plan: Plan,
      opts: ImportOptions,
      entries: Entry[],
      report: Report
    ): Promise<Map<string, Set<string>>> {
      const wanted = new Map<string, Set<string>>();
      const sightings: Array<{ entry: Entry; path: string; target: string; keys: string[] }> = [];

      for (const entry of entries) {
        for (const found of collectRelations(entry.data, plan, planFor)) {
          sightings.push({ entry, ...found });
          const keys = wanted.get(found.target) ?? new Set<string>();
          found.keys.forEach((key) => keys.add(key));
          wanted.set(found.target, keys);
        }
      }

      const resolved = new Map<string, Set<string>>();

      for (const [target, keys] of wanted) {
        const model = schema().model(target);
        if (!model) {
          report.warnings.push(`Relations point at ${target}, which does not exist here.`);
          resolved.set(target, new Set());
          continue;
        }

        const query: Record<string, unknown> = {
          fields: ['documentId'],
          filters: { documentId: { $in: [...keys] } },
        };
        if (model.options?.draftAndPublish) query.status = 'draft';

        const documents = await strapi.documents(target as any).findMany(query as any);
        resolved.set(target, new Set(documents.map((document: any) => document.documentId)));
      }

      const incoming = new Set(
        entries.map((entry) => entry.documentId).filter(Boolean) as string[]
      );

      for (const sighting of sightings) {
        const here = resolved.get(sighting.target) ?? new Set<string>();
        const missing = sighting.keys.filter(
          (key) => !here.has(key) && !(sighting.target === plan.uid && incoming.has(key))
        );

        if (missing.length === 0) continue;

        report.unresolved.push({
          row: sighting.entry.row,
          documentId: sighting.entry.documentId,
          field: sighting.path,
          target: sighting.target,
          keys: missing.slice(0, MAX_REPORTED_KEYS),
        });
      }

      return resolved;
    },

    /**
     * Media, matched by hash.
     *
     * The hash is derived from the file's contents, so the same image uploaded
     * to two environments matches even when the filenames and the ids differ.
     * Ferry does not carry the bytes; when the upload is not there, the field is
     * left unset and said so, rather than pointing at somebody else's file.
     */
    async resolveMedia(plan: Plan, entries: Entry[], report: Report): Promise<Map<string, number>> {
      const byHash = new Map<string, number>();
      if (plan.media.length === 0) return byHash;

      const hashes = new Set<string>();

      for (const entry of entries) {
        for (const field of plan.media) {
          const value = entry.data[field.name];
          const list = Array.isArray(value) ? value : value ? [value] : [];
          for (const file of list) {
            const hash = (file as any)?.hash;
            if (typeof hash === 'string') hashes.add(hash);
          }
        }
      }

      if (hashes.size === 0) return byHash;

      const files = await strapi.db
        .query(UPLOAD_FILE)
        .findMany({ select: ['id', 'hash'], where: { hash: { $in: [...hashes] } } });

      for (const file of files) byHash.set(file.hash, file.id);

      const missing = [...hashes].filter((hash) => !byHash.has(hash));
      if (missing.length > 0) {
        report.warnings.push(
          `${missing.length} media file(s) referenced in this file are not in this Media Library, so those fields are left empty. Upload them first and import again to attach them.`
        );
      }

      return byHash;
    },

    /** The payload for the first pass: content, with nothing pointing outward. */
    content(entry: Entry, plan: Plan, media: Map<string, number>): Record<string, unknown> {
      const data = stripRelations(entry.data, plan, planFor);
      delete data.documentId;
      delete data.locale;
      return self.withMedia(data, plan, media);
    },

    /** The payload for the second pass: the same content, now wired up. */
    wiring(
      entry: Entry,
      plan: Plan,
      media: Map<string, number>,
      exists: (target: string, key: string) => boolean
    ): Record<string, unknown> {
      const data = filterRelations(entry.data, plan, planFor, exists);
      delete data.documentId;
      delete data.locale;
      return self.withMedia(data, plan, media);
    },

    withMedia(
      data: Record<string, unknown>,
      plan: Plan,
      media: Map<string, number>
    ): Record<string, unknown> {
      for (const field of plan.media) {
        if (!(field.name in data)) continue;

        const value = data[field.name];
        const list = Array.isArray(value) ? value : value ? [value] : [];
        const ids = list
          .map((file: any) => (typeof file?.hash === 'string' ? media.get(file.hash) : undefined))
          .filter((id): id is number => typeof id === 'number');

        if (ids.length === 0) delete data[field.name];
        else data[field.name] = field.many ? ids : ids[0];
      }

      return data;
    },

    /**
     * The writes, in two passes.
     *
     * Everything exists before anything points at it. There is no ordering of a
     * single pass that works: two documents that refer to each other cannot both
     * be written second.
     */
    async write(
      decided: Array<{ entry: Entry; outcome: 'create' | 'update' | 'skip' }>,
      plan: Plan,
      opts: ImportOptions,
      context: {
        media: Map<string, number>;
        exists: (target: string, key: string) => boolean;
        hasRelations: boolean;
      },
      report: Report
    ): Promise<void> {
      const written: Array<{ entry: Entry; documentId: string }> = [];
      const locale = plan.localized && opts.locale ? { locale: opts.locale } : {};

      const fail = (row: RowReport['row'], message: string) => {
        const existingRow = report.rows.find((entry) => entry.row === row);
        if (existingRow) {
          if (existingRow.outcome === 'create') report.created -= 1;
          if (existingRow.outcome === 'update') report.updated -= 1;
          existingRow.outcome = 'error';
          existingRow.message = message;
        }
        report.errored += 1;
      };

      for (const { entry, outcome } of decided) {
        if (outcome === 'skip') continue;

        try {
          const data = self.content(entry, plan, context.media);

          if (outcome === 'create') {
            const created = await strapi.documents(plan.uid as any).create({
              data: { ...data, ...(entry.documentId ? { documentId: entry.documentId } : {}) },
              ...locale,
            } as any);
            written.push({ entry, documentId: created.documentId });
          } else {
            const documentId = entry.documentId ?? (await self.singleTypeId(plan, opts));
            if (!documentId) throw new Error('no document to update');
            await strapi.documents(plan.uid as any).update({ documentId, data, ...locale } as any);
            written.push({ entry, documentId });
          }
        } catch (error) {
          fail(entry.row, (error as Error).message);
        }
      }

      if (context.hasRelations) {
        for (const { entry, documentId } of written) {
          try {
            await strapi.documents(plan.uid as any).update({
              documentId,
              data: self.wiring(entry, plan, context.media, context.exists),
              ...locale,
            } as any);
          } catch (error) {
            fail(entry.row, `relations: ${(error as Error).message}`);
          }
        }
      }

      // Publishing last, so a document is never live in a half-written state.
      if (opts.publish && plan.draftAndPublish && opts.status === 'published') {
        for (const { entry, documentId } of written) {
          try {
            await strapi.documents(plan.uid as any).publish({ documentId, ...locale } as any);
          } catch (error) {
            fail(entry.row, `publish: ${(error as Error).message}`);
          }
        }
      }
    },

    async singleTypeId(plan: Plan, opts: ImportOptions): Promise<string | undefined> {
      const query: Record<string, unknown> = { fields: ['documentId'] };
      if (plan.draftAndPublish) query.status = 'draft';
      if (plan.localized && opts.locale) query.locale = opts.locale;

      const one = await strapi.documents(plan.uid as any).findFirst(query as any);
      return one?.documentId;
    },
  };

  return self;
};

export default importService;
