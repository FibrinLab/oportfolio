# syntax=docker/dockerfile:1.7
#
# Two runtime images from one build:
#   docker build --target web    -t oportfolio-web .
#   docker build --target worker -t oportfolio-worker .
#
# Both run as an unprivileged user, contain no development tooling, and read
# every setting from the environment (docs/deployment.md). Migrations are run
# from the worker image: `node_modules/.bin/tsx scripts/migrate.ts`.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------- deps
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------- build
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm build

# ---------------------------------------------------------------- web
FROM node:${NODE_VERSION} AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ---------------------------------------------------------------- worker
# Production dependencies only (tsx is a runtime dependency for the worker and
# migration scripts) plus the TypeScript sources they execute.
FROM node:${NODE_VERSION} AS worker
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable \
 && groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY --chown=app:app tsconfig.json ./
COPY --chown=app:app src ./src
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app db ./db
COPY --chown=app:app spec/frameworks ./spec/frameworks
COPY --chown=app:app spec/schemas ./spec/schemas
USER app
CMD ["node_modules/.bin/tsx", "src/worker/index.ts"]
