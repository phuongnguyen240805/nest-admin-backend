# =============== BASE STAGE ===============
FROM node:20-alpine AS base
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# =============== DEVELOPMENT STAGE ===============
FROM base AS development
WORKDIR /app

# Copy toàn bộ source code
COPY . .

# Re-run install to pick up any lockfile changes (e.g. newly added packages)
RUN pnpm install --frozen-lockfile

COPY docker/scripts/nx-dev-entrypoint.sh /usr/local/bin/nx-dev-entrypoint.sh
RUN chmod +x /usr/local/bin/nx-dev-entrypoint.sh

# Expose port
EXPOSE 7002

ENV PORT=7002

# Sync node_modules on each start (volume /app/node_modules may be stale after lockfile changes)
ENTRYPOINT ["/usr/local/bin/nx-dev-entrypoint.sh"]
CMD ["pnpm", "nx", "serve", "ladipage-backend", "--host=0.0.0.0", "--skip-nx-cache"]

# =============== BUILD STAGE (cho production) ===============
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm nx build ladipage-backend --prod

# =============== PRODUCTION STAGE ===============
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy built dist và node_modules
COPY --from=builder /app/dist/apps/ladipage-backend ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/ladipage-backend/package.json ./

EXPOSE 7002
ENV PORT=7002
CMD ["node", "dist/main.js"]
