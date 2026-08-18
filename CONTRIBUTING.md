# Contributing

Thanks for your interest in contributing. This is a pnpm workspace driven by Nx
that publishes fifteen packages across six products - the plugins, their
renderers and the shared cores - so most commands below are run from the
repository root.

Which package a change belongs to is usually obvious from
[the package table](./README.md#packages). If it is not, open an issue first;
the boundary between a plugin, a core and a renderer is deliberate, and putting
something on the wrong side of it is the one kind of change that is expensive to
undo.

## Getting started

The quickest way to a working environment is Docker, which brings up the whole
stack at once:

```bash
git clone https://github.com/qkix/strapi-plugins.git
cd strapi-plugin-better-blocks
docker compose up --build
```

That builds the plugins and the renderers and starts a Strapi v5 app (SQLite) at
`http://localhost:1337/admin`, seeded with the showcase articles and an admin
account (`admin@example.com` / `admin12#`). The renderer examples come up
alongside it, all reading that same content:

| Example | URL                     |
| ------- | ----------------------- |
| React   | <http://localhost:5173> |
| Astro   | <http://localhost:4321> |
| Nuxt    | <http://localhost:3000> |

To wipe the seeded database and uploaded media and start again:

```bash
docker compose down -v && docker compose up --build
```

See [examples/README.md](./examples/README.md) for what gets seeded and how to
run a single example.

### Without Docker

Node 20 or 22 - the Strapi SDK refuses 23 and newer.

```bash
pnpm install
pnpm build   # every publishable package

pnpm --filter @qkix/example-strapi-app develop
pnpm --filter @qkix/example-nuxt-app dev   # or -react-app / -astro-app
```

## Development workflow

1. Create a branch from `main`.
2. Make your change in the package it belongs to.
3. Verify it. For plugin work that means the Strapi admin; for renderer work,
   the matching example app - and `docker compose up --build`, because the
   plugins and renderers are compiled into the image, so a plain
   `docker compose restart` does not pick up source changes. An example app's own
   source hot-reloads with no rebuild.
4. Run the checks CI runs:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

To work on one package, filter:

```bash
pnpm --filter @qkix/strapi-plugin-better-blocks test
pnpm exec nx run @qkix/better-blocks-vue-renderer:build
```

Nx only reruns what a change actually affects, so a second run is mostly cache.

## Where things belong

**The shared cores.** The Better Blocks document types and the
framework-independent logic live in `packages/better-blocks-core`; chart specs,
validation and SVG rendering live in `packages/chartkit-core`. If you add a block
attribute or a chart option, add it there first - every renderer reads it from
that one place, and the boundary lint rule keeps the dependency direction
honest.

**Adding a block type** to the Better Blocks editor is a public API, not an edit
to the editor package. See
[Registering a block type](./packages/better-blocks-core#registering-a-block-type):
one definition object teaches the editor, the validator, the migrator and every
renderer about the block. Chartkit's chart block is the worked example.

**Renderers stay in step.** A feature that changes rendered markup should land in
the React, Astro and Vue renderers together, or it becomes a difference nobody
remembers to close. Each has its own test suite and they share a characterization
suite over the core helpers.

## Pull requests

- Keep PRs focused - one feature or fix per PR.
- Fill out the PR template.
- Make sure CI passes (lint, typecheck, test, build) on both Node 20 and 22.
- Add screenshots or GIFs for UI changes.
- Documentation ships with the code: a change to a package's behavior updates
  that package's README in the same PR.

Package labels (`pkg: …`) are applied automatically from the paths a PR touches,
so a new package needs an entry in [.github/labeler.yml](./.github/labeler.yml)
and in the issue forms.

Releases are cut with `nx release`: versions, tags and changelogs are per
package, so a change to one does not bump the others. The release workflow is
manual and defaults to a dry run.

## Reporting bugs

Use the
[bug report template](https://github.com/qkix/strapi-plugins/issues/new?template=bug_report.yml)
and include which package you are using, its version, your Strapi version, and
steps to reproduce.

## Feature requests

Use the
[feature request template](https://github.com/qkix/strapi-plugins/issues/new?template=feature_request.yml).
A description of the problem is worth more than a description of the solution -
it leaves room for a better one.
