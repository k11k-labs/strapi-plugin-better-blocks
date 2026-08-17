import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import { PLAIN_UID, UID, asUser, bootWithGreenlight, plugin, seedWorkflow } from './helpers';

/** Scenarios 33-52: the batch read, the gate's own answer, and the stage filter. */

let app: TestStrapiInstance;
let strapi: any;

beforeAll(async () => {
  app = await bootWithGreenlight();
  strapi = app.strapi;
}, 180_000);

afterAll(() => app?.destroy());

beforeEach(async () => {
  await strapi.db.query('plugin::greenlight.assignment').deleteMany({});
  await strapi.db.query('plugin::greenlight.transition').deleteMany({});
  await strapi.db.query('plugin::greenlight.stage').deleteMany({});
  await strapi.db.query('plugin::greenlight.workflow').deleteMany({});
});

const draft = async (title: string, uid = UID, locale = 'en') => {
  const created = await strapi
    .documents(uid)
    .create({ data: { title }, ...(uid === UID ? { locale } : {}) });
  return created.documentId;
};

/**
 * The controller reached the way a route would reach it, with only the parts of
 * a Koa context it actually touches.
 */
const call = async (uid: string, query: Record<string, unknown>) => {
  const ctx: any = {
    params: { uid },
    query,
    state: { user: asUser() },
    badRequest: (message: string) => {
      ctx.rejected = message;
      return undefined;
    },
  };

  await strapi.plugin('greenlight').controller('assignment').findMany(ctx);
  return ctx;
};

describe('the batch read', () => {
  it('33. answers for a whole page of documents in one call', async () => {
    const wf = await seedWorkflow(strapi);
    const ids = await Promise.all([draft('One'), draft('Two'), draft('Three')]);

    for (const documentId of ids) {
      await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    }

    const rows = await plugin(strapi, 'assignment').getMany(UID, ids);

    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row: any) => row.relatedDocumentId))).toEqual(new Set(ids));
    expect(new Set(rows.map((row: any) => row.stageId))).toEqual(new Set([wf.stages[0].id]));
  });

  it('34. asks for nothing when given nothing', async () => {
    await seedWorkflow(strapi);
    expect(await plugin(strapi, 'assignment').getMany(UID, [])).toEqual([]);
  });

  it('35. does not leak another content type’s assignments', async () => {
    await seedWorkflow(strapi, {}, [UID, PLAIN_UID]);

    const article = await draft('Article');
    const note = await draft('Note', PLAIN_UID);
    await plugin(strapi, 'assignment').ensure(UID, article, 'en');
    await plugin(strapi, 'assignment').ensure(PLAIN_UID, note, null);

    // Same ids asked for, different content type: only the note comes back.
    const rows = await plugin(strapi, 'assignment').getMany(PLAIN_UID, [article, note]);

    expect(rows).toHaveLength(1);
    expect(rows[0].relatedDocumentId).toBe(note);
  });

  it('36. answers for the locale asked about, not whichever row it found first', async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('Bilingual');
    await strapi
      .documents(UID)
      .update({ documentId, locale: 'pl', data: { title: 'Dwujęzyczny' } });

    await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    const pl = await plugin(strapi, 'assignment').ensure(UID, documentId, 'pl');
    await plugin(strapi, 'assignment').transition({
      uid: UID,
      documentId,
      locale: 'pl',
      toStageId: wf.stages[1].id,
      version: pl.version,
      user: asUser(),
    });

    const en = await call(UID, { documentIds: documentId, locale: 'en' });
    const polish = await call(UID, { documentIds: documentId, locale: 'pl' });

    expect(en.body.documents[documentId].stageName).toBe('Draft');
    expect(polish.body.documents[documentId].stageName).toBe('In review');
  });
});

describe('the column’s endpoint', () => {
  it('37. says there is no workflow rather than failing, for a content type nobody reviews', async () => {
    await seedWorkflow(strapi, {}, [UID]);
    const note = await draft('Loose', PLAIN_UID);

    const ctx = await call(PLAIN_UID, { documentIds: note });

    expect(ctx.body).toEqual({ workflow: null, documents: {} });
  });

  it('38. gives an unreviewed document the stage the gate would treat it as being in', async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('Never reviewed');

    const ctx = await call(UID, { documentIds: documentId, locale: 'en' });

    expect(ctx.body.workflow.id).toBe(wf.id);
    expect(ctx.body.documents[documentId]).toMatchObject({
      assigned: false,
      stageName: 'Draft',
      publishable: false,
    });
  });

  it('39. leaves an unreviewed document with no stage when the workflow lets those through', async () => {
    await seedWorkflow(strapi, { onMissingAssignment: 'allow' });
    const documentId = await draft('Never reviewed');

    const ctx = await call(UID, { documentIds: documentId, locale: 'en' });

    expect(ctx.body.documents[documentId]).toMatchObject({
      assigned: false,
      stageName: null,
      // The gate would allow this publish, so the button must not be disabled.
      publishable: true,
    });
  });

  it('40. accepts both a comma-separated list and a repeated parameter', async () => {
    await seedWorkflow(strapi);
    const ids = await Promise.all([draft('A'), draft('B')]);

    const comma = await call(UID, { documentIds: ids.join(','), locale: 'en' });
    const repeated = await call(UID, { documentIds: ids, locale: 'en' });

    expect(Object.keys(comma.body.documents)).toHaveLength(2);
    expect(Object.keys(repeated.body.documents)).toHaveLength(2);
  });

  it('41. refuses a batch too large to be a page of a list view', async () => {
    await seedWorkflow(strapi);
    const ids = Array.from({ length: 201 }, (_, index) => `doc${index}`);

    const ctx = await call(UID, { documentIds: ids.join(',') });

    expect(ctx.rejected).toMatch(/limited to 200/);
    expect(ctx.body).toBeUndefined();
  });

  it('42. ignores blank and duplicated ids rather than querying for them', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('Once');

    const ctx = await call(UID, { documentIds: `${documentId},,${documentId}, `, locale: 'en' });

    expect(Object.keys(ctx.body.documents)).toEqual([documentId]);
  });
});

describe('the gate’s own answer', () => {
  const publishable = (wf: any, assignment: any) =>
    plugin(strapi, 'gate').publishable(wf, assignment);

  it('43. has no opinion about a content type outside every workflow', async () => {
    expect(publishable(null, null)).toBe(true);
  });

  it('44. allows anything when the workflow is a status board rather than a gate', async () => {
    const wf = await seedWorkflow(strapi, { enforcePublishGate: false });
    expect(publishable(wf, { stageId: wf.stages[0].id })).toBe(true);
  });

  it('45. blocks a document short of the terminal stage, and allows one that reached it', async () => {
    const wf = await seedWorkflow(strapi);

    expect(publishable(wf, { stageId: wf.stages[0].id })).toBe(false);
    expect(publishable(wf, { stageId: wf.stages[2].id })).toBe(true);
  });

  it('46. follows onMissingAssignment for a document that has never been reviewed', async () => {
    const blocking = await seedWorkflow(strapi);
    expect(publishable(blocking, null)).toBe(false);

    await strapi.db.query('plugin::greenlight.workflow').deleteMany({});
    await strapi.db.query('plugin::greenlight.stage').deleteMany({});

    const allowing = await seedWorkflow(strapi, { onMissingAssignment: 'allow' });
    expect(publishable(allowing, null)).toBe(true);
  });
});

describe('the stage filter', () => {
  const filter = async (uid: string, query: Record<string, unknown>) => {
    let reached = false;
    const ctx: any = {
      method: 'GET',
      path: `/content-manager/collection-types/${uid}`,
      request: { query },
    };

    const { stageFilter } = await import('../server/src/middlewares/stageFilter');
    await stageFilter(strapi)(ctx, async () => {
      reached = true;
    });

    return { ctx, reached, filters: ctx.request.query.filters };
  };

  const clause = (stageId: number, operator = '$eq') => ({
    $and: [{ greenlightStage: { [operator]: String(stageId) } }],
  });

  it('47. rewrites "stage is X" into a documentId filter the Content Manager can run', async () => {
    const wf = await seedWorkflow(strapi);
    const inReview = await draft('Under review');
    const elsewhere = await draft('Still drafting');

    const assignment = await plugin(strapi, 'assignment').ensure(UID, inReview, 'en');
    await plugin(strapi, 'assignment').transition({
      uid: UID,
      documentId: inReview,
      locale: 'en',
      toStageId: wf.stages[1].id,
      version: assignment.version,
      user: asUser(),
    });
    await plugin(strapi, 'assignment').ensure(UID, elsewhere, 'en');

    const { filters, reached } = await filter(UID, {
      locale: 'en',
      filters: clause(wf.stages[1].id),
    });

    expect(reached).toBe(true);
    // The plugin's own key is gone — leaving it would fail schema validation.
    expect(JSON.stringify(filters)).not.toContain('greenlightStage');
    expect(filters.$and).toContainEqual({ documentId: { $in: [inReview] } });
  });

  it('48. includes never-reviewed documents when filtering by the stage they are implied to be in', async () => {
    const wf = await seedWorkflow(strapi);
    const assigned = await draft('Assigned');
    await plugin(strapi, 'assignment').ensure(UID, assigned, 'en');

    const { filters } = await filter(UID, {
      locale: 'en',
      filters: clause(wf.stages[0].id),
    });

    // "in the first stage" OR "has no assignment at all" — without the second
    // half, the stage most documents are in is the one the filter misses.
    expect(filters.$and[0]).toEqual({
      $or: [{ documentId: { $in: [assigned] } }, { documentId: { $notIn: [assigned] } }],
    });
  });

  it('49. turns "is not" into an exclusion', async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('One');
    const assignment = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    await plugin(strapi, 'assignment').transition({
      uid: UID,
      documentId,
      locale: 'en',
      toStageId: wf.stages[1].id,
      version: assignment.version,
      user: asUser(),
    });

    const { filters } = await filter(UID, {
      locale: 'en',
      filters: clause(wf.stages[1].id, '$ne'),
    });

    expect(filters.$and).toContainEqual({ documentId: { $notIn: [documentId] } });
  });

  it('50. keeps the user’s other filters', async () => {
    const wf = await seedWorkflow(strapi);

    const { filters } = await filter(UID, {
      locale: 'en',
      filters: {
        $and: [
          { title: { $contains: 'report' } },
          { greenlightStage: { $eq: String(wf.stages[1].id) } },
        ],
      },
    });

    expect(filters.$and).toContainEqual({ title: { $contains: 'report' } });
    expect(filters.$and).toHaveLength(2);
  });

  it('51. drops the clause for a content type under no workflow, rather than answering it wrongly', async () => {
    await seedWorkflow(strapi, {}, [UID]);

    const { filters, reached } = await filter(PLAIN_UID, {
      filters: clause(999),
    });

    expect(reached).toBe(true);
    expect(JSON.stringify(filters)).not.toContain('greenlightStage');
    // Nothing was added in its place: the request goes on unfiltered.
    expect(filters.$and ?? []).toHaveLength(0);
  });

  it('52. leaves every other request completely alone', async () => {
    await seedWorkflow(strapi);
    const untouched = { filters: { $and: [{ title: { $eq: 'x' } }] } };

    const { filters, reached } = await filter(UID, untouched);

    expect(reached).toBe(true);
    expect(filters).toEqual(untouched.filters);
  });
});
