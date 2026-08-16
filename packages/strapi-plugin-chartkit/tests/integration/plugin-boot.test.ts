import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

/**
 * The server side of Chartkit is a single `customFields.register` call, so there
 * is exactly one thing worth asserting against a real boot — and it happens to
 * be the thing that cannot be walked back.
 *
 * Strapi loads a plugin through its `./strapi-server` export, which points at
 * `dist/`, so the `test` target declares a dependency on `build` in
 * package.json. Without it Strapi boots with the plugin silently absent.
 */

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let app: TestStrapiInstance;

beforeAll(async () => {
  app = await createTestStrapi({
    plugins: {
      chartkit: { enabled: true, resolve: PLUGIN_ROOT },
    },
    contentTypes: {
      report: {
        info: { singularName: 'report', pluralName: 'reports', displayName: 'Report' },
        attributes: {
          chart: {
            type: 'customField',
            customField: 'plugin::chartkit.chart',
          },
        },
      },
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

describe('chart custom field', () => {
  it('registers under the uid stored in every customer document', () => {
    // `plugin::chartkit.chart` is written into the schema of every field using
    // this plugin. Renaming it detaches existing content from its field, so
    // this assertion exists to make that change impossible to do by accident.
    const field = app.strapi.get('custom-fields').get('plugin::chartkit.chart');

    expect(field).toBeDefined();
    expect(field.type).toBe('json');
  });

  it('lets a content type declare the field and store a ChartSpec', async () => {
    // Proves the registration is usable end to end: Strapi accepts the schema,
    // and a spec round-trips through the json column unchanged.
    const spec = {
      type: 'bar',
      series: [{ name: 'Revenue', data: [1, 2, 3] }],
      labels: ['Jan', 'Feb', 'Mar'],
    };

    const created = await app.strapi.documents('api::report.report').create({
      data: { chart: spec },
    });

    const found = await app.strapi.documents('api::report.report').findOne({
      documentId: created.documentId,
    });

    expect(found.chart).toEqual(spec);
  });
});
