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

echo "==> Patching plugin path for Docker..."
cd /app
sed -i 's|"file:../../"|"file:/plugin-build"|g' package.json

echo "==> Installing Strapi v5 dependencies..."
yarn install

echo "==> Starting Strapi v5 (admin panel at http://localhost:1337/admin)..."
mkdir -p /app/public/uploads
exec yarn develop
