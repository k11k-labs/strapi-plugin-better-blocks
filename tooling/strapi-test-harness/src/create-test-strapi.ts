import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

import fse from 'fs-extra';

import { writeFixtureApp } from './write-app.js';
import type {
  TestStrapi,
  TestStrapiInstance,
  TestStrapiOptions,
} from './types.js';

/**
 * Loaded through `require`, not `import`, and deliberately so.
 *
 * `@strapi/core`'s ESM build does directory imports (`lodash/fp`) that Node
 * refuses to resolve natively, so importing `@strapi/strapi` from an ESM test
 * file blows up before Strapi gets a chance to boot. The CommonJS build has no
 * such problem. Keeping the workaround here means consumers do not have to
 * carry aliases or `deps.inline` entries in their own vitest configs.
 */
function loadStrapi(): {
  createStrapi: (options: Record<string, unknown>) => TestStrapi;
} {
  const require = createRequire(import.meta.url);
  return require('@strapi/strapi');
}

/**
 * Boots a real Strapi against a throwaway SQLite file.
 *
 * The point of doing it for real rather than mocking: everything worth testing
 * on the server side of a plugin — document-service middleware ordering,
 * transaction commit hooks, schema sync, lifecycle registration order — is
 * behaviour of Strapi itself. A mock would only assert what we already believe.
 *
 * `load()` runs register + bootstrap without binding a port, which is all a
 * server-side test needs and several seconds faster than `start()`.
 */
export async function createTestStrapi(
  options: TestStrapiOptions = {}
): Promise<TestStrapiInstance> {
  const appDir = await fse.mkdtemp(path.join(os.tmpdir(), 'strapi-test-'));
  const dbFile = path.join(appDir, 'test.db');

  await writeFixtureApp(appDir, dbFile, options);

  // Telemetry does un-awaited network calls that outlive a short test run.
  // (Update notifications are switched off through server config instead —
  // STRAPI_DISABLE_UPDATE_NOTIFICATION is deprecated and only logs a warning.)
  const previousEnv = { ...process.env };
  process.env.STRAPI_TELEMETRY_DISABLED = 'true';
  process.env.NODE_ENV = 'test';

  const { createStrapi } = loadStrapi();

  // createStrapi() attaches SIGTERM/SIGINT handlers per instance. Across a suite
  // that boots several, Node starts warning about a listener leak — so note what
  // was there before and drop only what this instance added.
  const signalsBefore = {
    SIGTERM: process.listeners('SIGTERM'),
    SIGINT: process.listeners('SIGINT'),
  };

  const strapi = createStrapi({
    appDir,
    distDir: appDir,
    autoReload: false,
    serveAdminPanel: false,
  }) as unknown as TestStrapi;

  /**
   * Strapi reports fatal boot errors by logging and calling `process.exit(1)`,
   * which in a test run kills the worker and reports nothing useful. Turning it
   * into a thrown error means a bad fixture surfaces as a normal test failure
   * with Strapi's own message attached.
   */
  strapi.stopWithError = (error: unknown, customMessage?: string) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Strapi failed to boot: ${customMessage ? `${customMessage} — ` : ''}${detail}`
    );
  };

  if (options.onRegistered) {
    await strapi.register();
    await options.onRegistered(strapi);
    await strapi.bootstrap();
  } else {
    await strapi.load();
  }

  await createLocales(strapi, options);

  let destroyed = false;
  const destroy = async () => {
    if (destroyed) return;
    destroyed = true;

    try {
      await strapi.destroy();
    } finally {
      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        for (const listener of process.listeners(signal)) {
          if (!signalsBefore[signal].includes(listener)) {
            process.off(signal, listener);
          }
        }
      }

      process.env = previousEnv;

      if (options.keepAppDir) {
        // eslint-disable-next-line no-console
        console.log(`[strapi-test-harness] kept app dir: ${appDir}`);
      } else {
        await fse.remove(appDir).catch(() => {
          // A held SQLite handle on Windows can block removal. Leaving a temp
          // directory behind is not worth failing a passing test over.
        });
      }
    }
  };

  return { strapi, appDir, dbFile, destroy };
}

async function createLocales(
  strapi: TestStrapi,
  options: TestStrapiOptions
): Promise<void> {
  const locales = options.locales ?? [];
  if (locales.length === 0) return;

  const service = strapi.plugin('i18n')?.service('locales');
  if (!service) {
    throw new Error(
      'Locales were requested but the i18n plugin is not loaded. It ships with Strapi and is enabled by default, so this usually means the fixture app failed to boot fully.'
    );
  }

  const existing = await service.find();
  const existingCodes = new Set(
    existing.map((locale: { code: string }) => locale.code)
  );

  for (const [index, locale] of locales.entries()) {
    const isDefault = locale.isDefault ?? index === 0;

    if (!existingCodes.has(locale.code)) {
      await service.create({
        code: locale.code,
        name: locale.name ?? locale.code,
      });
    }
    if (isDefault) {
      await service.setDefaultLocale({ code: locale.code });
    }
  }
}

/**
 * Removes every row from the given content types, leaving the schema in place.
 * Cheaper than rebooting between tests, and it keeps the assertion in the test
 * rather than in a global setup file.
 */
export async function truncate(
  strapi: TestStrapi,
  uids: string[]
): Promise<void> {
  for (const uid of uids) {
    await strapi.db.query(uid).deleteMany({});
  }
}

/** True when a SQLite file was actually created — a cheap boot smoke check. */
export function dbFileExists(dbFile: string): boolean {
  return fs.existsSync(dbFile);
}

export { randomUUID };
