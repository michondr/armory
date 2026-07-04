# --- build stage: full node image (has compilers for argon2 / prisma engines) ---
FROM node:24-bookworm AS build
RUN npm install -g pnpm@9
WORKDIR /app
COPY . .
# Install only the api and its workspace deps (@armory/shared).
RUN pnpm install --filter "@armory/api..."
RUN pnpm --filter @armory/shared build \
  && pnpm --filter @armory/api exec prisma generate \
  && pnpm --filter @armory/api build

# --- runtime stage: slim image + openssl for the prisma engine ---
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
ENV NODE_ENV=production
# Apply pending migrations, then start the server.
CMD ["sh", "-lc", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
