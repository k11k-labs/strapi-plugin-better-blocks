import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

import { ASSIGNMENT_UID, PLUGIN_ID, TRANSITION_UID } from '../uids';
import { normalizeLocale } from '../utils/locale';
import type { AdminUser, Assignment, Stage, Workflow } from '../types';

const { ApplicationError, ValidationError, ForbiddenError, NotFoundError } = errors;

/**
 * HTTP 409. Strapi has no built-in for it, and here the status *is* the message:
 * the client has to know to re-read rather than to retry.
 *
 * `name` and `status` are assigned through a cast because `ApplicationError`
 * declares `name` as the literal `'ApplicationError'`.
 */
export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message);
    Object.assign(this, { name: 'ConflictError', status: 409 });
  }
}

const displayName = (user: AdminUser): string =>
  [user.firstname, user.lastname].filter(Boolean).join(' ') ||
  user.username ||
  user.email ||
  `user ${user.id}`;

const services = (strapi: Core.Strapi) => ({
  workflow: () => strapi.plugin(PLUGIN_ID).service('workflow'),
  permission: () => strapi.plugin(PLUGIN_ID).service('permission'),
});

const assignment = ({ strapi }: { strapi: Core.Strapi }) => {
  const { workflow: workflowService, permission } = services(strapi);

  const self = {
    async get(uid: string, documentId: string, locale: string | null): Promise<Assignment | null> {
      return (await strapi.db.query(ASSIGNMENT_UID).findOne({
        where: {
          relatedDocumentId: documentId,
          contentTypeUid: uid,
          locale: normalizeLocale(locale),
        },
      })) as Assignment | null;
    },

    /**
     * The assignment for a document, creating it in the first stage if it has
     * none.
     *
     * Idempotent is not enough here: a bulk publish calls this concurrently for
     * the same document, both callers find nothing, and both insert. The unique
     * index turns that into an error rather than a duplicate, and catching it and
     * re-reading is what makes the whole thing safe. "Check, then insert" is
     * exactly the race — the check is worthless by the time the insert runs.
     */
    async ensure(uid: string, documentId: string, locale: string | null): Promise<Assignment> {
      const normalized = normalizeLocale(locale);

      const existing = await self.get(uid, documentId, normalized);
      if (existing) return existing;

      const wf = (await workflowService().resolveForContentType(uid)) as Workflow | null;
      if (!wf) {
        throw new ApplicationError(`${uid} is not part of any review workflow`);
      }

      const first = workflowService().firstStage(wf) as Stage;

      try {
        return (await strapi.db.query(ASSIGNMENT_UID).create({
          data: {
            relatedDocumentId: documentId,
            contentTypeUid: uid,
            locale: normalized,
            stageId: first.id,
            assigneeId: null,
            version: 0,
          },
        })) as Assignment;
      } catch (error) {
        // Someone else won the race. Their row is as good as ours would have been.
        const raced = await self.get(uid, documentId, normalized);
        if (raced) return raced;
        throw error;
      }
    },

    /**
     * The only place that writes an assignment or a transition.
     *
     * Everything happens in one transaction, and `version` is checked inside it:
     * two reviewers with the same panel open both send version 3, and the second
     * one has to lose rather than silently overwrite a decision it never saw.
     */
    async transition(input: {
      uid: string;
      documentId: string;
      locale: string | null;
      toStageId: number;
      comment?: string;
      version: number;
      user: AdminUser;
    }): Promise<Assignment> {
      const { uid, documentId, toStageId, comment, version, user } = input;
      const locale = normalizeLocale(input.locale);

      const wf = (await workflowService().resolveForContentType(uid)) as Workflow | null;
      if (!wf) throw new ApplicationError(`${uid} is not part of any review workflow`);

      const target = wf.stages.find((stage) => stage.id === toStageId);
      if (!target) {
        throw new ValidationError(`Stage ${toStageId} does not belong to workflow "${wf.name}"`);
      }

      const current = await self.ensure(uid, documentId, locale);
      const from = wf.stages.find((stage) => stage.id === current.stageId) ?? null;

      if (current.stageId === toStageId) return current;

      // Server-side, on the route, not only in the UI: hiding an option in a
      // dropdown is a convenience, and this is the actual check.
      if (from && !permission().canMoveFrom(from, user)) {
        throw new ForbiddenError(`Your role cannot move documents out of "${from.name}"`);
      }
      if (!permission().canMoveTo(target, user)) {
        throw new ForbiddenError(`Your role cannot move documents into "${target.name}"`);
      }

      const updated = await strapi.db.transaction(async () => {
        const fresh = (await strapi.db.query(ASSIGNMENT_UID).findOne({
          where: { id: current.id },
        })) as Assignment;

        if (fresh.version !== version) {
          throw new ConflictError(
            `Someone else changed this document's stage while you were looking at it. Refresh to see where it is now.`
          );
        }

        const next = (await strapi.db.query(ASSIGNMENT_UID).update({
          where: { id: fresh.id },
          data: { stageId: toStageId, version: fresh.version + 1 },
        })) as Assignment;

        await strapi.db.query(TRANSITION_UID).create({
          data: {
            relatedDocumentId: documentId,
            contentTypeUid: uid,
            locale,
            fromStageId: from?.id ?? null,
            toStageId,
            // Denormalised on purpose: the log has to stay readable after a
            // stage is renamed or deleted, or an account is removed.
            fromStageName: from?.name ?? null,
            toStageName: target.name,
            byUserId: user?.id ?? null,
            byUserName: user ? displayName(user) : null,
            comment: comment ?? null,
          },
        });

        return next;
      });

      await self.runTransitionHook({
        uid,
        documentId,
        locale,
        fromStageId: from?.id ?? null,
        toStageId,
        byUserId: user?.id ?? null,
      });

      return updated;
    },

    async assign(input: {
      uid: string;
      documentId: string;
      locale: string | null;
      assigneeId: number | null;
      version: number;
    }): Promise<Assignment> {
      const { uid, documentId, assigneeId, version } = input;
      const locale = normalizeLocale(input.locale);

      const current = await self.ensure(uid, documentId, locale);

      return (await strapi.db.transaction(async () => {
        const fresh = (await strapi.db.query(ASSIGNMENT_UID).findOne({
          where: { id: current.id },
        })) as Assignment;

        if (fresh.version !== version) {
          throw new ConflictError(
            `Someone else changed this document while you were looking at it. Refresh to see the current reviewer.`
          );
        }

        return strapi.db.query(ASSIGNMENT_UID).update({
          where: { id: fresh.id },
          data: { assigneeId, version: fresh.version + 1 },
        });
      })) as Assignment;
    },

    async history(uid: string, documentId: string, locale: string | null) {
      return strapi.db.query(TRANSITION_UID).findMany({
        where: {
          relatedDocumentId: documentId,
          contentTypeUid: uid,
          locale: normalizeLocale(locale),
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    /** Removes the assignment for a deleted document. The log stays. */
    async forget(uid: string, documentId: string, locale?: string | null): Promise<void> {
      const where: Record<string, unknown> = {
        relatedDocumentId: documentId,
        contentTypeUid: uid,
      };
      if (locale !== undefined) where.locale = normalizeLocale(locale);

      await strapi.db.query(ASSIGNMENT_UID).deleteMany({ where });
    },

    /**
     * The user's hook, if they configured one.
     *
     * Errors are logged and swallowed. A transition is already written and
     * durable by the time this runs; letting someone's webhook throw it away
     * would turn a notification outage into data loss.
     */
    async runTransitionHook(payload: Record<string, unknown>): Promise<void> {
      const hook = strapi.config.get(`plugin::${PLUGIN_ID}.hooks.onTransition`) as
        ((payload: unknown) => unknown) | null;

      if (typeof hook !== 'function') return;

      try {
        await hook(payload);
      } catch (error) {
        strapi.log.error(
          `[greenlight] onTransition hook threw: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },

    NotFoundError,
  };

  return self;
};

export default assignment;
