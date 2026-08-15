import * as fs from 'fs';
import * as path from 'path';
import type { Core } from '@strapi/strapi';

import astroShowcase from './seeds/astro-showcase.json';
import pluginShowcase from './seeds/plugin-showcase.json';
import reactShowcase from './seeds/react-showcase.json';

/**
 * One Strapi instance backs every example app in this repo, so it seeds all
 * three showcase documents that used to live in the separate playgrounds. The
 * React and Astro apps render whatever is published here, which is the point:
 * the same content, side by side, through two different renderers.
 */
const SEEDS = [
  {
    title: 'Plugin showcase',
    content: pluginShowcase,
  },
  {
    title: 'React renderer showcase',
    content: reactShowcase,
  },
  {
    title: 'Astro renderer showcase',
    content: astroShowcase,
  },
];

type Asset = Record<string, unknown> | null;

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

    // Enable public access to Article find & findOne so the renderer example
    // apps can read the content without a token.
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

    const articleCount = await strapi.db.query('api::article.article').count();
    if (articleCount > 0) return;

    const uploadService = strapi.plugin('upload').service('upload');

    // Upload a single asset from src/ to the Media Library and return it.
    const uploadAsset = async (
      filename: string,
      mimetype: string,
      fileInfo: Record<string, unknown>
    ): Promise<Asset> => {
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

    const image = await uploadAsset('better-blocks.svg', 'image/svg+xml', {
      name: 'better-blocks.svg',
      alternativeText: 'Better Blocks logo',
      caption: 'Better Blocks plugin banner',
    });
    const audio = await uploadAsset('sample-audio.mp3', 'audio/mpeg', {
      name: 'sample-audio.mp3',
      alternativeText: 'Better Blocks sample tune',
      caption: 'A short arpeggio bundled with the examples',
    });
    const pdf = await uploadAsset('sample.pdf', 'application/pdf', {
      name: 'sample.pdf',
      caption: 'Sample PDF for the download/preview button',
    });
    const docx = await uploadAsset(
      'sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      { name: 'sample.docx', caption: 'Sample DOCX for the download button' }
    );

    // Seeds ship placeholder media; swap in the assets we just uploaded so
    // every block points at a real file.
    const assetsByExt: Record<string, Asset> = {
      '.pdf': pdf,
      '.docx': docx,
      '.svg': image,
    };

    const hydrate = (blocks: any[]) => {
      for (const block of blocks) {
        if (block.type === 'image' && image) {
          block.image = {
            name: image.name,
            alternativeText: image.alternativeText || 'Better Blocks logo',
            url: image.url,
            width: image.width || 600,
            height: image.height || 200,
            formats: image.formats || {},
            hash: image.hash,
            ext: image.ext,
            mime: image.mime,
            size: image.size,
          };
        }

        if (block.type === 'audio' && audio) {
          block.file = {
            id: audio.id,
            url: audio.url,
            name: audio.name,
            ext: audio.ext,
            hash: audio.hash,
            mime: audio.mime,
            // Strapi stores media size in KB; the block schema uses bytes.
            size:
              typeof audio.size === 'number'
                ? Math.round(audio.size * 1024)
                : undefined,
            provider: audio.provider,
          };
        }

        if (block.type === 'button' && block.buttonType === 'file' && block.file) {
          const asset = assetsByExt[block.file.ext as string];
          if (asset) {
            block.file = {
              id: asset.id,
              url: asset.url,
              name: asset.name,
              ext: asset.ext,
              hash: asset.hash,
              mime: asset.mime,
              size:
                typeof asset.size === 'number'
                  ? Math.round(asset.size * 1024)
                  : undefined,
              provider: asset.provider,
            };
          }
        }
      }
    };

    for (const seed of SEEDS) {
      const data = JSON.parse(JSON.stringify(seed.content));
      hydrate(data.content as any[]);

      const article = await strapi.documents('api::article.article').create({
        data: { title: seed.title, content: data.content } as any,
      });

      await strapi.documents('api::article.article').publish({
        documentId: article.documentId,
      });

      strapi.log.info(`Created and published seed article: ${seed.title}`);
    }
  },
};
