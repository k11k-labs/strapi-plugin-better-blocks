# @qkix/strapi-plugin-chartkit

Charts for Strapi v5, as a custom field. The chart is rendered to **SVG on the
server**, so a page carrying twenty of them ships no charting library and runs
no JavaScript to draw them.

```sh
npm install @qkix/strapi-plugin-chartkit
```

Add a **Chart** field to a content type, and the edit view gives the author a
data grid, spreadsheet paste, and a live preview.

## What it stores

A `ChartSpec` — the same object the renderers take. There is nothing in between
the field and the page:

```tsx
import { Chart } from '@qkix/chartkit-react-renderer';

const article = await fetch('/api/articles/1').then((r) => r.json());

<Chart spec={article.data.chart} locale="en-US" />;
```

Astro is the same shape:

```astro
---
import { Chart } from '@qkix/chartkit-astro-renderer';
---

<Chart spec={article.chart} locale="en-US" />
```

Both render to markup at build or request time. Neither sends a runtime.

## Styling

The chart carries no colors of its own. Series are drawn as
`fill="var(--chart-series-N, currentColor)"` and text inherits the page's font,
so a chart takes the theme of wherever it lands — including class-based dark
mode, which is the reason for hand-written SVG rather than an off-the-shelf SSR
renderer that bakes hex values into the markup.

```css
:root {
  --chart-series-1: #4945ff;
  --chart-series-2: #66b7f1;
  --chart-axis: #8e8ea9;
  --chart-text: #32324a;
  --chart-grid: #eaeaef;
}
```

The admin preview is deliberately drawn on white with dark text regardless of
the admin's theme, because it is showing what the chart will look like on a page
this plugin knows nothing about.

## Field options

| Option                       | Effect                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Number formatting locale** | How axis numbers are formatted **in the admin preview** — a BCP 47 tag such as `de-DE`. The front end passes its own at render. |
| **Required**                 | Standard Strapi validation.                                                                                                     |

## Three ways to get data in

The grid is there to type into, but most charts already exist as numbers
somewhere:

- **Paste from a spreadsheet** — copy a range out of Sheets or Excel and paste.
  Tab, comma and semicolon are all detected; `1.234,5` and `1,234.5` both read
  as 1234.5; `n/a` and blanks become **gaps, not zeroes**.
- **From the Media Library** — pick a `.csv`, `.tsv` or `.txt` already uploaded.
- **By hand** — add categories and series in the grid.

Paste and import both show **what was parsed before replacing anything**. The
parser has to guess whether the first row is a header, and a wrong guess that
silently overwrites an author's data is far worse than one they can cancel.

## The editor opens in a dialog

Rather than sitting inline. The editing surface is a preview plus a grid plus a
row of settings — most of a screen, given to a field the author is usually
scrolling past on their way to the rest of the form. Clicking the preview or
**Edit chart** opens it; **Cancel** genuinely cancels, because the dialog edits a
draft and only writes on save.

A field nobody has filled in shows an empty state rather than writing a starter
chart into the document. Opening an entry must not be enough to mark it dirty.

## Old charts, and charts that are not charts

The field **migrates a spec on the way in**, so an author who opens a chart saved
against an older schema edits and saves the current shape. Pages stay correct in
the meantime on their own: `renderChart` migrates in memory too, so nothing has
to be resaved for a site to keep working.

If the field holds something that is not a readable chart — a value written by an
import script, or a field that used to be a different type — it says so and goes
**read-only**. Showing the usual "create a chart" prompt over data that exists
would be an offer to overwrite it.

## Also available as a block

Chartkit is two surfaces over one editor. If you use
[Better Blocks](https://www.npmjs.com/package/@qkix/strapi-plugin-better-blocks),
charts can live inside a rich-text document as a block instead of, or as well
as, in a field of their own — see `@qkix/chartkit-core`'s `chartBlock` and the
`registerBlock` API.

## Packages

| Package                                                                                        | For                                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [`@qkix/strapi-plugin-chartkit`](https://www.npmjs.com/package/@qkix/strapi-plugin-chartkit)   | this plugin — the field in the Strapi admin  |
| [`@qkix/chartkit-core`](https://www.npmjs.com/package/@qkix/chartkit-core)                     | the spec, the validator and the SVG renderer |
| [`@qkix/chartkit-react-renderer`](https://www.npmjs.com/package/@qkix/chartkit-react-renderer) | rendering a stored chart in React / Next.js  |
| [`@qkix/chartkit-astro-renderer`](https://www.npmjs.com/package/@qkix/chartkit-astro-renderer) | rendering a stored chart in Astro            |
| [`@qkix/chartkit-editor`](https://www.npmjs.com/package/@qkix/chartkit-editor)                 | the editing surface, if you are embedding it |

## License

MIT
