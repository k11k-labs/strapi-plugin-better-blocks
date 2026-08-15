# One image for the whole workspace. All three example services run from it,
# differing only in the command they start — so the plugin and both renderers
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
COPY packages/strapi-plugin-better-blocks/package.json packages/strapi-plugin-better-blocks/
COPY packages/better-blocks-react-renderer/package.json packages/better-blocks-react-renderer/
COPY packages/better-blocks-astro-renderer/package.json packages/better-blocks-astro-renderer/
COPY tooling/tsconfig/package.json tooling/tsconfig/
COPY tooling/eslint-config/package.json tooling/eslint-config/
COPY examples/strapi-app/package.json examples/strapi-app/
COPY examples/react-app/package.json examples/react-app/
COPY examples/astro-app/package.json examples/astro-app/
RUN pnpm install --frozen-lockfile

COPY . .

# Publishable packages only. The example apps run through their dev servers, so
# they need no build step here.
RUN pnpm build

EXPOSE 1337 5173 4321
