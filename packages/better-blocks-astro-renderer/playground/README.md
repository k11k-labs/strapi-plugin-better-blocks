# Playground

Manual testing environment for `@k11k/better-blocks-astro-renderer`.

## Quick start (Docker)

```bash
cd playground
docker compose up --build
```

- Strapi: http://localhost:1339/admin
- Astro app: http://localhost:4321

> The Docker stack publishes Strapi on host port **1339** (container port stays 1337) so it can run alongside other Better Blocks stacks — the plugin playground (:1337) and the React renderer playground (:1338). Containers are named `better-blocks-astro-renderer-strapi` / `better-blocks-astro-renderer-astro-app` under the `better-blocks-astro-renderer` compose project.

On first run, create an admin account in Strapi, then follow the "Strapi setup" steps below.

## Manual setup

### Prerequisites

- Node.js >= 20

### 1. Install the renderer

From the repo root:

```bash
yarn install
```

The renderer ships raw `.astro` source — there is no build step. Astro compiles
the components when the playground app consumes them.

## 2. Start Strapi

```bash
cd playground/strapi
cp .env.example .env
npm install
npm run dev
```

### Strapi setup (first run only)

1. Create an admin account at http://localhost:1337/admin
2. Go to **Settings → Users & Permissions → Roles → Public**
3. Under **Article**, enable `find` and `findOne`
4. Save
5. Go to **Content Manager → Article**, create an article using the Better Blocks editor
6. Add some colored text, highlighted text, bold, italic, etc.
7. **Publish** the article

## 3. Start the Astro app

In a new terminal:

```bash
cd playground/astro-app
npm install
npm run dev
```

Open http://localhost:4321 — you should see your articles rendered with colors and highlights.

## Development workflow

When you change the renderer source code:

1. Edit the `.astro` components in `src/`
2. The Astro app picks up the change automatically (Astro hot-reloads — no rebuild step)
