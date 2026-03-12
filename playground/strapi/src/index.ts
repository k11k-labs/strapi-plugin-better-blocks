import * as fs from 'fs';
import * as path from 'path';
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
      // Upload the seed SVG image to Media Library
      const svgPath = path.resolve(process.cwd(), 'src', 'better-blocks.svg');
      let uploadedImage: Record<string, unknown> | null = null;

      if (fs.existsSync(svgPath)) {
        const stats = fs.statSync(svgPath);
        const uploadService = strapi.plugin('upload').service('upload');

        const fileStat = {
          filepath: svgPath,
          originalFilename: 'better-blocks.svg',
          mimetype: 'image/svg+xml',
          size: stats.size,
        };

        const [uploaded] = await uploadService.upload({
          data: {
            fileInfo: {
              name: 'better-blocks.svg',
              alternativeText: 'Better Blocks logo',
              caption: 'Better Blocks plugin banner',
            },
          },
          files: fileStat,
        });

        uploadedImage = uploaded;
        strapi.log.info('Uploaded seed image: better-blocks.svg');
      }

      // Build article data, replacing placeholder image with uploaded one
      const articleData = JSON.parse(JSON.stringify(seedArticle));
      if (uploadedImage) {
        const imageBlock = articleData.content.find(
          (block: any) => block.type === 'image'
        );
        if (imageBlock) {
          imageBlock.image = {
            name: uploadedImage.name,
            alternativeText:
              uploadedImage.alternativeText || 'Better Blocks logo',
            url: uploadedImage.url,
            width: uploadedImage.width || 600,
            height: uploadedImage.height || 200,
            formats: uploadedImage.formats || {},
            hash: uploadedImage.hash,
            ext: uploadedImage.ext,
            mime: uploadedImage.mime,
            size: uploadedImage.size,
          };
        }
      }

      const article = await strapi.documents('api::article.article').create({
        data: articleData as any,
      });

      await strapi.documents('api::article.article').publish({
        documentId: article.documentId,
      });

      strapi.log.info('Created and published seed showcase article');
    }
  },
};
