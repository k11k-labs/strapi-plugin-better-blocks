<p align="center">
  <img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-chartkit/docs/logo.png" alt="Chartkit" width="120" />
</p>

<h1 align="center">Chartkit for Strapi</h1>

<p align="center">Charts for Strapi v5, rendered as server-side SVG. Your pages ship <strong>zero client-side JavaScript</strong> to draw them.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qkix/strapi-plugin-chartkit">
    <img alt="npm version" src="https://img.shields.io/npm/v/@qkix/strapi-plugin-chartkit.svg" />
  </a>
  <a href="https://www.npmjs.com/package/@qkix/strapi-plugin-chartkit">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/@qkix/strapi-plugin-chartkit.svg" />
  </a>
  <a href="https://github.com/qkix/strapi-plugins/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@qkix/strapi-plugin-chartkit.svg" />
  </a>
  <a href="https://buymeacoffee.com/qkix">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-chartkit/docs/field.png" alt="A chart in the Strapi edit view" width="720" />
</p>

```sh
npm install @qkix/strapi-plugin-chartkit
```

Add a **Chart** field to a content type. That's it - no config file, no provider.

## Why server-side SVG

Most chart plugins hand the browser a charting library and some JSON, and let it
draw. That means shipping and executing a charting runtime on every page that
has a chart, and leaving a hole in the layout until it runs.

Chartkit renders the SVG **when the page is built or requested**. The browser
receives finished markup:

- **No runtime.** Nothing to download, parse, or execute.
- **Nothing to hydrate**, so no layout shift and no flash of empty box.
- **It scales and prints** - it is vector, not a canvas bitmap.
- **Screen readers get a real description**: `role="img"` with a `<title>` and
  the description you wrote.

## Every chart type

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-chartkit/docs/chart-types.png" alt="Bar, grouped, stacked, line, area, pie, donut, gaps and negative values" width="900" />

Bar, grouped and stacked bars, line, area and stacked area, pie and donut.

Two of those tiles are the details that usually go wrong. A missing reading
stays a **gap** - never a zero pretending to be a measurement. And negative
values get a real baseline instead of being flipped or clipped.

## Editing

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-chartkit/docs/editor.png" alt="The chart editor: live preview, chart settings and a data grid" width="700" />

A live preview above a spreadsheet-style grid. **The preview is the real
renderer** - the same function that draws the published page - so a chart cannot
look right here and wrong there.

The editor opens in a dialog. Cancel genuinely cancels: it edits a draft and
only writes on save.

## Three ways to get the numbers in

Most charts already exist as numbers somewhere, and retyping them is the worst
part of every charting tool.

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-chartkit/docs/paste.png" alt="Pasting a semicolon-separated spreadsheet, with the parse summary shown before anything is replaced" width="700" />

**Paste from a spreadsheet.** Copy a range out of Sheets or Excel and paste it.

| Input                     | Read as                               |
| ------------------------- | ------------------------------------- |
| tab, comma or semicolon   | detected per paste                    |
| `1.234,50` and `1,234.50` | 1234.5 either way                     |
| `€1 234,50`               | 1234.5 - currency and spaces stripped |
| `"North, inland"`         | one cell; a quoted delimiter survives |
| `n/a`, `-`, empty         | a **gap**, never a zero               |

It shows **what it parsed before replacing anything** - above, four categories,
two series, and one unreadable cell called out. The parser has to guess whether
the first row is a header, and a wrong guess that silently overwrites your data
is far worse than one you can cancel.

**From the Media Library.** Pick a `.csv`, `.tsv` or `.txt` you already
uploaded. Anything else is refused before it is fetched - handing a PDF to a CSV
parser produces a confident table of nonsense.

**By hand**, in the grid.

## Rendering it

The field stores a `ChartSpec` - the same object the renderers take. Nothing
sits in between:

```tsx
import { Chart } from '@qkix/chartkit-react-renderer';

<Chart spec={article.chart} locale="en-US" />;
```

```astro
---
import { Chart } from '@qkix/chartkit-astro-renderer';
---

<Chart spec={article.chart} locale="en-US" />
```

```vue
<script setup>
import { Chart } from '@qkix/chartkit-vue-renderer';
</script>

<template>
  <Chart :spec="article.chart" locale="en-US" />
</template>
```

They all produce markup at build or request time. None ships a runtime.

## It takes your theme, including dark mode

The chart carries no colors of its own. Series are drawn as
`fill="var(--chart-series-N, currentColor)"` and text inherits the page font, so
a chart looks like it belongs wherever it lands:

```css
:root {
  --chart-series-1: #4945ff;
  --chart-series-2: #f0a500;
  --chart-axis: #8e8ea9;
  --chart-text: #32324a;
  --chart-grid: #eaeaef;
}

[data-theme='dark'] {
  --chart-text: #ffffff;
  --chart-grid: #32324a;
}
```

This is the reason the SVG is hand-written rather than produced by an existing
SSR chart renderer. The obvious candidate, ECharts in SSR mode, writes its
palette into the markup as literal hex values - which makes class-based dark
mode impossible without post-processing the output.

## Also a block, if you use Better Blocks

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-chartkit/docs/block.png" alt="A chart block inside a Better Blocks rich-text document" width="700" />

Charts can live inside a rich-text document instead of, or as well as, in a
field of their own. With
[Better Blocks](https://www.npmjs.com/package/@qkix/strapi-plugin-better-blocks)
installed, that is one line in `src/admin/app.tsx`:

```ts
import { registerBlock } from '@qkix/strapi-plugin-better-blocks/strapi-admin';
import { chartBlockDefinition } from '@qkix/chartkit-editor/block';

export default {
  register() {
    registerBlock(chartBlockDefinition({ locale: 'en-US' }));
  },
};
```

The front end needs its own half - `chartBlockPlugin` from whichever renderer
you use - or a chart authored in a document is stored correctly and drawn as
nothing.

## Field options

| Option                       | Effect                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Number formatting locale** | How axis numbers are formatted **in the admin preview** - a BCP 47 tag such as `de-DE`. The front end passes its own at render. |
| **Required**                 | Standard Strapi validation.                                                                                                     |

## Old charts stay working

The spec is versioned, and the field **migrates on read**, so opening a chart
saved against an older schema edits and saves the current shape. Nothing has to
be resaved for a site to keep working: `renderChart` migrates in memory too.

If a field holds something that is not a readable chart - a value from an import
script, or a field that used to be a different type - it says so and goes
**read-only** rather than offering to overwrite it.

## Packages

| Package                                                                                        | For                                                            |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`@qkix/strapi-plugin-chartkit`](https://www.npmjs.com/package/@qkix/strapi-plugin-chartkit)   | this plugin - the field in the Strapi admin                    |
| [`@qkix/chartkit-core`](https://www.npmjs.com/package/@qkix/chartkit-core)                     | the spec, the validator and the SVG renderer. No dependencies. |
| [`@qkix/chartkit-react-renderer`](https://www.npmjs.com/package/@qkix/chartkit-react-renderer) | rendering a stored chart in React / Next.js                    |
| [`@qkix/chartkit-astro-renderer`](https://www.npmjs.com/package/@qkix/chartkit-astro-renderer) | rendering a stored chart in Astro                              |
| [`@qkix/chartkit-vue-renderer`](https://www.npmjs.com/package/@qkix/chartkit-vue-renderer)     | rendering a stored chart in Vue / Nuxt                         |
| [`@qkix/chartkit-editor`](https://www.npmjs.com/package/@qkix/chartkit-editor)                 | the editing surface, and the ready-made block                  |

## Not there yet

Being honest about the edges: no time axes, no tooltips or other
interactivity, and no per-chart color overrides - palettes are set in your site's
CSS. Data is stored with the chart rather than queried from a collection.

Issues and ideas welcome at
[qkix/strapi-plugins](https://github.com/qkix/strapi-plugins/issues).

## Roadmap

What is worth building next, what is deliberately not planned, and why:
[ROADMAP.md](https://github.com/qkix/strapi-plugins/blob/main/packages/strapi-plugin-chartkit/ROADMAP.md).

## License

MIT
