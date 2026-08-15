FROM node:20-slim

WORKDIR /app

# Copy the renderer package source. It ships raw `.astro` source, so there is no
# build step — Astro/Vite compiles the components on the consumer side. Install
# its runtime dependencies (katex) so `Math.astro`'s `import 'katex'` resolves
# from the renderer's own node_modules when Vite transforms it.
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY index.ts env.d.ts ./
COPY src/ src/

# Install Astro app dependencies (resolves the renderer via `file:../../`)
WORKDIR /app/playground/astro-app
COPY playground/astro-app/package.json ./
RUN npm install

# Copy Astro app source
COPY playground/astro-app/ ./

EXPOSE 4321

CMD ["npm", "run", "dev", "--", "--host"]
