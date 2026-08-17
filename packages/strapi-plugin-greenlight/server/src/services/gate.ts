import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

import { PLUGIN_ID } from '../uids';
import { normalizeLocale } from '../utils/locale';
import type { Assignment, Stage, Workflow } from '../types';

const { ApplicationError } = errors;

/**
 * Refused at publish time. Carries the document and stage in the message,
 * because the editor sees the message and nothing else.
 */
export class NotApprovedError extends ApplicationError {
  constructor(message: string) {
    // Through a cast: ApplicationError declares `name` as a literal type.
    super(message);
    Object.assign(this, { name: 'NotApprovedError' });
  }
}

const gate = ({ strapi }: { strapi: Core.Strapi }) => {
  const plugin = () => strapi.plugin(PLUGIN_ID);

  const self = {
    /**
     * Turns whatever `context.params.locale` held into the list of locales this
     * publish is actually about.
     *
     * There are five shapes and only two of them are obvious:
     *
     *   'en'            one locale
     *   '*'             every locale the document has - expanded here, because
     *                   the document service passes it through verbatim
     *   ['en','pl']     a bulk publish across locales, unflattened
     *   undefined       the default locale on a localized type, and *also* what a
     *                   type without i18n sends
     *   null            a caller being explicit about "no locale"
     *
     * The `undefined` row is where a gate leaks: read as "nothing to check" it
     * waves the publish straight through, and the feature quietly stops working
     * on the most common path of all.
     */
    async resolveLocales(
      uid: string,
      documentId: string,
      raw: string | string[] | null | undefined
    ): Promise<string[]> {
      if (Array.isArray(raw)) return raw.map(normalizeLocale);

      if (raw === '*') {
        const existing = await self.existingLocales(uid, documentId);
        return existing.length > 0 ? existing : [''];
      }

      if (raw === null || raw === undefined) {
        if (!self.isLocalized(uid)) return [''];

        const fallback = await self.defaultLocale();
        return [normalizeLocale(fallback)];
      }

      return [normalizeLocale(raw)];
    },

    isLocalized(uid: string): boolean {
      const model = strapi.contentTypes[uid as keyof typeof strapi.contentTypes] as
        { pluginOptions?: { i18n?: { localized?: boolean } } } | undefined;
      return model?.pluginOptions?.i18n?.localized === true;
    },

    async defaultLocale(): Promise<string | null> {
      try {
        const service = strapi.plugin('i18n')?.service('locales');
        return (await service?.getDefaultLocale()) ?? null;
      } catch {
        return null;
      }
    },

    async existingLocales(uid: string, documentId: string): Promise<string[]> {
      const rows = (await strapi.db.query(uid).findMany({
        where: { documentId },
        select: ['locale'],
      })) as Array<{ locale: string | null }>;

      return [...new Set(rows.map((row) => normalizeLocale(row.locale)))];
    },

    /**
     * Would `assertPublishable` let this one through?
     *
     * The same decision, for one locale, without the I/O or the throw - so the
     * edit view's Publish button and the list view's rows answer with the gate
     * rather than with their own guess at it. Every branch below mirrors one in
     * `assertPublishable`; if that gains a rule, this needs the same rule or the
     * UI starts lying about what will happen.
     *
     * The `onMissingAssignment` branch is the one worth naming: a document with
     * no assignment under a workflow set to `allow` **can** be published, and
     * anything deriving publishability from "is there a terminal stage here"
     * alone gets that backwards.
     */
    publishable(wf: Workflow | null, assignment: Assignment | null): boolean {
      if (!wf) return true;
      if (!wf.enforcePublishGate) return true;
      if (!assignment) return wf.onMissingAssignment === 'allow';

      return assignment.stageId === (plugin().service('workflow').terminalStage(wf) as Stage).id;
    },

    /**
     * The stage a document counts as being in, which is not always one it has
     * been put in: with `onMissingAssignment: 'firstStage'` a document that has
     * never been reviewed is treated as sitting in the first stage, and the gate
     * blocks it there.
     */
    effectiveStage(wf: Workflow | null, assignment: Assignment | null): Stage | null {
      if (!wf) return null;

      if (assignment) {
        return wf.stages.find((stage) => stage.id === assignment.stageId) ?? null;
      }

      return wf.onMissingAssignment === 'firstStage'
        ? (plugin().service('workflow').firstStage(wf) as Stage)
        : null;
    },

    /**
     * Throws unless every locale being published has reached its terminal stage.
     *
     * Called from the document-service middleware before `next()`, so throwing
     * here means the publish never happens rather than being reported after it
     * did.
     */
    async assertPublishable(
      uid: string,
      documentId: string,
      locales: string[],
      documentTitle?: string
    ): Promise<void> {
      const workflowService = plugin().service('workflow');
      const wf = (await workflowService.resolveForContentType(uid)) as Workflow | null;

      // Not under review at all: not our business.
      if (!wf) return;

      // The escape hatch for running the plugin as a status board rather than a
      // gate. Stages still move; publication is simply not blocked.
      if (!wf.enforcePublishGate) return;

      const terminal = workflowService.terminalStage(wf) as Stage;
      const blocked: Array<{ locale: string; stage: Stage | null; assignee: number | null }> = [];

      for (const locale of locales) {
        const current = (await plugin()
          .service('assignment')
          .get(uid, documentId, locale)) as Assignment | null;

        if (!current) {
          /**
           * A document that predates the plugin, or that was created while its
           * content type was not yet under review.
           *
           * The default has to block. If it allowed, installing the plugin would
           * change nothing for content that already exists, and the first person
           * to discover that would discover it in production.
           */
          if (wf.onMissingAssignment === 'allow') continue;

          const created = await plugin().service('assignment').ensure(uid, documentId, locale);
          const stage = wf.stages.find((candidate) => candidate.id === created.stageId) ?? null;
          blocked.push({ locale, stage, assignee: created.assigneeId });
          continue;
        }

        if (current.stageId === terminal.id) continue;

        const stage = wf.stages.find((candidate) => candidate.id === current.stageId) ?? null;
        blocked.push({ locale, stage, assignee: current.assigneeId });
      }

      if (blocked.length === 0) return;

      throw new NotApprovedError(await self.describe(uid, documentId, blocked, documentTitle));
    },

    /**
     * The message an editor actually reads.
     *
     * It names the document, the stage and the reviewer, because "cannot publish"
     * on its own leaves them with nothing to do next.
     *
     * It deliberately says **nothing** about the rest of a bulk publish. How much
     * of the batch survives a refusal is a race inside Strapi's transaction
     * bookkeeping - with I/O before the refusal, as here, the whole batch rolls
     * back; refuse synchronously and the siblings escape and commit. Neither
     * "the batch was rolled back" nor "the others were published" is safe to
     * claim, so the message claims neither. `tests/gate.test.ts` has the detail.
     */
    async describe(
      uid: string,
      documentId: string,
      blocked: Array<{ locale: string; stage: Stage | null; assignee: number | null }>,
      documentTitle?: string
    ): Promise<string> {
      const title = documentTitle ?? (await self.titleOf(uid, documentId)) ?? documentId;

      const named = blocked
        .map(({ locale, stage }) =>
          locale ? `${stage?.name ?? 'unknown'} (${locale})` : (stage?.name ?? 'unknown')
        )
        .join(', ');

      const assignee = await self.assigneeName(blocked.find((entry) => entry.assignee)?.assignee);
      const who = assignee ? `, assigned to ${assignee}` : ', unassigned';

      return `Cannot publish "${title}": it has not been approved. Currently at ${named}${who}.`;
    },

    async titleOf(uid: string, documentId: string): Promise<string | null> {
      try {
        const mainField = await self.mainFieldOf(uid);
        if (!mainField) return null;

        const row = (await strapi.db.query(uid).findOne({
          where: { documentId },
          select: [mainField],
        })) as Record<string, unknown> | null;

        const value = row?.[mainField];
        return typeof value === 'string' && value.trim() !== '' ? value : null;
      } catch {
        return null;
      }
    },

    /** Whatever the Content Manager shows as a row's label, so we say the same thing. */
    async mainFieldOf(uid: string): Promise<string | null> {
      try {
        const configuration = await strapi
          .plugin('content-manager')
          .service('content-types')
          .findConfiguration({ uid });

        const mainField = configuration?.settings?.mainField;
        return typeof mainField === 'string' && mainField !== 'id' ? mainField : null;
      } catch {
        return null;
      }
    },

    async assigneeName(assigneeId: number | null | undefined): Promise<string | null> {
      if (!assigneeId) return null;
      try {
        const user = (await strapi.db.query('admin::user').findOne({
          where: { id: assigneeId },
        })) as { firstname?: string; lastname?: string; email?: string } | null;

        if (!user) return null;
        return (
          [user.firstname, user.lastname].filter(Boolean).join(' ') ||
          user.email ||
          `#${assigneeId}`
        );
      } catch {
        return null;
      }
    },
  };

  return self;
};

export default gate;
