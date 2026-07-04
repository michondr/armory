# --- build stage ---
FROM node:24-bookworm AS build
RUN npm install -g pnpm@9
WORKDIR /app
# VITE_API_URL is inlined at build time. Empty = same-origin (nginx proxies /api).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN pnpm install --filter "@armory/web..."
RUN pnpm --filter @armory/shared build \
  && pnpm --filter @armory/web build

# --- runtime stage: nginx serves the SPA and proxies /api to the api service ---
FROM nginx:1.27-alpine AS runtime
COPY infra/web-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
