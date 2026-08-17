import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

import {
  NO_DP_UID,
  PLAIN_UID,
  SUPER_ADMIN,
  UID,
  asUser,
  bootWithGreenlight,
  plugin,
  seedWorkflow,
} from './helpers';

/** Scenarios 12-24: transitions, permissions, durability and cleanup. */

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

const move = (documentId: string, toStageId: number, version: number, user = asUser()) =>
  plugin(strapi, 'assignment').transition({
    uid: UID,
    documentId,
    locale: 'en',
    toStageId,
    version,
    user,
  });

describe('permissions per stage', () => {
  it('12. a role not in rolesCanMoveTo is refused, even calling the service directly', async () => {
    const wf = await seedWorkflow(strapi, {
      stages: [
        { name: 'Draft', order: 0 },
        { name: 'In review', order: 1 },
        // Only role 7 may approve.
        { name: 'Approved', order: 2, isTerminal: true, rolesCanMoveTo: [7] },
      ],
    });
    const terminal = wf.stages.find((s: any) => s.isTerminal);
    const documentId = await draft('needs role 7');
    const current = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');

    await expect(
      move(documentId, terminal.id, current.version, asUser(2, [{ id: 3 }]))
    ).rejects.toThrow(/cannot move documents into/);

    // And the document really did not move.
    const after = await plugin(strapi, 'assignment').get(UID, documentId, 'en');
    expect(after.stageId).toBe(current.stageId);
  });

  it('13. a role not in rolesCanMoveFrom cannot pull a document back out', async () => {
    const wf = await seedWorkflow(strapi, {
      stages: [
        { name: 'Draft', order: 0 },
        { name: 'Approved', order: 1, isTerminal: true, rolesCanMoveFrom: [7] },
      ],
    });
    const [draftStage, approved] = wf.stages;
    const documentId = await draft('locked once approved');

    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    const approvedAssignment = await move(
      documentId,
      approved.id,
      a.version,
      asUser(1, [{ id: 7 }])
    );

    await expect(
      move(documentId, draftStage.id, approvedAssignment.version, asUser(2, [{ id: 3 }]))
    ).rejects.toThrow(/cannot move documents out of/);
  });

  it('an empty role list means anyone, not nobody', async () => {
    const wf = await seedWorkflow(strapi);
    const terminal = wf.stages.find((s: any) => s.isTerminal);
    const documentId = await draft('open workflow');
    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');

    const moved = await move(documentId, terminal.id, a.version, asUser(42, [{ id: 999 }]));
    expect(moved.stageId).toBe(terminal.id);
  });

  it('14. superAdmin bypasses the per-stage role checks', async () => {
    const wf = await seedWorkflow(strapi, {
      stages: [
        { name: 'Draft', order: 0 },
        { name: 'Approved', order: 1, isTerminal: true, rolesCanMoveTo: [7] },
      ],
    });
    const terminal = wf.stages.find((s: any) => s.isTerminal);
    const documentId = await draft('super admin moves it');
    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');

    const moved = await move(documentId, terminal.id, a.version, SUPER_ADMIN);
    expect(moved.stageId).toBe(terminal.id);
  });

  it('availableTargets is the intersection of both lists', async () => {
    const wf = await seedWorkflow(strapi, {
      stages: [
        { name: 'Draft', order: 0, rolesCanMoveFrom: [5] },
        { name: 'In review', order: 1 },
        { name: 'Approved', order: 2, isTerminal: true, rolesCanMoveTo: [7] },
      ],
    });
    const [draftStage] = wf.stages;
    const permission = plugin(strapi, 'permission');

    // Can leave Draft (role 5), but cannot enter Approved (needs 7).
    const forEditor = permission.availableTargets(wf, draftStage, asUser(1, [{ id: 5 }]));
    expect(forEditor.map((s: any) => s.name)).toEqual(['In review']);

    // Cannot leave Draft at all.
    expect(permission.availableTargets(wf, draftStage, asUser(2, [{ id: 9 }]))).toEqual([]);
  });
});

describe('optimistic locking', () => {
  it('15. a second transition with a stale version gets a conflict, and the log has one entry', async () => {
    const wf = await seedWorkflow(strapi);
    const [, review, approved] = wf.stages;
    const documentId = await draft('two reviewers');

    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');

    await move(documentId, review.id, a.version);
    // Second reviewer still holding the version they rendered with.
    await expect(move(documentId, approved.id, a.version)).rejects.toThrow(/Someone else changed/);

    const history = await plugin(strapi, 'assignment').history(UID, documentId, 'en');
    expect(history).toHaveLength(1);

    const after = await plugin(strapi, 'assignment').get(UID, documentId, 'en');
    expect(after.stageId).toBe(review.id);
  });
});

describe('assignments', () => {
  it('16. concurrent ensure() for the same document creates exactly one row', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('raced');

    const results = await Promise.all(
      Array.from({ length: 6 }, () => plugin(strapi, 'assignment').ensure(UID, documentId, 'en'))
    );

    const ids = new Set(results.map((row: any) => row.id));
    expect(ids.size).toBe(1);

    const rows = await strapi.db
      .query('plugin::greenlight.assignment')
      .findMany({ where: { relatedDocumentId: documentId } });
    expect(rows).toHaveLength(1);
  });

  it('17. a content type without i18n cannot get two assignments', async () => {
    await seedWorkflow(strapi, {}, [PLAIN_UID]);
    const documentId = await draft('no locales', PLAIN_UID);

    await plugin(strapi, 'assignment').ensure(PLAIN_UID, documentId, null);

    // The unique index has to hold with an empty-string locale. With NULL it
    // would not, because NULL never equals NULL in a unique index.
    await expect(
      strapi.db.query('plugin::greenlight.assignment').create({
        data: {
          relatedDocumentId: documentId,
          contentTypeUid: PLAIN_UID,
          locale: '',
          stageId: 1,
          version: 0,
        },
      })
    ).rejects.toThrow();
  });

  it('records the reviewer, and unassigns with null', async () => {
    await seedWorkflow(strapi);
    const documentId = await draft('assign me');
    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');

    const assigned = await plugin(strapi, 'assignment').assign({
      uid: UID,
      documentId,
      locale: 'en',
      assigneeId: 5,
      version: a.version,
    });
    expect(assigned.assigneeId).toBe(5);

    const cleared = await plugin(strapi, 'assignment').assign({
      uid: UID,
      documentId,
      locale: 'en',
      assigneeId: null,
      version: assigned.version,
    });
    expect(cleared.assigneeId).toBeNull();
  });
});

describe('durability and cleanup', () => {
  it('18. the tables are registered as persisted, so a disabled boot cannot drop them', async () => {
    const persisted = (await strapi.store.get({ type: 'core', key: 'persisted_tables' })) as any[];
    const names = persisted.map((t: any) => (typeof t === 'string' ? t : t.name));

    for (const table of [
      'greenlight_workflows',
      'greenlight_stages',
      'greenlight_assignments',
      'greenlight_transitions',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('19. deleting a document forgets the assignment and keeps the log', async () => {
    const wf = await seedWorkflow(strapi);
    const [, review] = wf.stages;
    const documentId = await draft('doomed');

    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    await move(documentId, review.id, a.version);

    await strapi.documents(UID).delete({ documentId });
    // The cleanup is deliberately detached from the delete.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(await plugin(strapi, 'assignment').get(UID, documentId, 'en')).toBeNull();
    expect(await plugin(strapi, 'assignment').history(UID, documentId, 'en')).toHaveLength(1);
  });

  it('20. deleting a stage moves anything sitting in it to the first stage', async () => {
    const wf = await seedWorkflow(strapi);
    const [first, review] = wf.stages;
    const documentId = await draft('in the doomed stage');

    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    await move(documentId, review.id, a.version);

    await plugin(strapi, 'workflow').update(wf.id, {
      name: wf.name,
      contentTypes: wf.contentTypes,
      stages: [
        { id: first.id, name: 'Draft', order: 0 },
        { id: wf.stages[2].id, name: 'Approved', order: 1, isTerminal: true },
      ],
    });

    const after = await plugin(strapi, 'assignment').get(UID, documentId, 'en');
    expect(after.stageId).toBe(first.id);
  });

  it('21. the last stage and the last workflow cannot be removed', async () => {
    const wf = await seedWorkflow(strapi);

    await expect(
      plugin(strapi, 'workflow').update(wf.id, {
        name: wf.name,
        contentTypes: wf.contentTypes,
        stages: [],
      })
    ).rejects.toThrow(/at least one stage/);

    await expect(plugin(strapi, 'workflow').delete(wf.id)).rejects.toThrow(/last workflow/);
  });

  it('22. removing the reviewer account leaves the assignment and the log readable', async () => {
    const wf = await seedWorkflow(strapi);
    const [, review] = wf.stages;
    const documentId = await draft('orphaned reviewer');

    const a = await plugin(strapi, 'assignment').ensure(UID, documentId, 'en');
    await plugin(strapi, 'assignment').assign({
      uid: UID,
      documentId,
      locale: 'en',
      assigneeId: 4242,
      version: a.version,
    });

    const withReviewer = await plugin(strapi, 'assignment').get(UID, documentId, 'en');
    await move(documentId, review.id, withReviewer.version, asUser(4242));

    // assigneeId is an integer, not a relation, so nothing cascades.
    const history = await plugin(strapi, 'assignment').history(UID, documentId, 'en');
    expect(history[0].byUserName).toBe('Anna Kowalska');
    expect(history[0].toStageName).toBe('In review');
  });
});

describe('workflow validation', () => {
  it('23. a content type without Draft & Publish is rejected at configuration time', async () => {
    await expect(
      plugin(strapi, 'workflow').create({
        name: 'No D&P',
        contentTypes: [NO_DP_UID],
        stages: [{ name: 'Only', order: 0, isTerminal: true }],
      })
    ).rejects.toThrow(/Draft & Publish/);
  });

  it('24. a content type cannot belong to two workflows', async () => {
    await seedWorkflow(strapi);

    await expect(
      plugin(strapi, 'workflow').create({
        name: 'Second claim',
        contentTypes: [UID],
        stages: [{ name: 'Only', order: 0, isTerminal: true }],
      })
    ).rejects.toThrow(/already assigned to the workflow/);
  });

  it('requires exactly one terminal stage', async () => {
    await expect(
      plugin(strapi, 'workflow').create({
        name: 'No terminal',
        contentTypes: [],
        stages: [{ name: 'Draft', order: 0 }],
      })
    ).rejects.toThrow(/exactly one terminal stage/);

    await expect(
      plugin(strapi, 'workflow').create({
        name: 'Two terminals',
        contentTypes: [],
        stages: [
          { name: 'A', order: 0, isTerminal: true },
          { name: 'B', order: 1, isTerminal: true },
        ],
      })
    ).rejects.toThrow(/exactly one terminal stage/);
  });

  it('requires stage order to run from 0 with no gaps', async () => {
    await expect(
      plugin(strapi, 'workflow').create({
        name: 'Gappy',
        contentTypes: [],
        stages: [
          { name: 'A', order: 0 },
          { name: 'B', order: 5, isTerminal: true },
        ],
      })
    ).rejects.toThrow(/no gaps/);
  });
});
