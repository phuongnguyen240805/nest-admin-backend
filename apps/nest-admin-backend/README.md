# nest-admin-backend

Control plane của Liora: quản trị hệ thống (RBAC, menu, dept), auth, billing/Stripe, tenant, file/netdisk, AI agent, tasks, SSE/socket.

## Công nghệ

- NestJS 11 + Fastify
- `@liora/nest-core` — toàn bộ business modules
- `@liora/database` — TypeORM entities + PostgreSQL
- `@liora/supabase` — auth hybrid (khi `USE_SUPABASE_AUTH=true`)
- Redis — session cache, rate limit, Socket.IO adapter
- MinIO/S3 — file storage
- Swagger tại `/docs`

## Port & URL

| Môi trường | Port | API | Swagger |
|------------|------|-----|---------|
| Local | 7001 | http://localhost:7001/api | http://localhost:7001/docs |
| Docker | 7001 | http://localhost:7001/api | http://localhost:7001/docs |

Biến môi trường: `NEST_ADMIN_PORT`, `PORT` (mặc định 7001).

## Modules chính

Import từ `libs/nest-core` trong `src/app/app.module.ts`:

- **AuthModule** — register, exchange Supabase → JWT, legacy login
- **SystemModule** — user, role, menu, dept, dict, config
- **BillingModule** — subscription, credit wallet, Stripe webhook (`/api/webhooks/stripe`)
- **TenantModule** — multi-tenant context
- **NetdiskModule / ToolsModule** — upload, file manager
- **AgentModule** — Librefang AI agent
- **SocketModule / SseModule** — realtime
- **HealthModule** — health endpoints

## Luồng request

```mermaid
sequenceDiagram
  participant C as Client
  participant A as nest-admin
  participant G as JwtAuthGuard + RbacGuard
  participant DB as PostgreSQL
  participant R as Redis

  C->>A: Request + Bearer JWT
  A->>G: Validate token & permissions
  G->>R: Cache lookup (optional)
  G->>DB: Business query
  A-->>C: ResOp JSON response
```

Global prefix: `api`. Guards mặc định: `JwtAuthGuard`, `RbacGuard`, `ThrottlerGuard`.

## Chạy local

```bash
# Từ root monorepo
cp .env.example .env
pnpm install
pnpm db:migration:run && pnpm db:validate

# Cần Redis + DB (xem README root)
pnpm nx serve nest-admin-backend
```

Khi chạy trên host (không trong Docker network):

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6381
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/liora_db
DB_SSL=false
```

## Chạy Docker

```bash
# Từ root
pnpm docker:up
# Service: liora-nest-admin (alias nest-admin trong network)
```

Container override: `DB_HOST=db`, `REDIS_HOST=redis`, `PORT=7001`.

Chỉ nest-admin + infra:

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d db redis minio liora-nest-admin
```

## Migrate & seed

nest-admin **không** tự migrate. Chạy từ root trước khi start app:

```bash
pnpm db:migration:run    # baseline + seed (nếu sys_user trống)
pnpm db:seed:validate    # kiểm tra admin user, roles, menus
```

Seed mặc định nằm trong migration `SeedInitialData1741000001000` (SQL: `docker/deploy/sql/nest_admin.pg.sql`).

## Stripe webhook (dev)

```bash
pnpm nx serve nest-admin-backend
stripe listen --forward-to http://localhost:7001/api/webhooks/stripe
# Copy whsec_... vào STRIPE_WEBHOOK_SECRET trong .env, restart serve
```

## Build production

```bash
pnpm nx build nest-admin-backend
# Output: dist/apps/nest-admin-backend
```

## Tài liệu

- [README root](../../README.md)
- [Database / migrations](../../libs/database/README.md)
- [Docker stack](../../docker/README.md)
- [Supabase auth](../../libs/supabase/workflow.md)