# =============== BASE STAGE ===============
# Unlighthouse 0.18 + Lighthouse 13 require Node >= 22.19 (fs.promises.glob)
FROM node:22-alpine AS base
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Chromium for Unlighthouse / Puppeteer inside Docker
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
  && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser \
    CHROMIUM_PATH=/usr/bin/chromium-browser

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# =============== DEVELOPMENT STAGE ===============
FROM base AS development
WORKDIR /app

# Alpine chromium binary name varies
RUN if [ ! -e /usr/bin/chromium-browser ] && [ -e /usr/bin/chromium ]; then \
      ln -sf /usr/bin/chromium /usr/bin/chromium-browser; \
    fi

# Copy toàn bộ source code
COPY . .

# Re-run install to pick up any lockfile changes (e.g. newly added packages)
RUN pnpm install --frozen-lockfile

COPY docker/scripts/nx-dev-entrypoint.sh /usr/local/bin/nx-dev-entrypoint.sh
RUN chmod +x /usr/local/bin/nx-dev-entrypoint.sh

# Expose port
EXPOSE 7002

ENV PORT=7002 \
    UNLIGHTHOUSE_MODE=cli \
    UNLIGHTHOUSE_INLINE=true \
    UNLIGHTHOUSE_ALLOW_LOCAL=true

# Sync node_modules on each start (volume /app/node_modules may be stale after lockfile changes)
ENTRYPOINT ["/usr/local/bin/nx-dev-entrypoint.sh"]
CMD ["pnpm", "nx", "serve", "ladipage-backend", "--host=0.0.0.0", "--skip-nx-cache"]

# =============== BUILD STAGE (cho production) ===============
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm nx build ladipage-backend --prod \
  && pnpm nx build-worker ladipage-backend --prod

# =============== PRODUCTION STAGE ===============
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
  && rm -rf /var/cache/apk/* \
  && if [ ! -e /usr/bin/chromium-browser ] && [ -e /usr/bin/chromium ]; then \
       ln -sf /usr/bin/chromium /usr/bin/chromium-browser; \
     fi

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser \
    CHROMIUM_PATH=/usr/bin/chromium-browser

# Copy built dist và node_modules
COPY --from=builder /app/dist/apps/ladipage-backend ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/ladipage-backend/package.json ./

EXPOSE 7002
ENV PORT=7002
CMD ["node", "dist/main.js"]
