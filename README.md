<h1 align="center">qkix / strapi-plugins</h1>

<p align="center">Plugins and renderers for Strapi v5. Four products, one workspace.</p>

<p align="center">
  <a href="./LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@qkix/strapi-plugin-better-blocks.svg" />
  </a>
  <a href="https://buymeacoffee.com/qkix">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

---

## Products

**[Better Blocks](./packages/strapi-plugin-better-blocks)** — an enhanced Rich Text
(Blocks) editor for Strapi v5, plus the React and Astro renderers that display what it
writes. Colors, tables, callouts, media embeds, code, math and diagrams.

**[Chartkit](./packages/strapi-plugin-chartkit)** — charts rendered as SVG on the
server, so a page gets a chart without a byte of client-side JavaScript. Authored in
Strapi as a field of its own or as a block inside a Better Blocks document, from a data
grid, a spreadsheet paste or a file in the Media Library.

**[Rewind](./packages/strapi-plugin-rewind)** — document version history for Strapi v5.
Every save is snapshotted, and any snapshot can be put back, from a panel beside the
document in the edit view.

**[Greenlight](./packages/strapi-plugin-greenlight)** — multi-stage content review, where
the stage is a gate rather than a label: a document outside its approved stage is refused
at publish time, whichever route the publish came in by.

**[Blueprint](./packages/strapi-plugin-blueprint)** — a diagram of your content types,
including the components and dynamic zones every other schema visualiser leaves out.
Rendered as real SVG on the server, so the same drawing works in the admin panel, in a
README and in a docs build.

They are separate products that share a workspace, and increasingly an interface:
Chartkit registers itself as a Better Blocks block type through a public API rather
than either one knowing the other's internals.

## Packages

| Package                                                                         | Description                                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`@qkix/strapi-plugin-better-blocks`](./packages/strapi-plugin-better-blocks)   | Strapi v5 custom field — an extended Blocks editor built on Slate: colors, tables, callouts, media embeds, code, math, diagrams and more. |
| [`@qkix/better-blocks-react-renderer`](./packages/better-blocks-react-renderer) | React renderer for Strapi Blocks content with full Better Blocks support.                                                                 |
| [`@qkix/better-blocks-astro-renderer`](./packages/better-blocks-astro-renderer) | Astro renderer for the same content — native Astro components, zero client-side JavaScript.                                               |
| [`@qkix/better-blocks-core`](./packages/better-blocks-core)                     | The document types, the logic every package shares, and the block registration contract. No runtime dependencies.                         |
| [`@qkix/strapi-plugin-chartkit`](./packages/strapi-plugin-chartkit)             | Strapi v5 custom field — a chart, edited in a data grid and stored as a spec. Works with or without Better Blocks.                        |
| [`@qkix/chartkit-core`](./packages/chartkit-core)                               | Charts as server-rendered SVG — a `ChartSpec` in, a finished SVG string out. No DOM, no framework, no client-side JavaScript.             |
| [`@qkix/chartkit-react-renderer`](./packages/chartkit-react-renderer)           | React renderer for Chartkit charts, and the Better Blocks block plugin that draws one inside a document.                                  |
| [`@qkix/chartkit-astro-renderer`](./packages/chartkit-astro-renderer)           | The same for Astro — zero client-side JavaScript.                                                                                         |
| [`@qkix/chartkit-editor`](./packages/chartkit-editor)                           | The chart editor for the Strapi admin: preview, data grid and spreadsheet paste, shared by both Chartkit surfaces.                        |
| [`@qkix/strapi-plugin-rewind`](./packages/strapi-plugin-rewind)                 | Strapi v5 plugin — document version history: a snapshot on every save, a diff between any two, and restore.                               |
| [`@qkix/strapi-plugin-greenlight`](./packages/strapi-plugin-greenlight)         | Strapi v5 plugin — multi-stage content review with a publish gate: nothing goes live until it is approved.                                |
| [`@qkix/strapi-plugin-blueprint`](./packages/strapi-plugin-blueprint)           | Strapi v5 plugin — a schema diagram covering content types, components and dynamic zones, rendered as SVG on the server.                  |

The renderers re-export the document types, so consumers keep importing
`BlocksContent` from whichever renderer they already use — for reading content,
the core stays an implementation detail that keeps the two in step.

Packages that **add a block type** are the exception, and depend on the core
directly. A `BlockDefinition` is the vocabulary the editor, the validator, the
migrator and both renderers all speak, so a package that contributes a block
writes it once and hands the same object to each. See
[Registering a block type](./packages/better-blocks-core#registering-a-block-type).

Each package has its own README, changelog and release cadence — nothing is versioned
in lockstep, and a release names the packages it covers. Start with the package you
need: the plugin README covers installation and configuration inside Strapi, and the
renderer READMEs cover consuming the content on the frontend.

## Repository layout

```
packages/    published packages, one directory per package
tooling/     shared, private build and lint configuration
examples/    runnable example applications
```

The directory name of a package always matches its npm name without the `@qkix` scope.

## Working on it

A pnpm workspace driven by Nx. Node 20 or 22 — the Strapi SDK refuses 23+.

```bash
pnpm install
pnpm build        # every package
pnpm test
pnpm lint
pnpm graph        # dependency graph
```

Nx wraps each package's own build script rather than replacing it, so a package
still builds on its own from its directory.

To see a change running end to end, `docker compose up --build` brings up Strapi with
the plugin plus both renderers on the same seeded content — see
[examples/README.md](./examples/README.md). Chartkit has its own page,
[examples/chartkit-gallery](./examples/chartkit-gallery), which renders every fixture at
once: charts cannot be reviewed in a diff, so there has to be somewhere to look at them.

Releases go through `nx release`: independent versions, one changelog and tag
per package. The release workflow is manual and defaults to a dry run.

## License

[MIT](./LICENSE)
