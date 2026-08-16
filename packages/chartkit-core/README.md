# @qkix/chartkit-core

Charts as server-rendered SVG. A `ChartSpec` goes in, a finished SVG string
comes out — no DOM, no framework, and nothing for the browser to run.

> **Status: early.** The spec, the rendering pipeline and the bar chart — grouped
> and stacked — are in place. Line, area, pie and donut are not yet;
> `validateChartSpec` rejects them rather than drawing a blank box.

## What this is

```ts
import { renderChart } from '@qkix/chartkit-core';

const result = renderChart({
  version: 1,
  type: 'bar',
  title: 'Quarterly revenue',
  description: 'Revenue by quarter, rising to a peak in Q4.',
  data: {
    source: 'inline',
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [{ name: 'Revenue', values: [420, 610, 385, 720] }],
  },
});

if (result.ok) {
  page.innerHTML = result.svg; // a string. That is the whole runtime cost.
}
```

## Why not wrap an existing chart library

Because of color, which sounds trivial and is not.

Chart libraries that render on a server bake their colors into the markup, so
the colors are chosen where the chart is built. But a reader's light or dark
preference is known in the _browser_ — usually as a class on `<html>` that a
toggle flips. Baked colors cannot follow that: you end up rendering two copies
and swapping them, or falling back to `prefers-color-scheme` and ignoring the
toggle your own site ships.

Every color here is a CSS custom property with a fallback:

```
fill="var(--chart-series-1, #4269d0)"
stroke="var(--chart-axis, currentColor)"
```

So a chart inherits the page's theme by doing nothing, and a site restyles every
chart it has ever published by setting a few properties — no rebuild, no
re-render. For a CMS plugin that is the difference between a widget pasted onto
a page and part of the design.

## Several series

`barMode` decides what happens inside a category band. It is an option rather
than a chart `type`, because it changes the arrangement and not the mark —
axes, legend and baseline are identical either way, and a single-series chart
looks the same in both.

```ts
options: {
  barMode: 'grouped';
} // one bar per series, side by side — the default
options: {
  barMode: 'stacked';
} // series piled into one bar per category
```

The difference is not only visual. A **grouped** axis spans the values, because
each bar is read on its own. A **stacked** axis spans the _totals_: three series
each reading 40 reach 120, and an axis topping out at 40 would draw two of the
segments off the plot.

Positive and negative values stack away from the baseline in opposite
directions, each with its own running offset. Sharing one would let a −50 cancel
a +50, hiding a segment and shrinking the axis below the height the bar actually
needs.

A series with no value at a category contributes nothing and the stack closes
up — segments keep their own color rather than inheriting the missing one's.

### Legend

Drawn automatically when there is more than one series, and suppressed with
`legend: false`. With a single series the title already says what the bars are.

Entries wrap onto as many rows as they need, and the height that falls out is
fed back into the layout before the plot is sized — otherwise the chart with
eight series, the one that most needs its legend, is exactly the one whose
legend runs off the side.

## Pie and donut

`type: 'pie'` and `type: 'donut'`. These have no axes, no baseline and no
categories along a scale, so they share almost nothing with the rest except the
title, the legend and the accessible description.

The colors mean something different too. In a bar or line chart a color is a
**series**; in a pie there is one series and a color is a **category**, so the
legend names the slices — it is the only thing that does.

Two inputs are **refused** rather than reinterpreted, because quietly
reinterpreting them loses data while looking like it worked:

| Input                | Why it is rejected                                                              |
| -------------------- | ------------------------------------------------------------------------------- |
| more than one series | a pie shows shares of a whole; rendering only the first silently drops the rest |
| a negative value     | a slice cannot have a negative share of anything                                |

A zero or a `null` is simply no wedge. If **everything** is zero, nothing is
drawn at all — a full circle in one arbitrary color would read as "all of it is
this category", which is a lie about data that does not exist.

Slices keep the author's order rather than being sorted by size, so slice order
and legend order agree.

A slice is labeled with its share only when the label **fits inside the wedge**.
That is measured rather than guessed at from the angle: how much room a slice
has depends on the radius and on how wide the text is, so a 6% slice on a large
chart has room the same slice on a small one does not. Slices too thin to label
are named by the legend.

## Theming

| Property                  | Applies to               | Falls back to         |
| ------------------------- | ------------------------ | --------------------- |
| `--chart-series-1` … `-8` | series fills             | a built-in palette    |
| `--chart-axis`            | axis lines and baselines | `currentColor`        |
| `--chart-text`            | titles and labels        | `currentColor`        |
| `--chart-grid`            | gridlines                | `currentColor` at 15% |

```css
:root {
  --chart-series-1: #0969da;
  --chart-series-2: #1a7f37;
}
```

## Errors are returned, not drawn

`renderChart` returns a result rather than throwing, and never renders a
placeholder:

```ts
const result = renderChart(spec);
if (!result.ok) {
  // [{ path: 'data.series[0].values[2]', message: 'value must be finite' }]
  console.error(result.issues);
}
```

A spec that fails validation is bad _content_, and content problems belong in
front of whoever can fix them — an editor, a build log — rather than disguised
as an empty chart on a live page. Every problem is reported at once, with a
path, because fixing a pasted spreadsheet one error per attempt is miserable.

## The spec

```ts
type ChartSpec = {
  version: 1;
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut';
  title?: string;
  description?: string; // → <desc>, for screen readers
  data:
    | { source: 'inline'; labels: string[]; series: Series[] }
    | { source: 'media'; fileId?: number; labels: string[]; series: Series[] };
  options?: {
    width?: number; // viewBox units, not pixels
    height?: number;
    valueFormat?: ValueFormat; // Intl.NumberFormat options
    yAxis?: { min?: number; max?: number };
  };
};

type Series = { name: string; values: (number | null)[] };
```

Two things in there are deliberate.

### Versions

| Version | What changed                                                          |
| ------- | --------------------------------------------------------------------- |
| 1       | The first. `options.barMode` chose grouped or stacked bars.           |
| 2       | `barMode` became `stackMode`, now that stacking applies to areas too. |

`renderChart` migrates an older spec in memory before drawing it, so publishing
a new Chartkit never blanks charts already in a database. Migrating the stored
content is a separate, opt-in step.

**`version` from the first commit.** A spec is stored nested inside a Better
Blocks document, and Better Blocks knows nothing about its shape — it only knows
to hand each chart node to `migrateChartSpec`. That contract has to exist before
anyone stores a spec, because adding it later means changing the block
registration API, which is a breaking change in another package.

**`null` is a hole, not a zero.** A missing measurement is not a measurement of
zero: it draws no bar, and it does not drag the axis toward the origin.

**`source` is a discriminant from the start**, even though it began with one
member, so adding a source later does not invalidate stored documents. Reading
live from a Strapi collection is deliberately _not_ here: it is a design problem
about permissions and caching, and a resolver that ignores Strapi's permission
model leaks draft content into public API responses while looking perfectly
innocent in review.

## Accessibility

The SVG is `role="img"` with `aria-labelledby` pointing at its own `<title>` and
`<desc>`, so a screen reader announces one named image instead of walking fifty
anonymous `<rect>` elements. Pass `idPrefix` when a page holds more than one
chart, so their ids cannot collide.

Write the `description`. "Bar chart" plus a list of numbers conveys far less
than a sentence saying what the numbers show.

## The fixture set

```ts
import { fixtures } from '@qkix/chartkit-core/fixtures';
```

Every input that breaks chart geometry — negative values, all zeros, a single
point, fifty categories, labels forty characters long, values spanning six
orders of magnitude, and markup in a label. They drive the snapshot tests and
the gallery in `examples/chartkit-gallery`, so what is asserted and what gets
looked at are the same charts.

They are exported because a chart that looks right on tidy data tells you
nothing: tidy data is the case that works by accident. Anyone extending this
package should render against these before believing their layout code.

**The gallery earns its keep.** Bar-width capping, category-label thinning and
duplicate-axis-label detection were all added because a chart looked wrong on
that page while every test passed. None of them is visible in a diff.

## No runtime dependencies

`d3-scale`, `d3-shape` and `d3-array` do the scale and path maths, and are
bundled at build time rather than declared as dependencies — they are ESM-only,
so a CJS build could not `require()` them. Bundling also lets tree shaking cut
them to the handful of functions this package calls, so consumers never ship the
rest of d3.

## License

MIT
