FROM node:20-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM base AS development
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
COPY docker/scripts/nx-dev-entrypoint.sh /usr/local/bin/nx-dev-entrypoint.sh
RUN chmod +x /usr/local/bin/nx-dev-entrypoint.sh
ENV BULLMQ_RUN_WORKERS=true
ENV BULLMQ_ENABLED=true
ENTRYPOINT ["/usr/local/bin/nx-dev-entrypoint.sh"]
CMD ["pnpm", "nx", "serve", "ladipage-ai-worker", "--skip-nx-cache"]

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm nx build ladipage-ai-worker --prod

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV BULLMQ_RUN_WORKERS=true
ENV BULLMQ_ENABLED=true
COPY --from=builder /app/dist/apps/ladipage-ai-worker ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/ladipage-ai-worker/package.json ./
CMD ["node", "dist/main.js"]