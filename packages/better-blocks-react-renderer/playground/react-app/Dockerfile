FROM node:20-slim

WORKDIR /app

# Install renderer dependencies and build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY src/ src/
COPY tsconfig.json tsup.config.ts ./
RUN yarn build

# Install React app dependencies
WORKDIR /app/playground/react-app
COPY playground/react-app/package.json ./
RUN npm install

# Copy React app source
COPY playground/react-app/ ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
