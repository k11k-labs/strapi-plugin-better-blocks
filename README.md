<h1 align="center">qkix / strapi-plugins</h1>

<p align="center">Plugins and renderers for Strapi v5. Two products, one workspace.</p>

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

**[Chartkit](./packages/chartkit-core)** — charts rendered as SVG on the server, so a
page gets a chart without a byte of client-side JavaScript. Early: the spec, the
rendering pipeline and the bar chart are in place.

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
| [`@qkix/chartkit-core`](./packages/chartkit-core)                               | Charts as server-rendered SVG — a `ChartSpec` in, a finished SVG string out. No DOM, no framework, no client-side JavaScript.             |

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
