<h1 align="center">Better Blocks</h1>

<p align="center">An enhanced Rich Text (Blocks) editor for Strapi v5 — and the renderers that display its output.</p>

<p align="center">
  <a href="./LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@qkix/strapi-plugin-better-blocks.svg" />
  </a>
  <a href="https://buymeacoffee.com/qkix">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

---

## Packages

| Package                                                                         | Description                                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`@qkix/strapi-plugin-better-blocks`](./packages/strapi-plugin-better-blocks)   | Strapi v5 custom field — an extended Blocks editor built on Slate: colors, tables, callouts, media embeds, code, math, diagrams and more. |
| [`@qkix/better-blocks-react-renderer`](./packages/better-blocks-react-renderer) | React renderer for Strapi Blocks content with full Better Blocks support.                                                                 |
| [`@qkix/better-blocks-astro-renderer`](./packages/better-blocks-astro-renderer) | Astro renderer for the same content — native Astro components, zero client-side JavaScript.                                               |
| [`@qkix/better-blocks-core`](./packages/better-blocks-core)                     | The document types and the logic both renderers share. No runtime dependencies.                                                           |

The renderers re-export the document types, so consumers keep importing
`BlocksContent` from whichever renderer they already use — the core exists to
keep the two in step, not to be depended on directly.

Each package has its own README, changelog and release cadence. Start with the package
you need; the plugin README covers installation and configuration inside Strapi, the
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
pnpm build        # plugin + both renderers
pnpm test
pnpm lint
pnpm graph        # dependency graph
```

Nx wraps each package's own build script rather than replacing it, so a package
still builds on its own from its directory.

To see a change running end to end, `docker compose up --build` brings up Strapi
with the plugin plus both renderers on the same seeded content — see
[examples/README.md](./examples/README.md).

Releases go through `nx release`: independent versions, one changelog and tag
per package. The release workflow is manual and defaults to a dry run.

## License

[MIT](./LICENSE)
