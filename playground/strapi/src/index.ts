import type { Core } from '@strapi/strapi';
import seedArticle from './seed-article.json';

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Create default admin user if none exists
    const adminCount = await strapi.db.query('admin::user').count();

    if (adminCount === 0) {
      const superAdminRole = await strapi.db
        .query('admin::role')
        .findOne({ where: { code: 'strapi-super-admin' } });

      if (superAdminRole) {
        const hashedPassword = await strapi
          .service('admin::auth')
          .hashPassword('admin12#');
        await strapi.db.query('admin::user').create({
          data: {
            username: 'admin',
            email: 'admin@example.com',
            firstname: 'Admin',
            lastname: 'User',
            password: hashedPassword,
            isActive: true,
            blocked: false,
            registrationToken: null,
            roles: [superAdminRole.id],
          },
        });
        strapi.log.info(
          'Created default admin user (admin@example.com / admin12#)'
        );
      }
    }

    // Enable public access to Article find & findOne
    const publicRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (publicRole) {
      const existing = await strapi.db
        .query('plugin::users-permissions.permission')
        .findMany({
          where: {
            role: publicRole.id,
            action: { $startsWith: 'api::article' },
          },
        });

      if (existing.length === 0) {
        const actions = [
          'api::article.article.find',
          'api::article.article.findOne',
        ];

        for (const action of actions) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              action,
              role: publicRole.id,
            },
          });
        }

        strapi.log.info('Enabled public access for Article find & findOne');
      }
    }

    // Seed showcase article if no articles exist
    const articleCount = await strapi.db.query('api::article.article').count();

    if (articleCount === 0) {
      const article = await strapi.documents('api::article.article').create({
        data: seedArticle as any,
      });

      await strapi.documents('api::article.article').publish({
        documentId: article.documentId,
      });

      strapi.log.info('Created and published seed showcase article');
    }
  },
};
