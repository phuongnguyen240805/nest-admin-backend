# Liora Monorepo — Backend

Monorepo NestJS cho nền tảng Liora: admin control plane, LadiPage landing builder, và các service đồng bộ nội bộ. Business logic tập trung ở `libs/nest-core`, database dùng **PostgreSQL / Supabase** với **TypeORM**.

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Runtime | Node.js 20+, pnpm 9, Nx 22 |
| Framework | NestJS 11, Fastify |
| ORM / DB | TypeORM, PostgreSQL 16 (Supabase production) |
| Cache / Queue | Redis 7, Bull |
| Auth | Supabase Auth (hybrid) + Nest JWT nội bộ (RBAC) |
| Storage | MinIO (S3-compatible), AWS SDK |
| Realtime | Socket.IO + Redis adapter, SSE |
| Billing | Stripe (webhook trong nest-admin) |
| AI Agent | Librefang (tùy chọn, profile Docker) |
| Docs | Swagger (`/docs`) |

## Cấu trúc monorepo

```
liora-monorepo/
├── apps/
│   ├── nest-admin-backend/   # Control plane — RBAC, billing, system (port 7001)
│   ├── ladipage-backend/     # Landing page builder API (port 7002)
│   └── donut-sync-backend/   # Đồng bộ nội bộ với nest-admin (port 3000)
├── libs/
│   ├── nest-core/            # Modules dùng chung: Auth, Billing, Tenant, System…
│   ├── database/             # Entities, migrations, TypeORM config
│   ├── supabase/             # Supabase client + auth service
│   ├── dto/, shared/, librefang-client/
├── docker/                   # docker-compose stack local
├── scripts/db/               # Migration, validate, seed, smoke test
└── scripts/migration/        # Tooling cutover MySQL→PG (tùy chọn)
```

Chi tiết từng app: [nest-admin](apps/nest-admin-backend/README.md) · [ladipage](apps/ladipage-backend/README.md) · [donut-sync](apps/donut-sync-backend/README.md) · [database](libs/database/README.md) · [docker](docker/README.md)

## Luồng hệ thống

### Kiến trúc tổng quan

```mermaid
flowchart TB
  subgraph Client
    FE[Frontend / Mobile]
    SB_SDK[Supabase JS SDK]
  end

  subgraph Apps
    NA[nest-admin :7001]
    LP[ladipage :7002]
    DS[donut-sync :3000]
  end

  subgraph Core["libs/nest-core"]
    AUTH[AuthModule]
    BILL[BillingModule]
    SYS[SystemModule]
    TEN[TenantModule]
  end

  subgraph Infra
    PG[(PostgreSQL / Supabase)]
    RD[(Redis)]
    S3[(MinIO / S3)]
    SBA[Supabase Auth]
  end

  FE --> SB_SDK
  SB_SDK --> SBA
  FE --> NA & LP
  NA & LP --> Core
  DS --> NA
  Core --> PG & RD & S3
  AUTH --> SBA
```

### Auth hybrid (Supabase → Nest JWT)

Khi `USE_SUPABASE_AUTH=true` (mặc định khuyến nghị):

1. **Đăng ký** — `POST /api/auth/register` → Supabase `signUp` → tạo `sys_user` với `supabase_user_id`.
2. **Đăng nhập** — Client gọi `supabase.auth.signInWithPassword()` → nhận Supabase `access_token`.
3. **Exchange** — `POST /api/auth/exchange { supabaseAccessToken }` → Nest verify qua Supabase → phát **JWT nội bộ** (RBAC, Redis cache).
4. **API** — Mọi request dùng Bearer Nest JWT (`JwtAuthGuard` + `RbacGuard`).

Khi `USE_SUPABASE_AUTH=false`: dùng legacy `POST /api/auth/login` (username/password).

Chi tiết: [libs/supabase/workflow.md](libs/supabase/workflow.md)

### Database

- Schema `sys_*` dùng **int PK**; `sys_user.supabase_user_id` (uuid) liên kết Supabase Auth.
- Migration baseline + seed qua TypeORM (`libs/database/src/migrations/`).
- Production: Supabase PostgreSQL; local: container `db` hoặc Supabase dev project.

## Yêu cầu

- Node.js 20+
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker & Docker Compose (cho stack local)
- Tài khoản Supabase (nếu dùng auth + DB cloud)

## Cài đặt nhanh

```bash
cp .env.example .env
# Chỉnh DATABASE_URL, Supabase keys, JWT secrets

pnpm install
```

## Database: migrate & seed

Chạy từ **root** monorepo (đọc `.env`):

```bash
# 1. Chạy migrations (baseline schema + seed nếu DB trống)
pnpm db:migration:run

# 2. Kiểm tra schema
pnpm db:validate

# 3. Kiểm tra dữ liệu seed (user, role, menu…)
pnpm db:seed:validate

# Xem trạng thái migration
pnpm db:migration:show
pnpm db:state
```

Nếu schema đã tồn tại nhưng `typeorm_migrations` trống (lỗi `relation already exists`):

```bash
pnpm db:repair
pnpm db:migration:run
```

Chi tiết migrations, seed SQL, troubleshooting: [libs/database/README.md](libs/database/README.md)

### DATABASE_URL theo môi trường

| Môi trường | `DATABASE_URL` | Ghi chú |
|------------|----------------|---------|
| Docker Postgres local | `postgresql://postgres:postgres@localhost:5432/liora_db` | `DB_SSL=false` |
| Supabase direct (migrate) | `...@db.<ref>.supabase.co:5432/postgres` | Port 5432, `DB_SSL=true` |
| Supabase pooler (runtime) | `...@pooler.supabase.com:6543/postgres?pgbouncer=true` | Không dùng cho migrate |

## Chạy local (không Docker app)

Cần Redis và PostgreSQL đang chạy (container hoặc Supabase). Trong `.env` khi chạy trên host:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6381          # port map từ docker redis
DB_HOST=localhost
DB_SSL=false             # nếu dùng postgres container local
```

```bash
# Terminal 1 — Redis + Postgres (nếu chưa có)
docker compose -f docker/docker-compose.yml --env-file .env up -d db redis minio

# Terminal 2 — nest-admin
pnpm nx serve nest-admin-backend
# → http://localhost:7001/api · Swagger http://localhost:7001/docs

# Terminal 3 — ladipage
pnpm dev:ladipage
# → http://localhost:7002/api · Swagger http://localhost:7002/docs
```

Health check ladipage: `GET http://localhost:7002/api/health/ready`

## Chạy Docker (full stack)

```bash
pnpm docker:up      # build + up -d
pnpm docker:ps      # trạng thái services
pnpm docker:logs    # tail logs
pnpm docker:down    # dừng stack
```

| Service | Port | URL |
|---------|------|-----|
| nest-admin | 7001 | http://localhost:7001/api |
| ladipage | 7002 | http://localhost:7002/api |
| donut-sync | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | `liora_db` |
| Redis | 6381→6379 | host `redis` trong network |
| MinIO | 9002 / 9003 | S3 API / Console |

Chi tiết Docker, profile librefang, WSL/Windows path: [docker/README.md](docker/README.md)

**Lưu ý:** Migrate/seed chạy từ **host** (root), không tự động trong container app. Sau `docker:up`, vẫn cần `pnpm db:migration:run` nếu DB mới.

## Scripts hữu ích

| Script | Mô tả |
|--------|-------|
| `pnpm build:libs` | Build libs (database, nest-core, dto, shared) |
| `pnpm db:smoke` | Smoke test DB connectivity |
| `pnpm db:api:test` | Smoke test API endpoints |
| `pnpm migration:backfill:apply` | Liên kết `sys_user` ↔ Supabase users |
| `pnpm graph` | Nx dependency graph |

## Kiểm tra sau khi chạy

```bash
curl http://localhost:7001/docs/json | head -c 200
curl http://localhost:7002/api/health/ready
pnpm db:seed:validate
```

Swagger: authorize bằng Nest JWT từ `POST /api/auth/exchange` (sau Supabase `signInWithPassword`).

## Tài liệu liên quan

- [Auth workflow](libs/supabase/workflow.md)
- [Billing / Stripe](libs/nest-core/src/modules/billing/billing-structure.md)
- Cấu trúc thư mục: `tree -L 5 -I "node_modules|dist|.git"`