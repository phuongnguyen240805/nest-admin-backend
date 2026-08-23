# =============== BASE STAGE ===============
FROM node:20-alpine AS base
WORKDIR /app

# Keep Docker builds reproducible with the workspace packageManager version.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace manifests first to maximize dependency layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# =============== DEVELOPMENT STAGE ===============
FROM base AS development
WORKDIR /app

# Keep the existing local-development behavior unchanged.
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 7001
CMD ["pnpm", "nx", "serve", "nest-admin-backend", "--host=0.0.0.0", "--skip-nx-cache"]

# =============== BUILD + DEPLOY-METADATA STAGE ===============
FROM base AS builder
WORKDIR /app
COPY . .

# This workspace has no apps/nest-admin-backend/package.json. Webpack already
# generates the runtime package.json in dist/, so generate only the pruned
# pnpm lockfile from that build artifact instead of using @nx/js:prune-lockfile.
RUN pnpm nx build nest-admin-backend --prod \
  && node tools/generate-deploy-lockfile.cjs \
       nest-admin-backend dist/apps/nest-admin-backend

# =============== PRODUCTION DEPENDENCIES STAGE ===============
FROM node:20-alpine AS production-deps
WORKDIR /app/dist

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# bcrypt/native packages may need a compiler toolchain when a prebuilt Alpine
# binary is not available. The toolchain stays in this throw-away stage.
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/dist/apps/nest-admin-backend ./
RUN pnpm install --prod --frozen-lockfile

# =============== PRODUCTION STAGE ===============
FROM node:20-alpine AS production

# Keep process.cwd() next to the pruned package.json/node_modules tree. This is
# important for libraries that resolve runtime files from the working directory.
WORKDIR /app/dist
ENV NODE_ENV=production

COPY --from=production-deps --chown=node:node /app/dist ./

USER node
EXPOSE 7001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||7001)+'/docs/json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "main.js"]
