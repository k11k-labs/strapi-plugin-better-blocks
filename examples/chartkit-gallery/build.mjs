/**
 * Renders every fixture to one HTML page.
 *
 * This exists because a chart cannot be reviewed in a diff. Unit tests pin the
 * geometry and snapshots catch changes to it, but neither can tell you that the
 * axis labels overlap, that the legend runs off the edge, or that a chart is
 * simply ugly. Those are the failures that actually matter, and the only way to
 * find them is to look.
 *
 * The page is a static file: the charts are SVG strings produced here, so there
 * is nothing to hydrate and nothing to serve dynamically. That is also a
 * demonstration of the point - this is what a Chartkit chart costs a page.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderChart } from '@qkix/chartkit-core';
import { fixtures } from '@qkix/chartkit-core/fixtures';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * One fixture as a card: the chart, what it is meant to break, and its spec.
 *
 * The "breaks" line is shown rather than kept in the source, so whoever is
 * looking knows what they are supposed to be checking for in each one.
 */
function card(fixture) {
  const result = renderChart(fixture.spec, {
    locale: 'en-US',
    idPrefix: `fx-${fixture.id}`,
  });

  const body = result.ok
    ? result.svg
    : `<pre class="issues">${escapeHtml(
        result.issues
          .map((issue) => `${issue.path || '(root)'}: ${issue.message}`)
          .join('\n')
      )}</pre>`;

  return `
    <section class="card">
      <header>
        <h2>${escapeHtml(fixture.id)}</h2>
        <p class="breaks">${escapeHtml(fixture.breaks)}</p>
      </header>
      <div class="chart">${body}</div>
      <details>
        <summary>spec</summary>
        <pre>${escapeHtml(JSON.stringify(fixture.spec, null, 2))}</pre>
      </details>
    </section>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Chartkit gallery</title>
    <style>
      /* The palette is defined here, on the page, rather than in the chart -
         which is the whole argument for rendering our own SVG. Switching the
         theme below reaches inside every chart without re-rendering any of
         them. */
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --fg: #1a1a1a;
        --muted: #666680;
        --card: #f6f6f9;
        --border: #dcdce4;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #14141f;
          --fg: #eaeaf0;
          --muted: #9a9ab0;
          --card: #1c1c2a;
          --border: #32324a;
        }
      }

      body {
        margin: 0;
        padding: 2rem;
        background: var(--bg);
        color: var(--fg);
        font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
      .lede { color: var(--muted); margin: 0 0 2rem; max-width: 60ch; }

      .grid {
        display: grid;
        gap: 1.5rem;
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      }
      .card {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--card);
        padding: 1rem;
        min-width: 0;
      }
      .card h2 { font-size: 0.95rem; margin: 0; font-family: ui-monospace, monospace; }
      .breaks { color: var(--muted); font-size: 0.8rem; margin: 0.25rem 0 0.75rem; }
      .chart { background: var(--bg); border-radius: 6px; padding: 0.5rem; }
      .chart svg { display: block; width: 100%; height: auto; }

      details { margin-top: 0.75rem; }
      summary { cursor: pointer; color: var(--muted); font-size: 0.8rem; }
      pre {
        overflow-x: auto;
        font-size: 0.75rem;
        background: var(--bg);
        padding: 0.5rem;
        border-radius: 6px;
      }
      .issues { color: #c0392b; }
    </style>
  </head>
  <body>
    <h1>Chartkit gallery</h1>
    <p class="lede">
      Every fixture, rendered by <code>@qkix/chartkit-core</code>. Each is chosen to break
      something specific - the note under each title says what to look for. Nothing on this
      page runs JavaScript; every chart is an SVG string produced at build time.
    </p>
    <div class="grid">${fixtures.map(card).join('')}</div>
  </body>
</html>
`;

const out = join(here, 'dist');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), page);

console.log(`Wrote ${join(out, 'index.html')} - ${fixtures.length} fixtures`);
