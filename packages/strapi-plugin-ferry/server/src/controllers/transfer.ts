import { readFile } from 'node:fs/promises';

import type { Core } from '@strapi/strapi';

import { parseFile } from '../services/parse';
import type { ExportOptions, Format, ImportOptions } from '../types';
import { PLUGIN_ID } from '../uids';

const plugin = (strapi: Core.Strapi) => strapi.plugin(PLUGIN_ID);

/**
 * The uploaded file, as text.
 *
 * Two ways in, because two things are calling. The admin panel posts a real
 * file, which keeps a large import clear of the JSON body limit that would
 * otherwise cap it at a megabyte. Anything scripted can post the content
 * inline, which makes the endpoint usable from a shell without assembling a
 * multipart request.
 */
const readUpload = async (ctx: any): Promise<string> => {
  const inline = ctx.request.body?.content;
  if (typeof inline === 'string' && inline.length > 0) return inline;

  const files = ctx.request.files ?? {};
  const uploaded = files.file ?? Object.values(files)[0];
  const one = Array.isArray(uploaded) ? uploaded[0] : uploaded;

  if (!one) ctx.throw(400, 'Attach a file, or post its content as `content`.');

  // formidable writes to a temp path and hands back the location; the name of
  // that property moved between its versions, so accept either.
  const path = one.filepath ?? one.path;
  if (!path) ctx.throw(400, 'The upload arrived without a readable path.');

  return readFile(path, 'utf8');
};

/** Trust the extension only as a hint; the caller may say what it is. */
const formatOf = (ctx: any, filename?: string): Format => {
  const asked = ctx.request.body?.format;
  if (asked === 'csv' || asked === 'json') return asked;
  return filename?.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
};

const uploadName = (ctx: any): string | undefined => {
  const files = ctx.request.files ?? {};
  const uploaded = files.file ?? Object.values(files)[0];
  const one = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  return one?.originalFilename ?? one?.name;
};

/**
 * Booleans arriving from a multipart form are the strings "true" and "false",
 * and `Boolean("false")` is true - a bug that reads as a setting being ignored.
 */
const bool = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
};

const transfer = ({ strapi }: { strapi: Core.Strapi }) => ({
  /** The content types Ferry can carry, for the picker. */
  async catalogue(ctx: any) {
    ctx.body = { contentTypes: plugin(strapi).service('schema').catalogue() };
  },

  /** What would travel, and what would not, before anyone commits to it. */
  async plan(ctx: any) {
    const { uid } = ctx.params;
    try {
      ctx.body = plugin(strapi).service('schema').plan(uid);
    } catch (error) {
      ctx.throw(404, (error as Error).message);
    }
  },

  async export(ctx: any) {
    const body = ctx.request.body ?? {};

    if (!body.uid) ctx.throw(400, 'Name the content type to export as `uid`.');

    const options: ExportOptions = {
      uid: body.uid,
      format: body.format === 'csv' ? 'csv' : 'json',
      status: body.status === 'published' ? 'published' : 'draft',
      locale: body.locale || undefined,
      documentIds: Array.isArray(body.documentIds) ? body.documentIds : undefined,
      filters: body.filters,
      sort: body.sort,
      limit: body.limit ? Number(body.limit) : undefined,
      relations: bool(body.relations, true),
      media: bool(body.media, true),
    };

    try {
      const result = await plugin(strapi).service('exporter').run(options);

      // Two ways out of here, because two very different things are asking.
      //
      // `envelope` returns the file as a string inside ordinary JSON. That is
      // what the admin panel wants: Strapi's admin fetch client parses every
      // response as JSON regardless of the `responseType` asked for, so a
      // binary body reaches the browser as a parsed object and saving it writes
      // the literal text "[object Object]" to disk. Handing back a string
      // sidesteps the client's opinion entirely, and carries the warnings and
      // the count in the same response rather than in headers.
      if (bool(body.envelope, false)) {
        ctx.body = {
          filename: result.filename,
          mime: result.mime,
          body: result.body,
          count: result.count,
          warnings: result.warnings,
        };
        return;
      }

      // Otherwise the file itself, as a download, for curl and for CI. The
      // warnings have nowhere to go in a file, so they ride in a header.
      if (result.warnings.length > 0) {
        ctx.set('X-Ferry-Warnings', encodeURIComponent(JSON.stringify(result.warnings)));
      }
      ctx.set('X-Ferry-Count', String(result.count));
      ctx.set('Access-Control-Expose-Headers', 'X-Ferry-Warnings, X-Ferry-Count');
      ctx.attachment(result.filename);
      ctx.type = result.mime;
      ctx.body = result.body;
    } catch (error) {
      ctx.throw(400, (error as Error).message);
    }
  },

  /** The dry run. Reads everything, writes nothing. */
  async preview(ctx: any) {
    await runImport(ctx, strapi, false);
  },

  async apply(ctx: any) {
    await runImport(ctx, strapi, true);
  },
});

const runImport = async (ctx: any, strapi: Core.Strapi, apply: boolean) => {
  const body = ctx.request.body ?? {};
  const uid = body.uid;

  if (!uid) ctx.throw(400, 'Name the content type to import into as `uid`.');

  let plan;
  try {
    plan = plugin(strapi).service('schema').plan(uid);
  } catch (error) {
    return ctx.throw(404, (error as Error).message);
  }

  const text = await readUpload(ctx);
  const format = formatOf(ctx, uploadName(ctx));

  const options: Partial<ImportOptions> & { uid: string } = {
    uid,
    status: body.status === 'published' ? 'published' : 'draft',
    locale: body.locale || undefined,
    onExisting: body.onExisting === 'skip' ? 'skip' : 'update',
    onMissingRelation: body.onMissingRelation === 'fail' ? 'fail' : 'skip',
    publish: bool(body.publish, true),
    continueOnError: bool(body.continueOnError, false),
  };

  try {
    const parsed = parseFile(text, format, plan);
    const importer = plugin(strapi).service('importer');
    ctx.body = apply
      ? await importer.apply(options, parsed)
      : await importer.preview(options, parsed);
  } catch (error) {
    ctx.throw(400, (error as Error).message);
  }
};

export default transfer;
