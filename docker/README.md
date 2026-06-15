# Docker (local dev)

Chạy toàn bộ stack trên Docker Compose (cùng network `liora-network`).

## Quick start

```bash
cp .env.example .env
# Chỉnh DATABASE_URL (Supabase) và Supabase keys trong .env

pnpm docker:up
```

## Services & URLs

| Service | Port | URL |
|---------|------|-----|
| **nest-admin** | 7001 | API `http://localhost:7001/api` · Swagger `http://localhost:7001/docs` |
| **ladipage** | 7002 | API `http://localhost:7002/api` · Swagger `http://localhost:7002/docs` |
| **donut-sync** | 3000 | `http://localhost:3000` |
| **PostgreSQL** | 5432 | local container (hoặc dùng Supabase qua `DATABASE_URL`) |
| **Redis** | 6381→6379 | `redis://redis:6379` trong network |
| **MinIO** | 9002/9003 | S3 API / Console |

## LadiPage Swagger

Sau `docker compose up`, mở **http://localhost:7002/docs** để xem:

- **LadiPage domain**: `publish`, health…
- **nest-core đã import**: Auth, Billing/Stripe, System RBAC, Tenant, Netdisk, Agent, SSE…

Authorize bằng Bearer JWT từ `POST /api/auth/exchange` (sau Supabase `signInWithPassword`).

## Chỉ chạy một phần stack

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d redis minio liora-ladipage
```

## Kiểm tra

```bash
pnpm docker:ps
curl http://localhost:7002/api/health/ready
curl -s http://localhost:7002/docs/json | head -c 200
```

## Production (Coolify)

Set env trên UI; `NODE_ENV=production` → app bỏ qua file `.env` trong image.