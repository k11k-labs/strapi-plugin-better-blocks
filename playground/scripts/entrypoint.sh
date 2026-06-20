#!/bin/sh
set -e

# Install build tools if missing
apk add --no-cache build-base python3 2>/dev/null || true

echo "==> Copying plugin to writable location..."
rm -rf /plugin-build
cp -r /plugin /plugin-build
cd /plugin-build

echo "==> Building plugin..."
yarn install
yarn build

echo "==> Removing plugin devDependencies (prevents nested module duplication)..."
rm -rf /plugin-build/node_modules

echo "==> Patching plugin path for Docker..."
cd /app
sed -i 's|"file:../../"|"file:/plugin-build"|g' package.json

echo "==> Force-refreshing plugin in node_modules..."
rm -rf /app/node_modules/@k11k/strapi-plugin-better-blocks
rm -rf /app/node_modules/.strapi

echo "==> Installing Strapi v5 dependencies..."
yarn install --check-files

echo "==> Force-syncing freshly built plugin dist..."
# yarn caches the file: dependency by version, so a rebuild with the same
# version is NOT re-linked. Always overwrite the installed dist with the fresh
# build, and drop Vite's pre-bundled deps cache so the admin recompiles it.
mkdir -p /app/node_modules/@k11k/strapi-plugin-better-blocks
rm -rf /app/node_modules/@k11k/strapi-plugin-better-blocks/dist
cp -r /plugin-build/dist /app/node_modules/@k11k/strapi-plugin-better-blocks/dist
cp /plugin-build/package.json /app/node_modules/@k11k/strapi-plugin-better-blocks/package.json
rm -rf /app/node_modules/.strapi /app/node_modules/.vite /app/.cache

echo "==> Starting Strapi v5 (admin panel at http://localhost:1337/admin)..."
mkdir -p /app/public/uploads
exec yarn develop
