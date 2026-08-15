# Strapi example

A Strapi v5 application running `@qkix/strapi-plugin-better-blocks` from the
workspace, seeded on first boot with the showcase articles the renderer
examples display.

See [examples/README.md](../README.md) for how to bring the whole stack up —
this app plus both renderers — and what gets seeded.

## Running just this app

From the repository root:

```bash
pnpm install
pnpm build                                      # the plugin it depends on

pnpm --filter @qkix/example-strapi-app develop  # http://localhost:1337/admin
```

Other Strapi commands work the same way:

```bash
pnpm --filter @qkix/example-strapi-app build    # build the admin panel
pnpm --filter @qkix/example-strapi-app start    # run the built app
pnpm --filter @qkix/example-strapi-app strapi -- --help
```

The seeded admin is `admin@example.com` / `admin12#`.

## Notes

`config/plugins.ts` points Strapi at the plugin with an explicit `resolve`
path. Strapi discovers plugins by requiring them relative to `@strapi/core` in
the root `node_modules`, and a workspace package is only linked into the app
that depends on it — so auto-discovery alone does not find it here. In a normal
install no such setting is needed.

To re-seed from scratch, delete the database and restart:

```bash
rm -rf examples/strapi-app/.tmp
```

Under Docker, `docker compose down -v` does the same by dropping the volumes.
