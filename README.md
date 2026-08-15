<h1 align="center">Better Blocks</h1>

<p align="center">An enhanced Rich Text (Blocks) editor for Strapi v5 — and the renderers that display its output.</p>

<p align="center">
  <a href="./LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@k11k/strapi-plugin-better-blocks.svg" />
  </a>
  <a href="https://buymeacoffee.com/k11k">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

---

## Packages

| Package                                                                         | Description                                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`@k11k/strapi-plugin-better-blocks`](./packages/strapi-plugin-better-blocks)   | Strapi v5 custom field — an extended Blocks editor built on Slate: colors, tables, callouts, media embeds, code, math, diagrams and more. |
| [`@k11k/better-blocks-react-renderer`](./packages/better-blocks-react-renderer) | React renderer for Strapi Blocks content with full Better Blocks support.                                                                 |
| [`@k11k/better-blocks-astro-renderer`](./packages/better-blocks-astro-renderer) | Astro renderer for the same content — native Astro components, zero client-side JavaScript.                                               |

Each package has its own README, changelog and release cadence. Start with the package
you need; the plugin README covers installation and configuration inside Strapi, the
renderer READMEs cover consuming the content on the frontend.

## Repository layout

```
packages/    published packages, one directory per package
tooling/     shared, private build and lint configuration
examples/    runnable example applications
```

The directory name of a package always matches its npm name without the `@k11k` scope.

## License

[MIT](./LICENSE)
