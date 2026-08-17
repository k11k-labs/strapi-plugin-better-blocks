import path from 'node:path';
import fse from 'fs-extra';

import type { TestStrapiOptions } from './types.js';

/**
 * Strapi loads an app from a directory of plain files. In a real project those
 * are TypeScript and get compiled to `dist/` first; here they are written as
 * CommonJS so `appDir` and `distDir` can be the same directory and no build
 * step is needed.
 */
export async function writeFixtureApp(
  appDir: string,
  dbFile: string,
  options: TestStrapiOptions
): Promise<void> {
  const {
    contentTypes = {},
    components = {},
    plugins = {},
    serverConfig = {},
  } = options;

  await fse.ensureDir(appDir);

  // Read by Strapi's configuration loader before anything else.
  await fse.writeJson(
    path.join(appDir, 'package.json'),
    { name: 'strapi-test-app', version: '0.0.0', private: true },
    { spaces: 2 }
  );

  const configDir = path.join(appDir, 'config');
  await fse.ensureDir(configDir);

  await writeModule(
    path.join(configDir, 'server.js'),
    // The instance never listens - `load()` stops short of binding a port - so
    // host/port are only here to satisfy config validation.
    `module.exports = () => (${JSON.stringify(
      {
        host: '127.0.0.1',
        port: 1337,
        app: { keys: ['test-key-a', 'test-key-b'] },
        // The update notifier fires an un-awaited request to the npm registry.
        // Left on, it resolves after the test worker has gone and surfaces as an
        // unhandled "Channel closed" rejection that fails an otherwise green run.
        logger: { updates: { enabled: false } },
        ...serverConfig,
      },
      null,
      2
    )});`
  );

  await writeModule(
    path.join(configDir, 'admin.js'),
    `module.exports = () => (${JSON.stringify(
      {
        auth: { secret: 'test-admin-auth-secret' },
        apiToken: { salt: 'test-api-token-salt' },
        transfer: { token: { salt: 'test-transfer-token-salt' } },
        secrets: { encryptionKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        flags: { nps: false, promoteEE: false },
      },
      null,
      2
    )});`
  );

  await writeModule(
    path.join(configDir, 'database.js'),
    `module.exports = () => ({
  connection: {
    client: 'sqlite',
    connection: { filename: ${JSON.stringify(dbFile)} },
    useNullAsDefault: true,
    acquireConnectionTimeout: 60000,
  },
});`
  );

  // Strapi validates that the security/cors/public/favicon middlewares are all
  // present and refuses to bootstrap otherwise, so this is the stock list even
  // though the harness never serves a request.
  await writeModule(
    path.join(configDir, 'middlewares.js'),
    `module.exports = ${JSON.stringify(
      [
        'strapi::errors',
        'strapi::security',
        'strapi::cors',
        'strapi::poweredBy',
        'strapi::query',
        'strapi::body',
        'strapi::session',
        'strapi::favicon',
        'strapi::public',
      ],
      null,
      2
    )};`
  );

  await writeModule(
    path.join(configDir, 'plugins.js'),
    `module.exports = () => (${JSON.stringify(plugins, null, 2)});`
  );

  // The local upload provider checks for this at register time and refuses to
  // load without it, even when no test ever uploads anything.
  await fse.ensureDir(path.join(appDir, 'public', 'uploads'));

  const srcDir = path.join(appDir, 'src');
  await fse.ensureDir(srcDir);
  await writeModule(
    path.join(srcDir, 'index.js'),
    `module.exports = { register() {}, bootstrap() {} };`
  );

  for (const [apiName, schema] of Object.entries(contentTypes)) {
    const dir = path.join(
      srcDir,
      'api',
      apiName,
      'content-types',
      schema.info.singularName
    );
    await fse.ensureDir(dir);
    await fse.writeJson(
      path.join(dir, 'schema.json'),
      { kind: 'collectionType', ...schema },
      { spaces: 2 }
    );
  }

  for (const [key, schema] of Object.entries(components)) {
    const [category, name] = key.split('.');
    if (!category || !name) {
      throw new Error(
        `Component key must be "category.name", received "${key}". Strapi derives the component uid from the directory layout, so the category cannot be omitted.`
      );
    }
    const dir = path.join(srcDir, 'components', category);
    await fse.ensureDir(dir);
    await fse.writeJson(
      path.join(dir, `${name}.json`),
      {
        // Strapi refuses to boot on a component without one (loaders/components.js
        // calls stopWithError). The Content-Type Builder generates this name; the
        // harness does the same so fixtures stay terse.
        collectionName: `components_${category}_${name.replace(/-/g, '_')}s`,
        ...schema,
      },
      { spaces: 2 }
    );
  }
}

async function writeModule(file: string, contents: string): Promise<void> {
  await fse.writeFile(file, `${contents}\n`, 'utf8');
}
