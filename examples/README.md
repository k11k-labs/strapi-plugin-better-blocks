# Examples

Three apps that together exercise everything this repo publishes:

| App          | Port | What it is                                                                                 |
| ------------ | ---- | ------------------------------------------------------------------------------------------ |
| `strapi-app` | 1337 | Strapi v5 running `@qkix/strapi-plugin-better-blocks`, seeded with three showcase articles |
| `react-app`  | 5173 | Vite app rendering that content with `@qkix/better-blocks-react-renderer`                  |
| `astro-app`  | 4321 | Astro app rendering the same content with `@qkix/better-blocks-astro-renderer`             |

All three resolve the packages through the pnpm workspace, so they always run
against the working tree rather than a published release.

## Everything at once

```bash
docker compose up --build
```

- Strapi admin - <http://localhost:1337/admin> (`admin@example.com` / `admin12#`)
- React example - <http://localhost:5173>
- Astro example - <http://localhost:4321>

The renderers wait for Strapi to answer before starting, so the first boot
finishes seeding before either app fetches. Editing an example app's `src/`
hot-reloads; changing plugin or renderer source needs `--build` again.

To re-seed from scratch, drop the volumes:

```bash
docker compose down -v
```

## Running them directly

```bash
pnpm install
pnpm build                                   # plugin + both renderers

pnpm --filter @qkix/example-strapi-app develop
pnpm --filter @qkix/example-react-app dev
pnpm --filter @qkix/example-astro-app dev
```

The renderer apps proxy `/api` and `/uploads` to `http://localhost:1337` by
default; set `STRAPI_URL` to point them somewhere else.

## The seeded content

`strapi-app` seeds three articles on first boot, one per showcase that used to
live in each repo's own playground:

- **Plugin showcase** - the block coverage the plugin's own playground used
- **React renderer showcase** - the richest set, including file-download buttons
- **Astro renderer showcase** - the Astro playground's coverage

Both renderer apps list all three, so a block can be compared across renderers
without switching stacks. Seeding only runs when the Article collection is
empty.
