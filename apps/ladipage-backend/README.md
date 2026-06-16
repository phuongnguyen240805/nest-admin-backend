# ladipage-backend

Backend cho LadiPage / Liora Landing Page Builder. Tái sử dụng gần như toàn bộ `libs/nest-core` và bổ sung modules domain riêng (publish, website, funnelx, flowise…).

## Công nghệ

- NestJS 11 + Fastify
- `@liora/nest-core` — Auth, Billing, Tenant, System RBAC, Netdisk, SSE/Socket, Agent
- `@liora/database` — PostgreSQL / Supabase qua TypeORM
- `@liora/supabase` — auth exchange
- Redis, MinIO/S3, Swagger

## Port & URL

| Môi trường | Port | API | Swagger | Health |
|------------|------|-----|---------|--------|
| Local | 7002 | http://localhost:7002/api | http://localhost:7002/docs | `GET /api/health/ready` |
| Docker | 7002 | http://localhost:7002/api | http://localhost:7002/docs | `GET /api/health/ready` |

Biến: `LADIPAGE_PORT` (ưu tiên) hoặc `PORT`.

## Tái sử dụng từ nest-core

- **Auth + RBAC + Tenant** — JwtAuthGuard, decorators, multi-tenant interceptor
- **Billing / Credit / Plan / Payment** — BillingModule, Stripe webhook
- **File / Media** — ToolsModule, NetdiskModule → `file-manager` wrapper
- **Realtime** — SseModule, SocketModule (Redis adapter)
- **AI** — AgentModule (Flowise / Librefang)
- **Public / Embed** — PublicApiModule (script nhúng, quota)
- **Cross-cutting** — SharedModule, exception filter, pagination, idempotence

## Modules domain (ladipage)

```
src/modules/
├── publish/          # Publish landing, embed script
├── website/
├── funnelx/
├── file-manager/     # Wrapper Netdisk + Upload
├── credit/           # Business rules trên Billing
├── payment/
├── flowise/
└── ...
```

## Luồng publish (tóm tắt)

```mermaid
flowchart LR
  B[Builder UI] --> LP[ladipage API]
  LP --> AUTH[JWT + Tenant]
  LP --> PUB[PublishModule]
  PUB --> DB[(PostgreSQL)]
  PUB --> S3[(MinIO/S3)]
  PUB --> CDN[Public embed / CDN]
```

Client authenticate: Supabase login → `POST /api/auth/exchange` → Nest JWT cho mọi `/api/*`.

## Chạy local

```bash
# Từ root monorepo
cp .env.example .env
pnpm install
pnpm db:migration:run

# Redis + DB
docker compose -f docker/docker-compose.yml --env-file .env up -d db redis minio

# .env trên host
# REDIS_HOST=127.0.0.1
# REDIS_PORT=6381
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/liora_db
# DB_SSL=false

pnpm dev:ladipage
# hoặc: pnpm nx serve ladipage-backend
```

## Chạy Docker

```bash
pnpm docker:up
# Service: liora-ladipage
```

Chỉ ladipage + redis + minio (dùng Supabase làm DB):

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d redis minio liora-ladipage
```

Ladipage trong Docker dùng `REDIS_HOST=redis`; `DATABASE_URL` lấy từ `.env` (Supabase hoặc `db` container).

## Migrate & seed

Chạy từ root — ladipage dùng chung schema với nest-admin:

```bash
pnpm db:migration:run
pnpm db:validate
pnpm db:seed:validate
```

Chi tiết: [libs/database/README.md](../../libs/database/README.md)

## Swagger

Mở http://localhost:7002/docs sau khi app chạy.

1. Đăng nhập Supabase (client SDK) hoặc dùng user seed.
2. `POST /api/auth/exchange` với `supabaseAccessToken`.
3. Authorize Swagger với Bearer JWT nhận được.

Tags chính: `publish`, `LadiPage`, `Auth`, `Billing`, `System`.

## Build production

```bash
pnpm nx build ladipage-backend
```

## Tài liệu

- [README root](../../README.md)
- [nest-admin](../nest-admin-backend/README.md)
- [Docker](../../docker/README.md)
- [Supabase auth](../../libs/supabase/workflow.md)