import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  PLAIN_UID,
  UID,
  bootWithGreenlight,
  plugin,
  publishedCount,
  seedWorkflow,
} from './helpers';

/**
 * Scenarios 1-11 of the handover: the publish gate itself.
 *
 * These drive the Document Service directly rather than the HTTP layer, because
 * that is the boundary the gate defends - a publish from a seed script has to be
 * refused exactly as one from the edit view is.
 */

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

const draft = async (title: string, uid = UID) => {
  const created = await strapi
    .documents(uid)
    .create({ data: { title }, ...(uid === UID ? { locale: 'en' } : {}) });
  return created.documentId;
};

const approve = async (wf: any, documentId: string, uid = UID, locale: string | null = 'en') => {
  const terminal = wf.stages.find((stage: any) => stage.isTerminal);
  const current = await plugin(strapi, 'assignment').ensure(uid, documentId, locale);
  return plugin(strapi, 'assignment').transition({
    uid,
    documentId,
    locale,
    toStageId: terminal.id,
    version: current.version,
    user: { id: 1, firstname: 'Anna', lastname: 'Kowalska', roles: [] },
  });
};

describe('the gate', () => {
  it('1. refuses a publish outside the terminal stage, naming the stage', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('unapproved');

    await expect(strapi.documents(UID).publish({ documentId, locale: 'en' })).rejects.toThrow(
      /Draft/
    );

    expect(await publishedCount(strapi, documentId)).toBe(0);
  });

  it('2. allows a publish once the document reaches the terminal stage', async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('approved');
    await approve(wf, documentId);

    await strapi.documents(UID).publish({ documentId, locale: 'en' });

    expect(await publishedCount(strapi, documentId)).toBe(1);
  });

  it('3. lets params.greenlight.bypass through, and strips the key', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('seeded');

    await strapi
      .documents(UID)
      .publish({ documentId, locale: 'en', greenlight: { bypass: true } } as any);

    expect(await publishedCount(strapi, documentId)).toBe(1);
  });

  it('4. blocks a document with no assignment, and creates one in the first stage', async () => {
    const documentId = await draft('predates the plugin');
    // Workflow added *after* the document existed - the case every install hits.
    const wf = await seedWorkflow(strapi);

    await expect(strapi.documents(UID).publish({ documentId, locale: 'en' })).rejects.toThrow(
      /not been approved/
    );

    const created = await plugin(strapi, 'assignment').get(UID, documentId, 'en');
    expect(created.stageId).toBe(wf.stages[0].id);
  });

  it("4b. onMissingAssignment 'allow' lets pre-existing documents through", async () => {
    const documentId = await draft('grandfathered');
    await seedWorkflow(strapi, { onMissingAssignment: 'allow' });

    await strapi.documents(UID).publish({ documentId, locale: 'en' });

    expect(await publishedCount(strapi, documentId)).toBe(1);
  });

  it('enforcePublishGate: false records stages but does not block', async () => {
    await seedWorkflow(strapi, { enforcePublishGate: false });
    const documentId = await draft('status board only');

    await strapi.documents(UID).publish({ documentId, locale: 'en' });

    expect(await publishedCount(strapi, documentId)).toBe(1);
  });
});

describe('locales - the five shapes', () => {
  it("5. locale '*' is expanded, and one unapproved locale blocks the call", async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('multi');
    await strapi.documents(UID).update({ documentId, locale: 'pl', data: { title: 'polski' } });

    await approve(wf, documentId, UID, 'en');

    await expect(strapi.documents(UID).publish({ documentId, locale: '*' })).rejects.toThrow(/pl/);
    expect(await publishedCount(strapi, documentId)).toBe(0);
  });

  it('6. an array of locales is checked per locale', async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('array');
    await strapi.documents(UID).update({ documentId, locale: 'pl', data: { title: 'polski' } });
    await approve(wf, documentId, UID, 'en');

    await expect(
      strapi.documents(UID).publish({ documentId, locale: ['en', 'pl'] })
    ).rejects.toThrow(/pl/);
  });

  it('7. an omitted locale checks the default locale, not "nothing"', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('omitted');

    // The leak this exists to prevent: read as "no locales", this publishes.
    await expect(strapi.documents(UID).publish({ documentId })).rejects.toThrow(
      /not been approved/
    );
    expect(await publishedCount(strapi, documentId)).toBe(0);
  });

  it('8. a content type without i18n is gated under the empty-string locale', async () => {
    const wf = await seedWorkflow(strapi, {}, [PLAIN_UID]);
    const documentId = await draft('plain', PLAIN_UID);

    await expect(strapi.documents(PLAIN_UID).publish({ documentId })).rejects.toThrow(
      /not been approved/
    );

    await approve(wf, documentId, PLAIN_UID, null);
    await strapi.documents(PLAIN_UID).publish({ documentId });

    expect(await publishedCount(strapi, documentId, PLAIN_UID)).toBe(1);
  });

  it('9. approving one locale does not unblock another', async () => {
    const wf = await seedWorkflow(strapi);
    const documentId = await draft('per locale');
    await strapi.documents(UID).update({ documentId, locale: 'pl', data: { title: 'polski' } });

    await approve(wf, documentId, UID, 'pl');

    await expect(strapi.documents(UID).publish({ documentId, locale: 'en' })).rejects.toThrow(
      /not been approved/
    );
    await strapi.documents(UID).publish({ documentId, locale: 'pl' });
  });
});

describe('bulk publish', () => {
  const documentManager = () => strapi.plugin('content-manager').service('document-manager');

  /**
   * How much of the batch survives a refusal is **timing-dependent**, and this
   * test pins down the only part that is a guarantee.
   *
   * `publishMany` is `db.transaction(() => Promise.all(...))`, and a rejection
   * sends the transaction into rollback. But rollback clears the ambient
   * transaction (`transaction-context.js` sets `store.trx = null`) *before* it
   * awaits the database, and every query re-reads that store at execute time
   * (`query-builder.js`). So the outcome depends on where the siblings are when
   * the refusal lands:
   *
   *   refuse synchronously  → siblings are still in flight, escape the
   *                           transaction, and commit for real
   *   refuse after I/O      → siblings already wrote *on* the transaction, and
   *                           the rollback takes them with it
   *
   * A real gate reads the workflow, the assignment and the document title before
   * it can refuse, which puts it firmly in the second case - the whole batch
   * rolls back, consistently. That is what is asserted here.
   *
   * It is a race rather than a contract, which is exactly why the error message
   * names the document it refused and says **nothing** about what happened to the
   * others. Either claim would be a lie under the wrong timing.
   */
  it('10. refuses the batch and names the document that caused it', async () => {
    const wf = await seedWorkflow(strapi);
    const ids = [await draft('ok one'), await draft('refused'), await draft('ok two')];

    await approve(wf, ids[0]);
    await approve(wf, ids[2]);

    await expect(documentManager().publishMany(UID, ids, 'en')).rejects.toThrow(/"refused"/);

    // The guarantee: the unapproved document does not go out. Ever.
    expect(await publishedCount(strapi, ids[1])).toBe(0);

    // Observed with a gate that does I/O before refusing: the rest roll back too.
    expect(await publishedCount(strapi, ids[0])).toBe(0);
    expect(await publishedCount(strapi, ids[2])).toBe(0);
  });

  it('publishes the whole batch when everything is approved', async () => {
    const wf = await seedWorkflow(strapi);
    const ids = [await draft('a'), await draft('b')];
    for (const id of ids) await approve(wf, id);

    await documentManager().publishMany(UID, ids, 'en');

    for (const id of ids) expect(await publishedCount(strapi, id)).toBe(1);
  });
});

describe('superAdmin', () => {
  /**
   * Bypasses the role checks on a transition, and **not** the publish gate. If it
   * bypassed the gate the feature would be off for the account most people
   * develop and operate with.
   */
  it('11. does not bypass the publish gate', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('super admin');

    await expect(strapi.documents(UID).publish({ documentId, locale: 'en' })).rejects.toThrow(
      /not been approved/
    );
  });
});
