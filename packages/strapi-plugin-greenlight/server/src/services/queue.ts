import type { Core } from '@strapi/strapi';

import { ASSIGNMENT_UID, PLUGIN_ID, TRANSITION_UID } from '../uids';
import { denormalizeLocale } from '../utils/locale';
import type { Assignment, Stage, Workflow } from '../types';

export interface QueueItem {
  id: number;
  documentId: string;
  contentTypeUid: string;
  contentTypeName: string;
  locale: string | null;
  title: string;
  stage: Pick<Stage, 'id' | 'name' | 'color'> | null;
  assigneeId: number | null;
  lastTransitionAt: string | null;
}

/**
 * The "My reviews" page.
 *
 * Strapi gives a plugin no way to add a column or a filter to the Content
 * Manager's list view without modifying the user's own content types, which this
 * plugin will not do. So the queue is its own page — which is the better answer
 * anyway: a reviewer wants one list of everything waiting on them, across content
 * types, not a filter they have to remember to apply per collection.
 */
const queue = ({ strapi }: { strapi: Core.Strapi }) => {
  const self = {
    async list(filters: {
      assigneeId?: number | null;
      stageId?: number;
      uid?: string;
      locale?: string;
      page?: number;
      pageSize?: number;
    }): Promise<{ results: QueueItem[]; pagination: Record<string, number> }> {
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

      const where: Record<string, unknown> = {};
      if (filters.assigneeId !== undefined && filters.assigneeId !== null) {
        where.assigneeId = filters.assigneeId;
      }
      if (filters.stageId !== undefined) where.stageId = filters.stageId;
      if (filters.uid !== undefined) where.contentTypeUid = filters.uid;
      if (filters.locale !== undefined) where.locale = filters.locale;

      const [rows, total] = await Promise.all([
        strapi.db.query(ASSIGNMENT_UID).findMany({
          where,
          offset: (page - 1) * pageSize,
          limit: pageSize,
          orderBy: { updatedAt: 'desc' },
        }) as Promise<Assignment[]>,
        strapi.db.query(ASSIGNMENT_UID).count({ where }) as Promise<number>,
      ]);

      const stages = await self.stageIndex();
      const results = await Promise.all(rows.map((row) => self.decorate(row, stages)));

      return {
        results,
        pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total },
      };
    },

    /** Every stage in every workflow, by id — a queue page spans workflows. */
    async stageIndex(): Promise<Map<number, Stage>> {
      const workflows = (await strapi
        .plugin(PLUGIN_ID)
        .service('workflow')
        .findAll()) as Workflow[];

      const index = new Map<number, Stage>();
      for (const wf of workflows) {
        for (const stage of wf.stages) index.set(stage.id, stage);
      }
      return index;
    },

    async decorate(row: Assignment, stages: Map<number, Stage>): Promise<QueueItem> {
      const gate = strapi.plugin(PLUGIN_ID).service('gate');
      const stage = stages.get(row.stageId) ?? null;

      const title =
        (await gate.titleOf(row.contentTypeUid, row.relatedDocumentId)) ?? row.relatedDocumentId;

      const last = (await strapi.db.query(TRANSITION_UID).findMany({
        where: {
          relatedDocumentId: row.relatedDocumentId,
          contentTypeUid: row.contentTypeUid,
          locale: row.locale,
        },
        orderBy: { createdAt: 'desc' },
        limit: 1,
      })) as Array<{ createdAt: string }>;

      const model = strapi.contentTypes[row.contentTypeUid as keyof typeof strapi.contentTypes] as
        { info?: { displayName?: string } } | undefined;

      return {
        id: row.id,
        documentId: row.relatedDocumentId,
        contentTypeUid: row.contentTypeUid,
        contentTypeName: model?.info?.displayName ?? row.contentTypeUid,
        locale: denormalizeLocale(row.locale),
        title,
        stage: stage ? { id: stage.id, name: stage.name, color: stage.color } : null,
        assigneeId: row.assigneeId,
        lastTransitionAt: last[0]?.createdAt ?? null,
      };
    },
  };

  return self;
};

export default queue;
