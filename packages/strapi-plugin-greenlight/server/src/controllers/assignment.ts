import type { Core } from '@strapi/strapi';

import { PLUGIN_ID } from '../uids';
import { denormalizeLocale, normalizeLocale } from '../utils/locale';
import type { AdminUser, Assignment, Stage, Workflow } from '../types';

const service = (strapi: Core.Strapi, name: string) => strapi.plugin(PLUGIN_ID).service(name);

/**
 * The list view caps its page size at 100. The headroom is for a caller that
 * batches two pages; past this the `IN (...)` stops being a sensible query and
 * saying so beats letting the database decide.
 */
const MAX_BATCH = 200;

/** `?documentIds=a,b` and `?documentIds[]=a&documentIds[]=b` both arrive here. */
const parseDocumentIds = (raw: unknown): string[] => {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];

  return [...new Set(list.map((value) => String(value).trim()).filter(Boolean))];
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Everything the edit-view panel needs, in one call.
   *
   * Including `version`: the panel sends it back with the next transition, and
   * that is what makes two reviewers clicking at once resolve into one winner and
   * one 409 rather than a coin toss.
   */
  async find(ctx: any) {
    const { uid, documentId } = ctx.params;
    const locale = normalizeLocale(ctx.query?.locale ?? null);
    const user = ctx.state.user as AdminUser;

    const wf = (await service(strapi, 'workflow').resolveForContentType(uid)) as Workflow | null;

    // Not under review: the panel renders nothing at all.
    if (!wf) {
      ctx.body = { workflow: null };
      return;
    }

    const current = (await service(strapi, 'assignment').get(
      uid,
      documentId,
      locale
    )) as Assignment | null;

    const currentStage = current
      ? (wf.stages.find((stage) => stage.id === current.stageId) ?? null)
      : null;

    const targets = service(strapi, 'permission').availableTargets(
      wf,
      currentStage,
      user
    ) as Stage[];

    ctx.body = {
      workflow: {
        id: wf.id,
        name: wf.name,
        enforcePublishGate: wf.enforcePublishGate,
        stages: wf.stages,
      },
      assignment: current
        ? {
            id: current.id,
            stageId: current.stageId,
            assigneeId: current.assigneeId,
            version: current.version,
            locale: denormalizeLocale(current.locale),
          }
        : null,
      currentStage,
      availableTargets: targets,
      /**
       * Drives the disabled state of the Publish button, and comes from the gate
       * itself rather than from a second reading of the same rules — see
       * `gate.publishable`.
       */
      isPublishable: service(strapi, 'gate').publishable(wf, current),
    };
  },

  /**
   * The batch sibling of `find`: one answer per document, for a page of them.
   *
   * Both the list view's stage column and its Publish buttons read this. They
   * used to ask separately and per row — the column would have been one request
   * per page and the buttons one per row, for the same documents.
   *
   * There is an entry for **every** id asked about, including documents with no
   * assignment at all, because "no row in the table" is not the same answer as
   * "not under review" and the caller cannot tell them apart from silence.
   */
  async findMany(ctx: any) {
    const { uid } = ctx.params;
    const documentIds = parseDocumentIds(ctx.query?.documentIds);
    const locale = normalizeLocale(ctx.query?.locale ?? null);

    if (documentIds.length > MAX_BATCH) {
      return ctx.badRequest(`documentIds is limited to ${MAX_BATCH} per request`);
    }

    const wf = (await service(strapi, 'workflow').resolveForContentType(uid)) as Workflow | null;

    // Not under review: no column, and no opinion about publishing.
    if (!wf) {
      ctx.body = { workflow: null, documents: {} };
      return;
    }

    const rows = (await service(strapi, 'assignment').getMany(uid, documentIds)) as Assignment[];
    const byDocument = new Map<string, Assignment>();
    for (const row of rows) {
      if (row.locale === locale) byDocument.set(row.relatedDocumentId, row);
    }

    const gate = service(strapi, 'gate');
    const documents: Record<string, unknown> = {};

    for (const documentId of documentIds) {
      const current = byDocument.get(documentId) ?? null;
      const stage = gate.effectiveStage(wf, current) as Stage | null;

      documents[documentId] = {
        assigned: current !== null,
        stageId: stage?.id ?? null,
        stageName: stage?.name ?? null,
        stageColor: stage?.color ?? null,
        assigneeId: current?.assigneeId ?? null,
        publishable: gate.publishable(wf, current),
      };
    }

    ctx.body = {
      workflow: {
        id: wf.id,
        name: wf.name,
        enforcePublishGate: wf.enforcePublishGate,
        onMissingAssignment: wf.onMissingAssignment,
        stages: wf.stages,
      },
      documents,
    };
  },

  async transition(ctx: any) {
    const { uid, documentId } = ctx.params;
    const { toStageId, comment, version, locale } = ctx.request.body ?? {};

    if (typeof toStageId !== 'number' || typeof version !== 'number') {
      return ctx.badRequest('toStageId and version are required, and must be numbers');
    }

    const updated = await service(strapi, 'assignment').transition({
      uid,
      documentId,
      locale: locale ?? null,
      toStageId,
      comment,
      version,
      user: ctx.state.user as AdminUser,
    });

    ctx.body = { assignment: updated };
  },

  async assign(ctx: any) {
    const { uid, documentId } = ctx.params;
    const { assigneeId, version, locale } = ctx.request.body ?? {};

    if (typeof version !== 'number') {
      return ctx.badRequest('version is required, and must be a number');
    }
    if (assigneeId !== null && typeof assigneeId !== 'number') {
      return ctx.badRequest('assigneeId must be a number, or null to unassign');
    }

    const updated = await service(strapi, 'assignment').assign({
      uid,
      documentId,
      locale: locale ?? null,
      assigneeId,
      version,
    });

    ctx.body = { assignment: updated };
  },

  async history(ctx: any) {
    const { uid, documentId } = ctx.params;
    const locale = ctx.query?.locale ?? null;

    ctx.body = {
      history: await service(strapi, 'assignment').history(uid, documentId, locale),
    };
  },

  async queue(ctx: any) {
    const { stageId, assigneeId, uid, locale, page, pageSize } = ctx.query ?? {};

    const toNumber = (value: unknown): number | undefined =>
      value === undefined || value === '' ? undefined : Number(value);

    ctx.body = await service(strapi, 'queue').list({
      // "mine" is the default the page opens with — a reviewer wants their own
      // queue first, not everyone's.
      assigneeId:
        assigneeId === 'all' ? undefined : (toNumber(assigneeId) ?? ctx.state.user?.id ?? null),
      stageId: toNumber(stageId),
      uid: uid || undefined,
      locale: locale === undefined ? undefined : normalizeLocale(locale),
      page: toNumber(page),
      pageSize: toNumber(pageSize),
    });
  },
});

export default controller;
