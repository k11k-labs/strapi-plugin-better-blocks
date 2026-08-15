import path from 'path';
import fs from 'fs';
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
      const uploadService = strapi.plugin('upload').service('upload');

      // Upload a single asset from src/ to the Media Library and return it.
      const uploadAsset = async (
        filename: string,
        mimetype: string,
        fileInfo: Record<string, unknown>
      ): Promise<Record<string, unknown> | null> => {
        const filepath = path.resolve(process.cwd(), 'src', filename);
        if (!fs.existsSync(filepath)) return null;
        const stats = fs.statSync(filepath);
        const [uploaded] = await uploadService.upload({
          data: { fileInfo },
          files: {
            filepath,
            originalFilename: filename,
            mimetype,
            size: stats.size,
          },
        });
        strapi.log.info(`Uploaded seed asset: ${filename}`);
        return uploaded;
      };

      // Upload the seed SVG image to the Media Library
      const uploadedImage = await uploadAsset('better-blocks.svg', 'image/svg+xml', {
        name: 'better-blocks.svg',
        alternativeText: 'Better Blocks logo',
        caption: 'Better Blocks plugin banner',
      });

      // Upload the sample download/preview files (PDF + DOCX)
      const uploadedPdf = await uploadAsset('sample.pdf', 'application/pdf', {
        name: 'sample.pdf',
        caption: 'Sample PDF for the download/preview button',
      });
      const uploadedDocx = await uploadAsset(
        'sample.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        { name: 'sample.docx', caption: 'Sample DOCX for the download button' }
      );

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

      // Point each file button at its matching uploaded asset (by the
      // placeholder extension in the seed) so links, sizes, and icons resolve
      // to real files.
      const assetsByExt: Record<string, Record<string, unknown> | null> = {
        '.pdf': uploadedPdf,
        '.docx': uploadedDocx,
        '.svg': uploadedImage,
      };
      for (const block of articleData.content as any[]) {
        if (block.type !== 'button' || block.buttonType !== 'file' || !block.file) continue;
        const asset = assetsByExt[block.file.ext as string];
        if (!asset) continue;
        block.file = {
          id: asset.id,
          url: asset.url,
          name: asset.name || block.file.name,
          // Strapi reports size in KB; convert to bytes for the renderer.
          size: asset.size ? Math.round(Number(asset.size) * 1024) : 0,
          ext: asset.ext || block.file.ext,
          mime: asset.mime || block.file.mime,
        };
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
