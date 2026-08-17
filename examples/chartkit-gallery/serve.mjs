/**
 * Serves the built gallery.
 *
 * A plain file:// URL would do for a human, but a browser opening one cannot be
 * driven by tooling the way an http:// one can, and screenshotting the gallery
 * is how the charts get reviewed. So: the smallest possible static server, no
 * dependency.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4322);

createServer((_request, response) => {
  try {
    const html = readFileSync(join(here, 'dist', 'index.html'));
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not built yet - run `pnpm build` in this package first.');
  }
}).listen(port, () => {
  console.log(`Chartkit gallery on http://localhost:${port}`);
});
