import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

import { ASSIGNMENT_UID, STAGE_UID, WORKFLOW_UID } from '../uids';
import type { Stage, Workflow, WorkflowInput } from '../types';

const { ApplicationError, ValidationError, NotFoundError } = errors;

const byOrder = (a: Stage, b: Stage) => a.order - b.order;

const workflow = ({ strapi }: { strapi: Core.Strapi }) => ({
  async findAll(): Promise<Workflow[]> {
    const rows = (await strapi.db.query(WORKFLOW_UID).findMany({
      populate: { stages: true },
    })) as Workflow[];

    return rows.map((row) => ({ ...row, stages: [...(row.stages ?? [])].sort(byOrder) }));
  },

  async findOne(id: number): Promise<Workflow | null> {
    const row = (await strapi.db.query(WORKFLOW_UID).findOne({
      where: { id },
      populate: { stages: true },
    })) as Workflow | null;

    if (!row) return null;
    return { ...row, stages: [...(row.stages ?? [])].sort(byOrder) };
  },

  /**
   * The workflow a content type belongs to, or null if it is not under review.
   *
   * `contentTypes` is a json column rather than a relation, so this cannot be a
   * where-clause and is a scan instead. There are a handful of workflows in any
   * realistic install, and the gate calls this on every publish, so if that ever
   * stops being true this is the thing to cache.
   */
  async resolveForContentType(uid: string): Promise<Workflow | null> {
    const all = await this.findAll();
    return all.find((candidate) => (candidate.contentTypes ?? []).includes(uid)) ?? null;
  },

  firstStage(wf: Workflow): Stage {
    const [first] = [...wf.stages].sort(byOrder);
    if (!first) {
      // validate() makes this unreachable; if it happens the data was written
      // around the service and saying so beats a confusing undefined later.
      throw new ApplicationError(`Workflow "${wf.name}" has no stages`);
    }
    return first;
  },

  terminalStage(wf: Workflow): Stage {
    const terminal = wf.stages.find((stage) => stage.isTerminal);
    if (!terminal) {
      throw new ApplicationError(`Workflow "${wf.name}" has no terminal stage`);
    }
    return terminal;
  },

  /**
   * Everything the data model cannot express itself.
   *
   * Throws on the first problem rather than collecting them: these are all
   * conditions the admin UI prevents, so a caller hitting one is either using the
   * API directly or has found a bug, and in both cases the first failure is the
   * useful one.
   */
  async validate(input: WorkflowInput, { excludeId }: { excludeId?: number } = {}): Promise<void> {
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('A workflow needs a name');
    }

    const stages = input.stages ?? [];
    if (stages.length === 0) {
      throw new ValidationError('A workflow needs at least one stage');
    }

    const terminals = stages.filter((stage) => stage.isTerminal);
    if (terminals.length !== 1) {
      throw new ValidationError(
        `A workflow needs exactly one terminal stage, received ${terminals.length}. The terminal stage is the one that allows publication.`
      );
    }

    const orders = stages.map((stage) => stage.order).sort((a, b) => a - b);
    const contiguous = orders.every((order, index) => order === index);
    if (!contiguous) {
      throw new ValidationError(
        `Stage order must run from 0 with no gaps and no duplicates, received: ${orders.join(', ')}`
      );
    }

    for (const uid of input.contentTypes ?? []) {
      const model = strapi.contentTypes[uid as keyof typeof strapi.contentTypes];
      if (!model) {
        throw new ValidationError(`Unknown content type: ${uid}`);
      }

      /**
       * Rejected here rather than at the first publish. A content type without
       * Draft & Publish has nothing to gate — there is no publish action to
       * refuse — so putting one under review would silently do nothing, and the
       * person who configured it would find out months later.
       */
      if (!(model as { options?: { draftAndPublish?: boolean } }).options?.draftAndPublish) {
        throw new ValidationError(
          `${uid} does not have Draft & Publish enabled, so there is no publication to gate. Enable Draft & Publish on it first, or remove it from this workflow.`
        );
      }
    }

    await this.assertContentTypesUnclaimed(input.contentTypes ?? [], excludeId);
  },

  /**
   * One content type belongs to at most one workflow.
   *
   * Two workflows claiming the same content type would each believe they own its
   * gate, and which one answered would come down to row order.
   */
  async assertContentTypesUnclaimed(uids: string[], excludeId?: number): Promise<void> {
    if (uids.length === 0) return;

    const others = (await this.findAll()).filter((candidate) => candidate.id !== excludeId);

    for (const uid of uids) {
      const owner = others.find((candidate) => (candidate.contentTypes ?? []).includes(uid));
      if (owner) {
        throw new ValidationError(
          `${uid} is already assigned to the workflow "${owner.name}". A content type can belong to only one workflow.`
        );
      }
    }
  },

  async create(input: WorkflowInput): Promise<Workflow> {
    await this.validate(input);

    const created = (await strapi.db.query(WORKFLOW_UID).create({
      data: {
        name: input.name,
        contentTypes: input.contentTypes ?? [],
        enforcePublishGate: input.enforcePublishGate ?? true,
        onMissingAssignment: input.onMissingAssignment ?? 'firstStage',
      },
    })) as Workflow;

    for (const stage of input.stages) {
      await strapi.db.query(STAGE_UID).create({
        data: {
          name: stage.name,
          color: stage.color ?? '#4945FF',
          order: stage.order,
          isTerminal: stage.isTerminal ?? false,
          rolesCanMoveFrom: stage.rolesCanMoveFrom ?? [],
          rolesCanMoveTo: stage.rolesCanMoveTo ?? [],
          workflow: created.id,
        },
      });
    }

    return (await this.findOne(created.id)) as Workflow;
  },

  async update(id: number, input: WorkflowInput): Promise<Workflow> {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundError(`No workflow with id ${id}`);

    await this.validate(input, { excludeId: id });

    await strapi.db.query(WORKFLOW_UID).update({
      where: { id },
      data: {
        name: input.name,
        contentTypes: input.contentTypes ?? [],
        enforcePublishGate: input.enforcePublishGate ?? true,
        onMissingAssignment: input.onMissingAssignment ?? 'firstStage',
      },
    });

    const keptIds = new Set(input.stages.map((stage) => stage.id).filter(Boolean) as number[]);
    const removed = existing.stages.filter((stage) => !keptIds.has(stage.id));

    for (const stage of input.stages) {
      const data = {
        name: stage.name,
        color: stage.color ?? '#4945FF',
        order: stage.order,
        isTerminal: stage.isTerminal ?? false,
        rolesCanMoveFrom: stage.rolesCanMoveFrom ?? [],
        rolesCanMoveTo: stage.rolesCanMoveTo ?? [],
        workflow: id,
      };

      if (stage.id && existing.stages.some((known) => known.id === stage.id)) {
        await strapi.db.query(STAGE_UID).update({ where: { id: stage.id }, data });
      } else {
        await strapi.db.query(STAGE_UID).create({ data });
      }
    }

    // Reload before moving assignments, so "first stage" means the new first.
    const reloaded = (await this.findOne(id)) as Workflow;
    for (const stage of removed) {
      await this.deleteStage(stage.id, reloaded);
    }

    return (await this.findOne(id)) as Workflow;
  },

  /**
   * Removing a stage moves anything sitting in it to the first stage, which is
   * what the Enterprise feature does and the only answer that cannot lose a
   * document: leaving assignments pointing at a stage that no longer exists would
   * make them unreadable, and deleting them would silently un-gate their
   * documents.
   */
  async deleteStage(stageId: number, wf: Workflow): Promise<void> {
    const remaining = wf.stages.filter((stage) => stage.id !== stageId);
    if (remaining.length === 0) {
      throw new ValidationError('A workflow must keep at least one stage');
    }

    const [first] = [...remaining].sort(byOrder);

    await strapi.db.query(ASSIGNMENT_UID).updateMany({
      where: { stageId },
      data: { stageId: first.id },
    });

    await strapi.db.query(STAGE_UID).delete({ where: { id: stageId } });
  },

  async delete(id: number): Promise<void> {
    const all = await this.findAll();
    if (all.length <= 1) {
      throw new ValidationError(
        'This is the last workflow. Deleting it would leave content types gated by nothing; remove their content types from it instead.'
      );
    }

    const target = all.find((candidate) => candidate.id === id);
    if (!target) throw new NotFoundError(`No workflow with id ${id}`);

    for (const stage of target.stages) {
      await strapi.db.query(ASSIGNMENT_UID).deleteMany({ where: { stageId: stage.id } });
    }
    await strapi.db.query(STAGE_UID).deleteMany({ where: { workflow: id } });
    await strapi.db.query(WORKFLOW_UID).delete({ where: { id } });
  },
});

export default workflow;
