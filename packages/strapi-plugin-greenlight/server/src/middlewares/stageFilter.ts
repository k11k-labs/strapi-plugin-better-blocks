import type { Core } from '@strapi/strapi';

import { ASSIGNMENT_UID, PLUGIN_ID } from '../uids';
import { normalizeLocale } from '../utils/locale';
import type { Assignment, Stage, Workflow } from '../types';

/**
 * The query key the admin's injected filter writes. Must match `FILTER_NAME` in
 * `admin/src/components/stageColumn.tsx`.
 */
const FILTER_NAME = 'greenlightStage';

/**
 * How many document ids may go into the rewritten `$in` / `$notIn`.
 *
 * Every id becomes a bind parameter, and Postgres stops at 65535 for the whole
 * statement. This is deliberately far below that, and deliberately an error
 * rather than a truncation: a filter that quietly returns some of the matches
 * is worse than one that says it cannot answer.
 */
const MAX_FILTER_IDS = 5_000;

const LIST_PATH = /\/content-manager\/collection-types\/([^/]+)\/?$/;

interface Clause {
  operator: string;
  stageId: number;
}

/**
 * Pulls our clauses out of the query and returns what is left.
 *
 * The Content Manager writes filters as `filters[$and][0][greenlightStage][$eq]`,
 * but hand-written queries nest differently, so this walks the whole tree.
 * Objects left empty by the removal are dropped — an empty `{}` inside `$and`
 * is not harmless, it is a filter matching everything.
 */
const extract = (node: unknown, clauses: Clause[]): unknown => {
  if (Array.isArray(node)) {
    return node.map((item) => extract(item, clauses)).filter((item) => !isEmpty(item));
  }

  if (!node || typeof node !== 'object') return node;

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === FILTER_NAME) {
      for (const [operator, raw] of Object.entries((value ?? {}) as Record<string, unknown>)) {
        const stageId = Number(raw);
        if (Number.isFinite(stageId)) clauses.push({ operator, stageId });
      }
      continue;
    }

    const cleaned = extract(value, clauses);
    if (isEmpty(cleaned)) continue;
    out[key] = cleaned;
  }

  return out;
};

const isEmpty = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 0;

/**
 * Turns "the review stage is X" into a filter the Content Manager can actually
 * run.
 *
 * A stage lives in this plugin's own table, and the Content Manager validates
 * every filter against the content type's schema before the query is built — so
 * the only way through is to answer the stage question here, up front, and hand
 * the result on as a `documentId` filter, which *is* an attribute it knows.
 *
 * The subtlety is documents with no assignment row. Under
 * `onMissingAssignment: 'firstStage'` they count as being in the first stage and
 * the gate blocks them there, so filtering by that stage has to include them —
 * expressed as "has no assignment at all", the `$notIn` branch below. Leave it
 * out and the first stage is the one stage the filter gets wrong, which is also
 * the stage most documents are in.
 */
const buildFilter = async (
  strapi: Core.Strapi,
  wf: Workflow,
  uid: string,
  locale: string,
  clause: Clause
): Promise<{ filter?: Record<string, unknown>; tooMany?: number }> => {
  const query = strapi.db.query(ASSIGNMENT_UID);

  const inStage = (await query.findMany({
    where: { contentTypeUid: uid, locale, stageId: clause.stageId },
    select: ['relatedDocumentId'],
  })) as Array<Pick<Assignment, 'relatedDocumentId'>>;

  const stageIds = [...new Set(inStage.map((row) => row.relatedDocumentId))];

  const firstStage = strapi.plugin(PLUGIN_ID).service('workflow').firstStage(wf) as Stage;
  const implied = wf.onMissingAssignment === 'firstStage' && clause.stageId === firstStage.id;

  // Only paid for when the implied case is actually in play.
  let assignedIds: string[] = [];
  if (implied) {
    const assigned = (await query.findMany({
      where: { contentTypeUid: uid, locale },
      select: ['relatedDocumentId'],
    })) as Array<Pick<Assignment, 'relatedDocumentId'>>;

    assignedIds = [...new Set(assigned.map((row) => row.relatedDocumentId))];
  }

  const total = stageIds.length + assignedIds.length;
  if (total > MAX_FILTER_IDS) return { tooMany: total };

  const isEq = clause.operator === '$eq';

  if (implied) {
    return {
      filter: isEq
        ? { $or: [{ documentId: { $in: stageIds } }, { documentId: { $notIn: assignedIds } }] }
        : { $and: [{ documentId: { $notIn: stageIds } }, { documentId: { $in: assignedIds } }] },
    };
  }

  return {
    filter: isEq ? { documentId: { $in: stageIds } } : { documentId: { $notIn: stageIds } },
  };
};

/**
 * Rewrites a review-stage filter before the Content Manager sees it.
 *
 * Registered on the Koa app in `bootstrap()`, which puts it after Strapi's own
 * middlewares — authentication and error formatting have both run — and before
 * the router, which is only mounted when the server starts listening.
 */
export const stageFilter =
  (strapi: Core.Strapi) =>
  async (ctx: any, next: () => Promise<unknown>): Promise<unknown> => {
    if (ctx.method !== 'GET') return next();

    const match = LIST_PATH.exec(ctx.path);
    if (!match) return next();

    /**
     * Mutated in place rather than reassigned. Strapi replaces Koa's query
     * getter with one that caches the parsed object per query string, so the
     * controller reads back this same object; assigning to `ctx.request.query`
     * would round-trip the whole thing through `qs.stringify` for no reason.
     */
    const query = ctx.request.query as Record<string, unknown> | undefined;
    const filters = query?.filters;
    if (!filters) return next();

    const clauses: Clause[] = [];
    const rest = extract(filters, clauses);
    if (clauses.length === 0) return next();

    const uid = decodeURIComponent(match[1]);
    const wf = (await strapi
      .plugin(PLUGIN_ID)
      .service('workflow')
      .resolveForContentType(uid)) as Workflow | null;

    // The filter is only offered for content types under a workflow; if one
    // arrives for any other, drop it rather than answering it wrongly.
    if (!wf) {
      query!.filters = rest;
      return next();
    }

    const locale = normalizeLocale((query?.locale as string | undefined) ?? null);
    const built: Array<Record<string, unknown>> = [];

    for (const clause of clauses) {
      const { filter, tooMany } = await buildFilter(strapi, wf, uid, locale, clause);

      if (tooMany !== undefined) {
        ctx.status = 400;
        ctx.body = {
          error: {
            status: 400,
            name: 'BadRequestError',
            message: `Too many documents to filter by review stage (${tooMany}, limit ${MAX_FILTER_IDS}). Narrow the list with another filter first, or use the Greenlight review queue.`,
          },
        };
        return undefined;
      }

      if (filter) built.push(filter);
    }

    const rewritten: Record<string, unknown> =
      rest && typeof rest === 'object' && !Array.isArray(rest)
        ? { ...(rest as Record<string, unknown>) }
        : {};

    const existing = rewritten.$and;
    rewritten.$and = [
      ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      ...built,
    ];

    query!.filters = rewritten;

    return next();
  };
