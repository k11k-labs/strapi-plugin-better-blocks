/**
 * The HTTP layer.
 *
 * Added after a bug that every service test missed, because the services were
 * right: the export endpoint returned a perfectly good file, and the admin
 * panel saved the fourteen characters "[object Object]" to disk. Strapi's admin
 * fetch client parses every response as JSON whatever `responseType` it is
 * handed, so a file body arrives as a parsed object.
 *
 * The fix is the `envelope` flag, and the reason it is tested here is that the
 * contract between the two is exactly what nothing else was checking.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import { ARTICLE, bootWithFerry } from './helpers';

let app: TestStrapiInstance;
let strapi: any;

beforeAll(async () => {
  app = await bootWithFerry();
  strapi = app.strapi;

  await strapi.documents(ARTICLE).create({
    data: { documentId: 'ferryctrlone00000001', title: 'One' },
  });
}, 180_000);

afterAll(() => app?.destroy());

const controller = () => strapi.plugin('ferry').controller('transfer');

/** Enough of a Koa context for a controller that only reads and writes a body. */
const makeCtx = (body: any = {}, params: any = {}) => ({
  request: { body, files: undefined as any },
  params,
  body: undefined as any,
  type: undefined as any,
  headers: {} as Record<string, string>,
  attachedAs: undefined as string | undefined,
  set(key: string, value: string) {
    this.headers[key] = value;
  },
  attachment(name: string) {
    this.attachedAs = name;
  },
  throw(status: number, message: string) {
    throw new Error(`${status}: ${message}`);
  },
});

describe('export', () => {
  it('1. returns the file as a string when the admin panel asks for an envelope', async () => {
    const ctx = makeCtx({ uid: ARTICLE, format: 'json', envelope: true });

    await controller().export(ctx);

    // A string, not an object. This is the whole point: anything else reaches
    // the browser as a parsed object and cannot be saved.
    expect(typeof ctx.body.body).toBe('string');
    expect(ctx.body.filename).toBe('article.json');
    expect(ctx.body.mime).toBe('application/json');
    expect(JSON.parse(ctx.body.body).documents).toHaveLength(1);
  });

  it('2. carries the count and the warnings in the same response', async () => {
    const ctx = makeCtx({ uid: ARTICLE, format: 'csv', envelope: true });

    await controller().export(ctx);

    expect(ctx.body.count).toBe(1);
    expect(Array.isArray(ctx.body.warnings)).toBe(true);
    expect(ctx.body.warnings.join(' ')).toContain('CSV');
  });

  it('3. still serves a real download for anything that is not a browser', async () => {
    const ctx = makeCtx({ uid: ARTICLE, format: 'json' });

    await controller().export(ctx);

    expect(ctx.attachedAs).toBe('article.json');
    expect(typeof ctx.body).toBe('string');
    expect(ctx.headers['X-Ferry-Count']).toBe('1');
  });

  it('4. refuses a request that does not name a content type', async () => {
    await expect(controller().export(makeCtx({}))).rejects.toThrow('400');
  });

  it('5. refuses a content type that is out of bounds', async () => {
    await expect(
      controller().export(makeCtx({ uid: 'plugin::upload.file', envelope: true }))
    ).rejects.toThrow('400');
  });
});

describe('reading the schema', () => {
  it('6. lists what can be carried', async () => {
    const ctx = makeCtx();

    await controller().catalogue(ctx);

    expect(ctx.body.contentTypes.map((entry: any) => entry.uid)).toContain(ARTICLE);
    expect(ctx.body.contentTypes.every((entry: any) => entry.uid.startsWith('api::'))).toBe(true);
  });

  it('7. says which fields travel and which do not', async () => {
    const ctx = makeCtx({}, { uid: ARTICLE });

    await controller().plan(ctx);

    expect(ctx.body.scalars.map((field: any) => field.name)).toContain('title');
    expect(ctx.body.skipped.map((field: any) => field.name)).toContain('secret');
  });

  it('8. answers 404 for a content type that does not exist', async () => {
    await expect(controller().plan(makeCtx({}, { uid: 'api::nope.nope' }))).rejects.toThrow('404');
  });
});

describe('import', () => {
  const inline = (documents: unknown[], extra: any = {}) =>
    makeCtx({
      uid: ARTICLE,
      content: JSON.stringify({ ferry: 1, contentType: ARTICLE, documents }),
      ...extra,
    });

  it('9. takes the file inline, so a script does not have to build a multipart body', async () => {
    const ctx = inline([{ documentId: 'ferryctrltwo00000001', title: 'Two' }]);

    await controller().preview(ctx);

    expect(ctx.body.created).toBe(1);
    expect(ctx.body.applied).toBe(false);
  });

  it('10. reads the multipart booleans as booleans, not as the string "false"', async () => {
    // A form sends "false", and `Boolean("false")` is true - a bug that reads
    // as a setting being quietly ignored.
    const ctx = inline([{ documentId: 'ferryctrlthree000001', title: 'Three' }], {
      continueOnError: 'false',
      publish: 'false',
    });

    await controller().apply(ctx);

    expect(ctx.body.applied).toBe(true);

    const published = await strapi
      .documents(ARTICLE)
      .findOne({ documentId: 'ferryctrlthree000001', status: 'published' });
    expect(published).toBeFalsy();
  });

  it('11. says so when there is no file at all', async () => {
    await expect(controller().preview(makeCtx({ uid: ARTICLE }))).rejects.toThrow('400');
  });
});
