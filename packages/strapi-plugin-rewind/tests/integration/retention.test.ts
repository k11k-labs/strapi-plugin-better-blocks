import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UID = 'api::article.article';
const VERSION_UID = 'plugin::rewind.version';

let app: TestStrapiInstance;

const retention = () => app.strapi.plugin('rewind').service('retention');
const lock = () => app.strapi.plugin('rewind').service('lock');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-17T12:00:00.000Z');

/** Writes a version straight to the table, so its age can be chosen. */
const seedVersion = async (
  daysAgo: number,
  origin = 'update',
  extra: Record<string, unknown> = {}
) =>
  app.strapi.db.query(VERSION_UID).create({
    data: {
      contentType: UID,
      relatedDocumentId: 'doc-1',
      locale: null,
      status: 'draft',
      data: { title: `v-${daysAgo}` },
      schemaSnapshot: { attributes: {}, components: {} },
      relations: {},
      contentHash: `hash-${daysAgo}-${origin}-${Math.round(Math.random() * 1e9)}`,
      origin,
      label: `v-${daysAgo}`,
      createdAt: new Date(NOW.getTime() - daysAgo * DAY),
      ...extra,
    },
  });

const remaining = async () => app.strapi.db.query(VERSION_UID).findMany({ orderBy: { id: 'asc' } });

beforeAll(async () => {
  app = await createTestStrapi({
    contentTypes: {
      article: {
        info: {
          singularName: 'article',
          pluralName: 'articles',
          displayName: 'Article',
        },
        options: { draftAndPublish: true },
        attributes: { title: { type: 'string' } },
      },
    },
    plugins: {
      rewind: {
        enabled: true,
        resolve: PLUGIN_ROOT,
        config: { contentTypes: [UID], trackApiWrites: true },
      },
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

beforeEach(async () => {
  await app.strapi.db.query(VERSION_UID).deleteMany({});
  await lock().release('prune');
});

describe('prune', () => {
  it('leaves recent history completely alone', async () => {
    await seedVersion(0);
    await seedVersion(1);
    await seedVersion(2);

    const result = await retention().prune(NOW);

    expect(result.deleted).toBe(0);
    expect(await remaining()).toHaveLength(3);
  });

  it('thins older history to one version a day', async () => {
    await seedVersion(10);
    await seedVersion(10.2);
    await seedVersion(10.4);

    const result = await retention().prune(NOW);

    expect(result.deleted).toBe(2);
    expect(await remaining()).toHaveLength(1);
  });

  it('never deletes an anchor, however old', async () => {
    await seedVersion(500, 'publish');
    await seedVersion(500, 'discardDraft');
    await seedVersion(500, 'update');

    await retention().prune(NOW);

    const rows = await remaining();
    // The ordinary version goes; the two anchors stay.
    expect(rows.map((r: any) => r.origin).sort()).toEqual(['discardDraft', 'publish']);
  });

  it('never deletes a pinned version', async () => {
    await seedVersion(500, 'update', { pinned: true });

    await retention().prune(NOW);

    expect(await remaining()).toHaveLength(1);
  });

  it('keeps the newest version of each day it thins', async () => {
    // Both land on the same UTC day; 10.1 is the later of the two.
    await seedVersion(10.3);
    const newest = await seedVersion(10.1);

    await retention().prune(NOW);

    const rows = await remaining();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(newest.id);
  });

  it('thins each document separately', async () => {
    await seedVersion(10);
    await seedVersion(10.2);
    await app.strapi.db.query(VERSION_UID).create({
      data: {
        contentType: UID,
        relatedDocumentId: 'doc-2',
        locale: null,
        status: 'draft',
        data: { title: 'other' },
        schemaSnapshot: { attributes: {}, components: {} },
        relations: {},
        contentHash: 'other-hash',
        origin: 'update',
        createdAt: new Date(NOW.getTime() - 10 * DAY),
      },
    });

    const result = await retention().prune(NOW);

    // One survivor each, so only the duplicate from doc-1 goes.
    expect(result.documents).toBe(2);
    expect(result.deleted).toBe(1);
    expect(await remaining()).toHaveLength(2);
  });
});

describe('the prune lock', () => {
  it('is held by the first caller and refused to the second', async () => {
    expect(await lock().acquire('prune', 60_000)).toBe(true);
    // The second instance behind the load balancer backs off.
    expect(await lock().acquire('prune', 60_000)).toBe(false);
  });

  it('is available again once released', async () => {
    await lock().acquire('prune', 60_000);
    await lock().release('prune');

    expect(await lock().acquire('prune', 60_000)).toBe(true);
  });

  it('expires, so a crash mid-prune does not block it forever', async () => {
    await lock().acquire('prune', 1);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await lock().acquire('prune', 60_000)).toBe(true);
  });
});
