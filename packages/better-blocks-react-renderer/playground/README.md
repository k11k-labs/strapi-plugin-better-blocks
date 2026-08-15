# Playground

Manual testing environment for `@k11k/better-blocks-react-renderer`.

## Quick start (Docker)

```bash
cd playground
docker compose up --build
```

- Strapi: http://localhost:1338/admin
- React app: http://localhost:5173

> The Docker stack publishes Strapi on host port **1338** (container port stays 1337) so it can run alongside other Better Blocks stacks that use :1337. Containers are named `better-blocks-react-renderer-strapi` / `better-blocks-react-renderer-react-app` under the `better-blocks-react-renderer` compose project.

On first run, create an admin account in Strapi, then follow the "Strapi setup" steps below.

## Manual setup

### Prerequisites

- Node.js >= 20

### 1. Build the renderer

From the repo root:

```bash
yarn install
yarn build
```

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

## 3. Start the React app

In a new terminal:

```bash
cd playground/react-app
npm install
npm run dev
```

Open http://localhost:5173 — you should see your articles rendered with colors and highlights.

## Development workflow

When you change the renderer source code:

1. Rebuild: `yarn build` (from repo root)
2. The React app picks up the new build automatically (Vite hot-reloads)
