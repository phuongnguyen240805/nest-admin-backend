# FROM node:22-alpine AS builder

# WORKDIR /build
# COPY donut-sync-backend/package.json donut-sync-backend/tsconfig.json donut-sync-backend/tsconfig.build.json ./
# COPY donut-sync-backend/src/ src/
# RUN npm install
# RUN npm run build
# RUN npm prune --omit=dev

# FROM node:22-alpine

# WORKDIR /app
# COPY --from=builder /build/package.json .
# COPY --from=builder /build/dist/ dist/
# COPY --from=builder /build/node_modules/ node_modules/

# ENV NODE_ENV=production
# EXPOSE 12342

# USER node
# CMD ["node", "dist/main"]





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

# Expose port
EXPOSE 3000

# Command cho dev mode (Nx serve)
CMD ["pnpm", "nx", "serve", "donut-sync-backend", "--host=0.0.0.0", "--skip-nx-cache"]

# =============== BUILD STAGE (cho production) ===============
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm nx build donut-sync-backend --prod

# =============== PRODUCTION STAGE ===============
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy built dist và node_modules
COPY --from=builder /app/dist/apps/donut-sync-backend ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/donut-sync-backend/package.json ./

EXPOSE 3000
CMD ["node", "dist/main.js"]