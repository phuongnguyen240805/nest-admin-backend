# Docker (local dev)

Chạy toàn bộ stack trên Docker Compose (network `liora-network`).

## Quick start

```bash
cp .env.example .env
# Chỉnh DATABASE_URL, Supabase keys, JWT secrets

pnpm install

# Migrate + seed TRƯỚC hoặc SAU khi bật db container
docker compose -f docker/docker-compose.yml --env-file .env up -d db
pnpm db:migration:run && pnpm db:validate && pnpm db:seed:validate

pnpm docker:up
```

## Services & URLs

| Service | Container | Port | URL |
|---------|-----------|------|-----|
| **nest-admin** | liora-nest-admin-dev | 7001 | API `http://localhost:7001/api` · Swagger `http://localhost:7001/docs` |
| **ladipage** | liora-ladipage-dev | 7002 | API `http://localhost:7002/api` · Swagger `http://localhost:7002/docs` |
| **donut-sync** | liora-donut-sync-dev | 3000 | `http://localhost:3000` |
| **PostgreSQL** | liora-postgres-dev | 5432 | `postgresql://postgres:postgres@localhost:5432/liora_db` |
| **Redis** | liora-redis-dev | 6381→6379 | Host: `redis://127.0.0.1:6381` · Trong network: `redis://redis:6379` |
| **MinIO** | — | 9002/9003 | S3 API `http://localhost:9002` · Console `http://localhost:9003` |
| **librefang** (profile) | liora-librefang-dev | 4545 | `http://localhost:4545` |

## Luồng khởi động khuyến nghị

```mermaid
flowchart TD
  A[cp .env.example .env] --> B[docker up db redis minio]
  B --> C[pnpm db:migration:run]
  C --> D[pnpm db:validate]
  D --> E[pnpm docker:up]
  E --> F[curl health + Swagger]
```

1. Bật infra (`db`, `redis`, `minio`).
2. Migrate + seed từ **host** (root monorepo).
3. `pnpm docker:up` — build và start app containers.
4. Kiểm tra health / Swagger.

App containers **không** tự chạy migration.

## Database: Docker Postgres vs Supabase

### Option A — Postgres container (mặc định compose)

`.env`:

```env
DB_TYPE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/liora_db
DB_HOST=localhost
DB_SSL=false
```

Trong container app: compose override `DB_HOST=db`, `REDIS_HOST=redis`.

### Option B — Supabase cloud

`.env`:

```env
DB_TYPE=postgres
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

- **Migrate từ host:** dùng direct URL port `5432` (`db.<ref>.supabase.co`), không pooler.
- **Runtime app:** có thể dùng pooler port `6543` + `?pgbouncer=true`.
- Có thể **tắt** service `db` trong compose nếu chỉ dùng Supabase:

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d redis minio liora-nest-admin liora-ladipage
```

## Migrate & seed trên Docker

Chạy từ root (Node trên host), không trong container:

```bash
pnpm db:migration:run
pnpm db:seed:validate
```

Nếu DB container mới, volume `postgres_data` trống → baseline + seed chạy đầy đủ.

Nếu lỗi `relation already exists`:

```bash
pnpm db:repair && pnpm db:migration:run
```

SQL seed tham chiếu: `docker/deploy/sql/nest_admin.pg.sql`

## Biến môi trường trong container

| Service | Override quan trọng |
|---------|---------------------|
| liora-nest-admin | `DB_HOST=db`, `REDIS_HOST=redis`, `PORT=7001`, `S3_ENDPOINT=http://minio:9000` |
| liora-ladipage | `REDIS_HOST=redis`, `LADIPAGE_PORT=7002`, `S3_ENDPOINT=http://minio:9000` |
| donut-sync | `BACKEND_INTERNAL_URL=http://nest-admin:7001` |

File `.env` được mount read-only vào `/app/.env`.

## Chỉ chạy một phần stack

```bash
# Ladipage + infra (DB Supabase trên .env)
docker compose -f docker/docker-compose.yml --env-file .env up -d redis minio liora-ladipage

# Librefang (tránh conflict port 4545 nếu đã có instance khác)
docker compose -f docker/docker-compose.yml --env-file .env --profile librefang up -d librefang
# nest-admin/ladipage: LIBREFANG_API_URL=http://host.docker.internal:4545
```

## WSL / Windows (Docker Desktop)

- Repo trên `D:\...` trong WSL: path `/mnt/d/...` — compose mount volumes hoạt động bình thường.
- Node từ Windows (tùy chọn): `"/mnt/c/Program Files/nodejs/node.exe" scripts/db/run-migrations.js`
- `host.docker.internal` — Librefang chạy ngoài compose.

## Lệnh pnpm wrapper

```bash
pnpm docker:config   # validate compose + .env
pnpm docker:up       # up -d --build
pnpm docker:down
pnpm docker:ps
pnpm docker:logs
```

## Kiểm tra

```bash
pnpm docker:ps
curl http://localhost:7002/api/health/ready
curl -s http://localhost:7002/docs/json | head -c 200
curl -s http://localhost:7001/docs/json | head -c 200
```

Swagger ladipage/nest-admin: Authorize Bearer JWT từ `POST /api/auth/exchange`.

## Production (Coolify)

Dùng `docker-compose.prod.yml`. Set env trên UI; `NODE_ENV=production` → app bỏ qua file `.env` trong image. Migrate chạy CI/CD hoặc job riêng trước deploy.

## Tài liệu

- [README root](../README.md)
- [Database migrations](../libs/database/README.md)
- [Supabase auth](../libs/supabase/workflow.md)