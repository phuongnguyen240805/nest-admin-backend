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

## CRM Hybrid (Twenty-inspired)

CRM chạy **trong cùng process** `ladipage-backend` — không deploy Twenty microservice.

| Package / module | Vai trò |
|----------------|---------|
| `libs/crm-core` | Logic nghiệp vụ (person, pipeline, activity, custom fields, enterprise objects) |
| `libs/database` entities `crm_*` | Schema PostgreSQL |
| `src/modules/crm` | REST controllers + facade v1/v2 |

### Feature flag

```env
CRM_ENABLED=false   # default — dùng bảng lp_* (customers, companies)
CRM_ENABLED=true    # sau migrate — dùng crm_person, crm_company, ...
```

### API routes

| Route | Phase | Ghi chú |
|-------|-------|---------|
| `GET/POST /api/crm/customers` | 3+ | Facade → `crm_person` khi flag on |
| `GET/POST /api/crm/companies` | 3+ | Facade → `crm_company` |
| `GET /api/crm/pipelines/default` | 4+ | Cần `CRM_ENABLED=true` |
| `GET/POST /api/crm/opportunities` | 4+ | Deals + Kanban |
| `GET/POST /api/crm/tasks`, `/notes`, `/activities` | 4+ | Timeline tự động |
| `GET/POST /api/crm/custom-fields` | 7+ | Pro tier quota |
| `GET/POST /api/crm/objects` | 8+ | Enterprise / Lifetime only |
| `GET/POST /api/crm/objects/:slug/records` | 8+ | JSONB dynamic records |

### Migrate & cutover

```bash
pnpm db:migration:run
pnpm db:migrate-crm -- --dry-run   # preview
pnpm db:migrate-crm                # migrate lp_* → crm_*
# Sau đó: CRM_ENABLED=true + restart
```

Chi tiết: [crm-architecture.md](./crm-architecture.md), [plan-crm.md](../../plan-crm.md).

### CRM smoke test

```bash
node scripts/db/ladipage-tenant-smoke-test.js
```

Script kiểm tra auth, ecom auto-link customer, và CRM endpoints (~20 tests khi `CRM_ENABLED=true`).

## Tài liệu

- [README root](../../README.md)
- [CRM architecture](./crm-architecture.md)
- [CRM plan](../../plan-crm.md)
- [nest-admin](../nest-admin-backend/README.md)
- [Docker](../../docker/README.md)
- [Supabase auth](../../libs/supabase/workflow.md)