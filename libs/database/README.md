# @liora/database

Thư viện TypeORM dùng chung: entities, migrations, constraints (`@Unique`, `@EntityExist`), `DatabaseModule`.

Database production: **PostgreSQL / Supabase** (`DB_TYPE=postgres`). MySQL chỉ còn cho legacy rollback (profile Docker `mysql`).

## Cấu trúc

```
libs/database/src/
├── migrations/
│   ├── 1741000000000-baseline-postgres.ts   # Schema sys_* + tenants
│   └── 1741000001000-seed-initial-data.ts   # Seed từ nest_admin.pg.sql
├── config/database.config.ts
├── data-source.ts                           # TypeORM CLI entry
├── database.module.ts
└── base.entity.ts
```

Seed SQL gốc: `docker/deploy/sql/nest_admin.pg.sql`

## Migrations

### Chạy migration

Từ **root** monorepo (cần `.env` với `DATABASE_URL`):

```bash
pnpm db:migration:run
```

Script: `scripts/db/run-migrations.js` — kết nối `data-source.ts`, chạy `runMigrations({ transaction: 'each' })`.

### Xem / revert

```bash
pnpm db:migration:show      # danh sách đã apply
pnpm db:migration:revert    # revert migration cuối
```

### Tạo migration mới

```bash
pnpm db:migration:generate --name=my-change-name
# Tạo file trong libs/database/src/migrations/
```

### Repair (schema có sẵn, bảng migration trống)

Khi gặp `relation "sys_user" already exists` nhưng `typeorm_migrations` rỗng:

```bash
pnpm db:validate          # xác nhận schema đúng
pnpm db:repair            # ghi nhận baseline đã apply
pnpm db:migration:run     # chạy seed và migrations còn lại
```

`pnpm db:repair` chạy `scripts/db/repair-migration-state.js`.

## Seed data

Seed nằm trong migration `SeedInitialData1741000001000`:

- Chỉ chạy khi `sys_user` **trống** (idempotent).
- Đọc `docker/deploy/sql/nest_admin.pg.sql` — INSERT user admin, roles, menus, dept, dict…

### Validate seed

```bash
pnpm db:seed:validate
```

### Convert seed MySQL → PostgreSQL (tooling)

```bash
pnpm db:seed:convert
# Output cập nhật nest_admin.pg.sql từ nguồn MySQL
```

## DATABASE_URL

| Use case | URL | `DB_SSL` |
|----------|-----|----------|
| Postgres container local | `postgresql://postgres:postgres@localhost:5432/liora_db` | `false` |
| Supabase migrate (direct) | `...@db.<ref>.supabase.co:5432/postgres` | `true` |
| Supabase runtime (pooler) | `...@pooler.supabase.com:6543/postgres?pgbouncer=true` | `true` |

**Migrate luôn dùng direct connection (5432), không dùng pooler.**

Trong Docker app containers: `DB_HOST=db` được override; migrate từ host vẫn dùng `localhost:5432`.

## Scripts kiểm tra

| Lệnh | Script | Mô tả |
|------|--------|-------|
| `pnpm db:validate` | `validate-schema.js` | So khớp schema với baseline |
| `pnpm db:state` | `check-db-state.js` | Trạng thái DB + migrations |
| `pnpm db:smoke` | `smoke-test.js` | Connectivity smoke |
| `pnpm db:api:test` | `api-smoke-test.js` | API smoke (cần app chạy) |

## Supabase user linkage (tùy chọn)

Sau migrate + seed, liên kết `sys_user.supabase_user_id` với `auth.users`:

```bash
pnpm migration:backfill          # dry-run
pnpm migration:backfill:apply    # apply
```

## Dùng trong app

```typescript
import { DatabaseModule } from '@liora/database';
```

`DatabaseModule` đọc config từ `@liora/nest-core/config` + env (`DB_TYPE`, `DATABASE_URL`, `DB_SYNCHRONIZE=false`).

**Không bật** `synchronize: true` trên production — luôn dùng migrations.

## Tài liệu

- [README root](../../README.md)
- [Supabase auth](../supabase/workflow.md)
- [Docker / deploy SQL](../../docker/README.md)