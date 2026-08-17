# Chartkit gallery

Every Chartkit fixture on one page, for looking at.

```sh
pnpm --filter @qkix/example-chartkit-gallery dev
# http://localhost:4322
```

`build` writes `dist/index.html`; `serve` serves it. The page is static - the
charts are SVG strings produced at build time, so there is nothing to hydrate.
That is also the point being demonstrated: this is what a Chartkit chart costs a
page.

## Why this exists

A chart cannot be reviewed in a diff. Unit tests pin the geometry and snapshots
catch changes to it, but neither can tell you that axis labels overlap, that a
single bar has swollen to fill the plot, or that an axis reads "1M" three times
in a row. Those are the failures that matter, and the only way to find them is
to look.

All three of those examples are real: each one shipped with a full green test
suite, and each was caught here. The note under every fixture says what that
fixture is meant to break, so there is something specific to check for rather
than a vague impression of whether it looks fine.

The fixtures come from `@qkix/chartkit-core/fixtures` - the same set the
snapshot tests use, so what is asserted and what is looked at cannot drift
apart.
