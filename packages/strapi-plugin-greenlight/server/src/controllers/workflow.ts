import type { Core } from '@strapi/strapi';

import { PLUGIN_ID } from '../uids';

const service = (strapi: Core.Strapi) => strapi.plugin(PLUGIN_ID).service('workflow');

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    ctx.body = { workflows: await service(strapi).findAll() };
  },

  async findOne(ctx: any) {
    const workflow = await service(strapi).findOne(Number(ctx.params.id));
    if (!workflow) return ctx.notFound();
    ctx.body = { workflow };
  },

  async create(ctx: any) {
    ctx.body = { workflow: await service(strapi).create(ctx.request.body) };
  },

  async update(ctx: any) {
    ctx.body = {
      workflow: await service(strapi).update(Number(ctx.params.id), ctx.request.body),
    };
  },

  async delete(ctx: any) {
    await service(strapi).delete(Number(ctx.params.id));
    ctx.body = { ok: true };
  },

  /**
   * Content types that could be put under review, for the settings page.
   *
   * Filtered to api:: collections with Draft & Publish, because those are the
   * only ones a gate means anything for - see workflow.validate.
   */
  async eligibleContentTypes(ctx: any) {
    const eligible = Object.values(strapi.contentTypes)
      .filter((model: any) => String(model.uid).startsWith('api::'))
      .filter((model: any) => model.options?.draftAndPublish === true)
      .map((model: any) => ({
        uid: model.uid,
        displayName: model.info?.displayName ?? model.uid,
      }));

    ctx.body = { contentTypes: eligible };
  },

  /** Admin users, so a reviewer can be picked. */
  async reviewers(ctx: any) {
    const users = await strapi.db.query('admin::user').findMany({
      where: { isActive: true },
      select: ['id', 'firstname', 'lastname', 'email'],
    });

    ctx.body = {
      reviewers: users.map((user: any) => ({
        id: user.id,
        name:
          [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email || `#${user.id}`,
      })),
    };
  },

  async roles(ctx: any) {
    const roles = await strapi.db.query('admin::role').findMany({ select: ['id', 'name', 'code'] });
    ctx.body = { roles };
  },
});

export default controller;
