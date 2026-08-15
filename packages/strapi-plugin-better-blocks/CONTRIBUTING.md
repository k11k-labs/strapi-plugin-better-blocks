# Contributing to Better Blocks

Thanks for your interest in contributing! Here's how you can help.

This package lives in a monorepo together with the React and Astro renderers
and the shared core, so most commands below are run from the repository root.

## Getting started

The quickest way to set up a development environment is with Docker:

```bash
git clone https://github.com/qkix/strapi-plugin-better-blocks.git
cd strapi-plugin-better-blocks
docker compose up --build
```

That builds the plugin and brings up a Strapi v5 app at
`http://localhost:1337/admin`, seeded with showcase articles and an admin
account (`admin@example.com` / `admin12#`), plus both renderers showing the same
content on `http://localhost:5173` and `http://localhost:4321`.

### Without Docker

Node 20 or 22 — the Strapi SDK refuses 23 and newer.

```bash
pnpm install
pnpm build   # the plugin, the core and both renderers

pnpm --filter @qkix/example-strapi-app develop
```

## Development workflow

1. Create a branch from `main`
2. Make changes in `packages/strapi-plugin-better-blocks/admin/src/` (frontend)
   or `server/src/` (backend)
3. Rebuild and restart with `docker compose up --build`. The plugin is compiled
   into the image, so a plain `docker compose restart` will not pick up source
   changes.
4. Verify your changes in the Strapi admin panel
5. Run checks before committing:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

To work on a single package, filter:

```bash
pnpm --filter @qkix/strapi-plugin-better-blocks test
```

## A note on the shared core

The document types and the framework-independent logic live in
`packages/better-blocks-core`. If you add a block attribute, add it there first
— both renderers read it from that one place, and the boundary lint rule keeps
the dependency direction honest.

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Fill out the PR template
- Make sure CI passes (lint, typecheck, test, build)
- Add screenshots or GIFs for UI changes

Releases are cut with `nx release`: versions, tags and changelogs are per
package, so a change here does not bump the renderers.

## Reporting bugs

Use the [bug report template](https://github.com/qkix/strapi-plugin-better-blocks/issues/new?template=bug_report.yml) and include your Strapi version, plugin version, and steps to reproduce.

## Feature requests

Use the [feature request template](https://github.com/qkix/strapi-plugin-better-blocks/issues/new?template=feature_request.yml) to suggest new features.
