# Contributing to Better Blocks

Thanks for your interest in contributing! Here's how you can help.

## Getting started

The quickest way to set up a development environment is with Docker:

```bash
git clone https://github.com/k11k-labs/strapi-plugin-better-blocks.git
cd strapi-plugin-better-blocks
docker compose up
```

This builds the plugin and starts a Strapi v5 app at `http://localhost:1337/admin`.

### Without Docker

```bash
yarn install && yarn build
cd playground/strapi && npm install && npm run develop
```

## Development workflow

1. Create a branch from `main`
2. Make changes in `admin/src/` (frontend) or `server/src/` (backend)
3. Restart the container (`docker compose restart`) to rebuild
4. Verify your changes in the Strapi admin panel
5. Run checks before committing:
   ```bash
   yarn lint
   yarn test:ts:front
   yarn test:ts:back
   yarn build
   ```

## Pull requests

- Keep PRs focused — one feature or fix per PR
- Fill out the PR template
- Make sure CI passes (lint, TypeScript, build)
- Add screenshots or GIFs for UI changes

## Reporting bugs

Use the [bug report template](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/new?template=bug_report.yml) and include your Strapi version, plugin version, and steps to reproduce.

## Feature requests

Use the [feature request template](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues/new?template=feature_request.yml) to suggest new features.
