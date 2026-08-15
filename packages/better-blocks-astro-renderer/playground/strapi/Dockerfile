FROM node:20-slim

WORKDIR /app

# Strapi needs these for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies from the committed lockfile. A bare `npm install` (no
# lockfile) drifts Strapi sub-package versions and breaks the admin build with
# "useGetAIFeatureConfigQuery is not exported". The tracked yarn.lock pins
# versions and includes the Linux native binaries (swc, rollup) the build needs.
COPY playground/strapi/package.json playground/strapi/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy Strapi source and seed DB
COPY playground/strapi/ ./

# Build admin panel
RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "start"]
