# @qkix/strapi-test-harness

Boots a **real** Strapi against a throwaway SQLite database so plugin server code
can be tested against the actual lifecycle.

Until now every test in this monorepo was a pure unit test of browser-side code.
That covers renderers and Slate transforms well, and covers nothing at all on the
server: document-service middleware, transaction commit hooks, schema sync and
lifecycle ordering are all behaviour of Strapi itself, and a mock of them only
asserts what we already believed.

## Usage

```ts
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestStrapi } from '@qkix/strapi-test-harness';
import type { TestStrapiInstance } from '@qkix/strapi-test-harness';

let app: TestStrapiInstance;

beforeAll(async () => {
  app = await createTestStrapi({
    contentTypes: {
      article: {
        info: {
          singularName: 'article',
          pluralName: 'articles',
          displayName: 'Article',
        },
        options: { draftAndPublish: true },
        pluginOptions: { i18n: { localized: true } },
        attributes: {
          title: {
            type: 'string',
            pluginOptions: { i18n: { localized: true } },
          },
          sections: {
            type: 'component',
            component: 'blocks.section',
            repeatable: true,
          },
        },
      },
    },
    components: {
      'blocks.section': {
        info: { displayName: 'Section' },
        attributes: { heading: { type: 'string' } },
      },
    },
    locales: [{ code: 'en' }, { code: 'pl' }],
    plugins: {
      'content-history': {
        enabled: true,
        resolve: '../../packages/strapi-plugin-content-history',
        config: { contentTypes: ['api::article.article'] },
      },
    },
  });
});

afterAll(() => app?.destroy());

it('writes through the document service', async () => {
  const created = await app.strapi.documents('api::article.article').create({
    data: { title: 'Hello' },
    locale: 'en',
  });
  expect(created.documentId).toBeTruthy();
});
```

### Vitest config

The options a Strapi-booting suite needs are exported as a preset, so consuming
packages do not rediscover them:

```ts
import { defineConfig } from 'vitest/config';
import { strapiTestOptions } from '@qkix/strapi-test-harness/vitest-preset';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    ...strapiTestOptions,
  },
});
```

It sets the pool and the timeouts only - `environment` and `include` stay yours.

### Options

| Option         | Purpose                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `contentTypes` | Keyed by API name - `{ article: schema }` yields `api::article.article`.    |
| `components`   | Keyed by `category.name`. `collectionName` is generated if omitted.         |
| `plugins`      | Keyed by Strapi plugin name. Workspace packages need an explicit `resolve`. |
| `locales`      | Created after bootstrap; the first is the default.                          |
| `onRegistered` | Runs between `register()` and `bootstrap()` - where `documents.use` goes.   |
| `keepAppDir`   | Leaves the generated app on disk and logs its path, for debugging.          |

Each instance gets its own temp directory and SQLite file, both removed by
`destroy()`.

## Things that will bite you

**Node 20 or 22 - same as the rest of the repo.** Nothing in the harness objects
to Node 24: `@strapi/strapi` allows up to 26 and `better-sqlite3` up to 25. The
ceiling comes from `@strapi/sdk-plugin`, which builds both plugins and declares
`node: >=18.0.0 <=22.x.x`, so the repo pins `engines: >=20 <23` and CI runs the
20/22 matrix.

What you will actually hit is a native binding compiled for a different Node than
the one you are running - `better-sqlite3` builds at install time, so switching
Node versions without reinstalling gives every boot
`NODE_MODULE_VERSION 127 … requires 137`. `nvm use 22` (or reinstall) fixes it.

**Keep the vitest preset in plain JavaScript.** Vite externalises bare imports
from a `vitest.config.ts`, so `src/vitest-preset.js` is handed to Node as-is.
Node 22 strips types and tolerates TypeScript there; Node 20 does not, and fails
with a bare `SyntaxError` naming the _consumer's_ config file rather than the
preset.

**Threads, not forks.** Strapi leaves sockets open after `destroy()`; in a forked
vitest worker that ends as an unhandled `Channel closed` rejection, failing a run
whose tests all passed. The config here sets `pool: 'threads'`.

**One instance per test file.** `createStrapi()` assigns `global.strapi`, so two
live instances in the same worker clobber each other.

**Boot is ~1.2s.** Fine per file, wasteful per test - boot in `beforeAll` and
reset data between tests with `truncate()`.

## What the tests here cover

They are not just a smoke test of the harness. `documents-middleware.test.ts` and
`publish-coalescing.test.ts` pin down the Strapi behaviour the content-history
plugin is designed around, so that if a Strapi upgrade changes it, a test fails
instead of a plugin silently recording the wrong history:

- which of the six document actions reach `documents.use`
- that the middleware `result` is **not** populated, so snapshots must re-query
- that the Content Manager's `update` is a **sibling** of `publish`, not nested
  inside it - which is why async-context suppression cannot work, and why
  de-duplication happens at the shared transaction
- that `discardDraft` is only observable after the draft is already gone
- that a rolled-back transaction leaves no version behind
- that a non-localized field propagates to every locale
