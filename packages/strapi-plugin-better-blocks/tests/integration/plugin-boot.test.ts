import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

/**
 * What can only be checked against a booted Strapi: the custom-field identifier
 * customers' content is bound to, how plugin config actually resolves, and that
 * the admin endpoint does not hand tokens to the browser.
 */

const PLUGIN_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

let app: TestStrapiInstance;

beforeAll(async () => {
  app = await createTestStrapi({
    plugins: {
      'better-blocks': { enabled: true, resolve: PLUGIN_ROOT },
    },
  });
}, 120_000);

afterAll(async () => {
  await app?.destroy();
});

describe('custom field registration', () => {
  it('registers under the uid stored in every customer document', () => {
    // `plugin::better-blocks.better-blocks` is written into the schema of every
    // field using this plugin. Changing it silently detaches existing content
    // from its field, so this assertion is a lock, not a description.
    const field = app.strapi
      .get('custom-fields')
      .get('plugin::better-blocks.better-blocks');

    expect(field).toBeDefined();
    expect(field.type).toBe('json');
  });
});

describe('plugin config resolution', () => {
  it('serves the defaults from config/index.ts', () => {
    const details = app.strapi.plugin('better-blocks').config('details');

    expect(details).toEqual({
      defaultSummary: 'Click to expand',
      style: 'github',
    });
  });

  it('exposes the social defaults with no tokens set', () => {
    const social = app.strapi.plugin('better-blocks').config('social');

    expect(social.enabled).toBe(true);
    expect(social.platforms).toContain('twitter');
    expect(social.cacheTTL).toBe(86400);
    expect(social.instagram.accessToken).toBeUndefined();
  });
});

describe('GET /better-blocks/config', () => {
  /** Invokes the controller the way the route does, with a minimal ctx. */
  const getConfig = () => {
    const ctx: { body?: any } = {};
    app.strapi.plugin('better-blocks').controller('controller').getConfig(ctx);
    return ctx.body;
  };

  it('reports whether tokens are configured without revealing them', () => {
    const body = getConfig();

    expect(body.social.instagramConfigured).toBe(false);
    expect(body.social.facebookConfigured).toBe(false);
  });

  it('never serialises an access token into the response', () => {
    // The guard that matters. The controller builds the social payload field by
    // field precisely so a token cannot ride along; a future `...social` spread
    // would ship a Facebook token to every admin browser, and this is what
    // catches it.
    const body = getConfig();

    expect(body.social).not.toHaveProperty('instagram');
    expect(body.social).not.toHaveProperty('facebook');
    expect(JSON.stringify(body)).not.toContain('accessToken');
  });

  it('serves the same defaults the plugin config declares', () => {
    // The controller passes its own inline fallbacks to `.config()`. They
    // duplicate config/index.ts, so this pins the two together — if they drift,
    // the admin panel and the server stop agreeing about what a default is.
    const body = getConfig();

    expect(body.details).toEqual(
      app.strapi.plugin('better-blocks').config('details')
    );
    expect(body.button).toEqual(
      app.strapi.plugin('better-blocks').config('button')
    );
  });
});

describe('admin routes', () => {
  it('keeps the oEmbed proxy behind admin authentication', () => {
    // The endpoint makes server-side requests on behalf of the caller. Losing
    // this policy would expose that to anyone who can reach the admin API.
    const routes = app.strapi.plugin('better-blocks').routes;
    const admin = routes.admin?.routes ?? routes.admin ?? [];
    const oembed = admin.find((route: any) => route.path === '/oembed');

    expect(oembed).toBeDefined();
    expect(oembed.config.policies).toContain('admin::isAuthenticatedAdmin');
  });
});
