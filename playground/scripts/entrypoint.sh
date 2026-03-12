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

echo "==> Verifying plugin installation..."
if [ ! -d "/app/node_modules/@k11k/strapi-plugin-better-blocks/dist" ]; then
  echo "==> Plugin not installed by yarn, copying manually..."
  mkdir -p /app/node_modules/@k11k/strapi-plugin-better-blocks
  cp -r /plugin-build/dist /app/node_modules/@k11k/strapi-plugin-better-blocks/
  cp /plugin-build/package.json /app/node_modules/@k11k/strapi-plugin-better-blocks/
fi

echo "==> Starting Strapi v5 (admin panel at http://localhost:1337/admin)..."
mkdir -p /app/public/uploads
exec yarn develop
