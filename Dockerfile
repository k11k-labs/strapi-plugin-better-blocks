# One image for the whole workspace. Every example service runs from it,
# differing only in the command they start - so the plugin and the renderers
# are built exactly once and every service sees the same linked workspace.
FROM node:22-bookworm-slim

# better-sqlite3 and sharp compile native bindings during install.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

WORKDIR /workspace

# Install first, from the manifests alone, so editing source does not blow away
# the dependency layer.
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Every workspace package's manifest, so pnpm can link them all. A package
# missing from this list installs no dependencies and no workspace links, and
# fails at build time with a resolution error - so this list has to stay
# complete as packages are added.
COPY packages/better-blocks-core/package.json packages/better-blocks-core/
COPY packages/better-blocks-react-renderer/package.json packages/better-blocks-react-renderer/
COPY packages/better-blocks-astro-renderer/package.json packages/better-blocks-astro-renderer/
COPY packages/better-blocks-vue-renderer/package.json packages/better-blocks-vue-renderer/
COPY packages/chartkit-core/package.json packages/chartkit-core/
COPY packages/chartkit-editor/package.json packages/chartkit-editor/
COPY packages/chartkit-react-renderer/package.json packages/chartkit-react-renderer/
COPY packages/chartkit-astro-renderer/package.json packages/chartkit-astro-renderer/
COPY packages/chartkit-vue-renderer/package.json packages/chartkit-vue-renderer/
COPY packages/strapi-plugin-better-blocks/package.json packages/strapi-plugin-better-blocks/
COPY packages/strapi-plugin-chartkit/package.json packages/strapi-plugin-chartkit/
COPY packages/strapi-plugin-rewind/package.json packages/strapi-plugin-rewind/
COPY packages/strapi-plugin-greenlight/package.json packages/strapi-plugin-greenlight/
COPY packages/strapi-plugin-blueprint/package.json packages/strapi-plugin-blueprint/
COPY packages/strapi-plugin-ferry/package.json packages/strapi-plugin-ferry/
# tooling/* goes in whole, not just its manifests: with the hoisted linker pnpm
# materialises workspace packages at install time, so a tsconfig that is not on
# disk yet never lands in node_modules and `extends` fails to resolve. They are
# a handful of config files, so the dependency layer stays cheap either way.
COPY tooling/ tooling/
COPY examples/strapi-app/package.json examples/strapi-app/
COPY examples/react-app/package.json examples/react-app/
COPY examples/astro-app/package.json examples/astro-app/
COPY examples/nuxt-app/package.json examples/nuxt-app/
COPY examples/chartkit-gallery/package.json examples/chartkit-gallery/
RUN pnpm install --frozen-lockfile

COPY . .

# Publishable packages only. The example apps run through their dev servers, so
# they need no build step here.
RUN pnpm build

EXPOSE 1337 5173 4321 3000
