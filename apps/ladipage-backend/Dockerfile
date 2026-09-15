# =============== BASE STAGE ===============
# Unlighthouse 0.18 + Lighthouse 13 require Node >= 22.19 (fs.promises.glob).
FROM node:22-alpine AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Never download a bundled browser during pnpm install. Chromium is installed
# only in development and the dedicated production browser-worker runtime.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# =============== DEVELOPMENT STAGE ===============
FROM base AS development
WORKDIR /app

# Dev keeps Chromium available because UNLIGHTHOUSE_INLINE can be useful locally.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
  && rm -rf /var/cache/apk/* \
  && if [ ! -e /usr/bin/chromium-browser ] && [ -e /usr/bin/chromium ]; then \
       ln -sf /usr/bin/chromium /usr/bin/chromium-browser; \
     fi

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser \
    CHROMIUM_PATH=/usr/bin/chromium-browser

COPY . .
RUN pnpm install --frozen-lockfile

COPY docker/scripts/nx-dev-entrypoint.sh /usr/local/bin/nx-dev-entrypoint.sh
RUN chmod +x /usr/local/bin/nx-dev-entrypoint.sh

EXPOSE 7002

ENV PORT=7002 \
    UNLIGHTHOUSE_MODE=cli \
    UNLIGHTHOUSE_INLINE=true \
    UNLIGHTHOUSE_ALLOW_LOCAL=true

ENTRYPOINT ["/usr/local/bin/nx-dev-entrypoint.sh"]
CMD ["pnpm", "nx", "serve", "ladipage-backend", "--host=0.0.0.0", "--skip-nx-cache"]

# =============== BUILD + DEPLOY-METADATA STAGE ===============
FROM base AS builder
WORKDIR /app
COPY . .

# IMPORTANT ORDER:
# 1) API build runs first (clean=true) and generates dist/package.json.
# 2) General worker + browser worker use clean=false and add their entrypoints.
# 3) Generate a pruned frozen deployment lockfile from runtime package.json.
RUN pnpm nx build ladipage-backend --prod \
  && pnpm nx build-worker ladipage-backend --prod \
  && pnpm nx build-browser-worker ladipage-backend --prod \
  && node tools/generate-deploy-lockfile.cjs \
       ladipage-backend dist/apps/ladipage-backend \
       @unlighthouse/cli=0.18.0 puppeteer=25.3.0

# =============== PRODUCTION DEPENDENCIES STAGE ===============
FROM node:22-alpine AS production-deps
WORKDIR /app/dist

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apk add --no-cache python3 make g++

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=builder /app/dist/apps/ladipage-backend ./

# A few production seed/compatibility stores intentionally read contract fixture
# JSON files at runtime. Preserve those files without copying the whole source tree.
COPY --from=builder /app/apps/ladipage-backend/test/contract/fixtures ./test/contract/fixtures

RUN pnpm install --prod --frozen-lockfile

# =============== SHARED PRODUCTION RUNTIME (NO BROWSER) ===============
FROM node:22-alpine AS production-runtime
WORKDIR /app/dist
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=production-deps --chown=node:node /app/dist ./
USER node

# =============== PRODUCTION BROWSER RUNTIME ===============
FROM production-runtime AS production-browser-runtime
USER root
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
  && rm -rf /var/cache/apk/* \
  && if [ ! -e /usr/bin/chromium-browser ] && [ -e /usr/bin/chromium ]; then \
       ln -sf /usr/bin/chromium /usr/bin/chromium-browser; \
     fi
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser \
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    UNLIGHTHOUSE_BIN=/app/dist/node_modules/.bin/unlighthouse-ci
USER node

# =============== PRODUCTION API TARGET ===============
FROM production-runtime AS production-api

EXPOSE 7002
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.LADIPAGE_PORT||7002)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "main.js"]

# =============== PRODUCTION GENERAL WORKER TARGET ===============
FROM production-runtime AS production-worker

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "const f=require('fs');const ok=f.readdirSync('/proc').filter(x=>/^\\d+$/.test(x)).some(x=>{try{return f.readFileSync('/proc/'+x+'/cmdline','utf8').includes('worker.main')}catch{return false}});process.exit(ok?0:1)"

CMD ["node", "worker.main.js"]

# =============== PRODUCTION BROWSER WORKER TARGET ===============
FROM production-browser-runtime AS production-browser-worker

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "const f=require('fs');const ok=f.readdirSync('/proc').filter(x=>/^\\d+$/.test(x)).some(x=>{try{return f.readFileSync('/proc/'+x+'/cmdline','utf8').includes('browser-worker.main')}catch{return false}});process.exit(ok?0:1)"

CMD ["node", "browser-worker.main.js"]

# =============== BACKWARD-COMPATIBLE DEFAULT ===============
FROM production-api AS production
