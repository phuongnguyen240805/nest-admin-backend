# CRM Architecture — Hybrid Twenty-inspired (Ladipage-native)

> **Status**: Phase 9 — Production grade (Phases 0–9 complete)
> **Date**: 2026-06-20
> **Goal**: Define clean, rollback-safe CRM domain inside `ladipage-backend` only. No Twenty server, no GraphQL CRM, no Supabase RLS in MVP.

## 1. Core Principles (Bắt buộc)

1. **Tenant scoping**: Mọi bảng CRM dùng cột `tenantId` (integer). Dùng `TenantContextService` + `TenantGuard` từ `@liora/nest-core`.
   - `organizationId` (string) **chỉ** dùng cho JWT claims + Billing/Organization bridge.
   - Không dùng `workspace_id` UUID, không schema-per-tenant, không RLS Supabase cho MVP.

2. **API contract**: REST thuần tại `/api/crm/*`.
   - Response luôn theo format `ResOp`: `{ code: number, message: string, data: T }`.
   - **Không** triển khai GraphQL cho CRM trong các phase MVP.

3. **Multi-tenancy**: Application-level filter trong service (giữ nguyên pattern `TenantScopedService` + `tenantWhere`).
   - RLS Supabase là phase sau (tùy chọn, không thuộc MVP).

4. **ID strategy**:
   - `crm_person.id`, `crm_company.id`, ... = **UUID** (v4).
   - Legacy data (`lp_customer` int id) được map qua bảng `crm_id_map` trong quá trình cutover.
   - FE contract giữ `id: string` (hỗ trợ cả number hiện tại lẫn UUID sau).

5. **Feature flag (rollback)**: `CRM_ENABLED` (boolean, default `false`).
   - `false` → dùng hệ thống hiện tại (`lp_*` + `CustomerService` cũ).
   - `true` → route sang services mới từ `CrmCoreModule` (`PersonService`...).
   - Cho phép rollback tức thì bằng cách đổi env + restart.

6. **Twenty reference only**:
   - Chỉ tham chiếu design (field names, composite types, activity pattern, dedup logic).
   - **Rewrite hoàn toàn** trong NestJS + TypeORM.
   - **Không** import runtime package từ `twenty/` (twenty-shared, twenty-orm, metadata engine...).
   - Không copy `GlobalWorkspaceOrmManager` hay dynamic metadata.

7. **Single deploy**: Toàn bộ CRM logic nằm trong process `ladipage-backend` (cùng Ecom, Dashboard, Analytics). Không microservice Twenty.

## 2. Module Structure (Mục tiêu cuối)

```
apps/ladipage-backend/
├── src/modules/crm/               # Thin HTTP layer (giữ nguyên routes hiện tại)
│   ├── crm.module.ts              # import CrmCoreModule khi cần
│   ├── controllers/...
│   ├── crm.facade.ts              # map giữa lp_* và crm_* DTO
│   └── guards/crm-enabled.guard.ts
│
libs/
├── crm-core/                      # (Phase 1+) Domain logic, services, utils
│   └── src/
│       ├── crm-core.module.ts
│       ├── services/
│       │   ├── person.service.ts
│       │   ├── company.service.ts
│       │   ├── opportunity.service.ts
│       │   └── ...
│       └── utils/                 # port từ contact-creation-manager (rewrite)
└── database/src/
    ├── entities/crm/              # TypeORM entities cho crm_*
    └── migrations/                # 1753000002000-crm-*.ts … 6000-crm-enterprise.ts
```

Các module khác (ecom-store, dashboard, analytics) **chỉ** gọi qua service interface từ CrmCore (không query bảng trực tiếp).

## 3. Schema CRM (Twenty-inspired, Ladipage-native)

### 3.1. Core Entities (Phase 2+)

| Bảng                    | Thay thế              | Ghi chú |
|-------------------------|-----------------------|---------|
| `crm_person`           | `lp_customer`        | UUID PK, JSONB emails/phones, tsvector search, soft delete |
| `crm_company`          | `lp_company`         | UUID PK, domain, links |
| `crm_person_company`   | `lp_customer_company`| M:N |
| `crm_opportunity`      | (mới)                | stage, amount (currency jsonb), closeDate, person/company link |
| `crm_pipeline`         | (mới)                | per tenant default pipeline |
| `crm_pipeline_stage`   | (mới)                | ordered stages |
| `crm_task`             | (mới)                | assignee, due, targets |
| `crm_note`             | (mới)                | rich content |
| `crm_activity`         | (mới)                | Timeline — auto log mọi thay đổi |
| `crm_custom_field_def` | `lp_customer_custom_field` | normalized |
| `crm_custom_field_value` | ...                | |
| `crm_id_map`           | (mới)                | legacy int → uuid (cho migration) |

**Common columns** (kế thừa TenantScoped + soft delete):
- `id` uuid primary key
- `tenantId` integer NOT NULL (index)
- `createdAt`, `updatedAt`, `deletedAt`
- `createdBy`, `updatedBy` (optional actor)
- `searchVector` tsvector (cho Person/Company/Opp)

### 3.2. Simplified Composite Types (JSONB — inspired từ Twenty)

```ts
// emails
[{ value: string, isPrimary?: boolean }]

// phones
[{ value: string, isPrimary?: boolean }]

// currency (amount)
{ amountMicros: number, currencyCode: 'VND' | 'USD' }

// links
{ url?: string, label?: string }
```

### 3.3. Ecom Integration (Phase 5)

```sql
ALTER TABLE lp_order 
  ADD COLUMN person_id UUID NULL;

CREATE INDEX idx_lp_order_tenant_person 
  ON lp_order ("tenantId", person_id);
```

Giữ snapshot fields (`customerName`, `customerPhone`, `customerEmail`) để audit.
FK chính: `person_id` (khi flag on).

### 3.4. Enterprise Custom Objects (Phase 8)

| Bảng | Mục đích |
|------|----------|
| `crm_object_definition` | Custom object slug, label (Enterprise tier) |
| `crm_field_definition` | Field metadata per object |
| `crm_dynamic_record` | `data` JSONB + `tenantId` + GIN index |

- REST: `GET/POST /api/crm/objects`, `GET/POST /api/crm/objects/:slug/records`
- `EnterpriseGuard` — tier `enterprise` hoặc `lifetime`
- Quota: enterprise = 10 objects, 10k records/object; lifetime = unlimited
- Không dùng full metadata engine như Twenty

## 4. Field Mapping (Twenty reference → Liora CRM)

**Person / Customer**

| Twenty (PersonWorkspaceEntity) | Liora CRM (`crm_person`) | Ghi chú |
|--------------------------------|-----------------------------|---------|
| name: FullNameMetadata        | name (text) + firstName/lastName optional | Giữ đơn giản ban đầu |
| emails: EmailsMetadata        | emails jsonb[]             | - |
| phones: PhonesMetadata        | phones jsonb[]             | Thay thế phone cũ |
| company                       | via crm_person_company     | M:N |
| jobTitle                      | job_title (text)           | Optional |
| timelineActivities            | crm_activity (target)      | - |

**Opportunity**

| Twenty                          | Liora                           |
|--------------------------------|---------------------------------|
| name, amount (Currency), closeDate, stage | Tương tự + owner (workspace member) |
| pointOfContact (Person)        | person_id                       |
| company                        | company_id                      |

**Activity**

- `crm_activity` ~ `TimelineActivityWorkspaceEntity`
- `happensAt`, `name`, `properties` (json), `linkedRecordId`, `linkedObjectMetadataId` (simplified)

## 5. Feature Flag & Coexistence Strategy

```env
CRM_ENABLED=false   # default → dùng lp_* + services hiện tại
```

- Controllers CRM hiện tại (và facade sau) sẽ kiểm tra flag để quyết định delegate.
- Services cũ (`CustomerService` trong modules/crm) vẫn giữ nguyên cho v1.
- `CrmCoreModule` export `PersonService`, `CompanyService`...
- Data song song trong phase transition (không dual-write vĩnh viễn).

Rollback:
1. Đổi `CRM_ENABLED=false`
2. Restart ladipage-backend
3. (Optional) Chạy script reverse nếu cần

## 6. Exclusions (MVP — không làm)

- GraphQL resolvers cho CRM objects
- Supabase Row Level Security (RLS)
- Email / Calendar / Messaging sync (để phase integration riêng)
- Dynamic runtime metadata engine (thay bằng JSONB Enterprise + fixed entities)
- Custom object versioning như Twenty apps

## 7. Security & Access

- JwtAuthGuard + RbacGuard (global)
- TenantGuard (per business route)
- Billing guards (subscription tier) cho custom fields / objects sau
- Không thay đổi auth flow hiện tại

## 8. Migration & Cutover Overview (sau Phase 0)

**Schema migrations** (`libs/database/src/migrations/`):

| File | Nội dung |
|------|----------|
| `1753000002000-crm-core.ts` | `crm_person`, `crm_company`, `crm_person_company` |
| `1753000003000-crm-sales.ts` | pipeline, opportunity, task, note, activity |
| `1753000004000-crm-order-person.ts` | `lp_order.person_id`, `crm_id_map` |
| `1753000005000-crm-custom-fields.ts` | custom field def + values |
| `1753000006000-crm-enterprise.ts` | custom objects JSONB |

> Class name TypeORM bên trong (vd. `CrmV2Core1753000002000`) **không đổi** sau khi migration đã chạy — chỉ đổi tên file.

- Phase 2: Tạo bảng crm_* + entities (chưa move data)
- Phase 6: Script migrate + backfill + flag flip
- Giữ `lp_*` tables (deprecated, không xóa ngay)

## 9. Testing & Verification (Phase 0)

- `ladipage-tenant-smoke-test.js` phải pass (auth + ít nhất 1 CRM route)
- JWT phải chứa cả `tenantId` (int) và `organizationId` (string)
- Swagger / REST contract giữ nguyên

## 10. TenantGuard / 403 Verification (Phase 0)

**Current state (verified 2026-06-20):**
- `TenantInterceptor` (global) + `TenantRequestBootstrapService` populate CLS + `request.org` + `request.tenantId`.
- `TenantGuard` (per controller) checks `tenantContext.isReady()` + `request.org`.
- Tất cả 6 controllers trong `crm/` đã gắn `@UseGuards(TenantGuard)`.
- Smoke test đã exercise: `GET /crm/customers`, tạo order (tự link customer), JWT claims.
- Error messages rõ ràng: "Workspace context is required...", "Tenant ID is required".
- **Không cần sửa** TenantGuard hay TenantInterceptor (shared với nest-admin). Setup hiện tại đã ổn định cho business routes (CRM, Ecom, Dashboard...).
- Khi triển khai Phase 3+ (`CrmFacade`), vẫn giữ nguyên guard + interceptor flow.

Nếu smoke test sau này báo 403 trên CRM route sau khi thêm flag: kiểm tra provisioning (organization + tenant mapping) trước khi touch guard.

## 11. GraphQL & RLS Exclusion Confirmation

- Ladipage-backend **không có** `@nestjs/graphql`, Apollo, hay GraphQL module nào.
- Không có `CREATE POLICY` hay RLS setup trên các bảng CRM (`lp_*` hay tương lai `crm_*`).
- Đã lock trong Phase 0: **Không thêm GraphQL CRM, không bật RLS** cho MVP theo đúng plan-crm.md.

## 12. Phase 8–9 Status

**Phase 8 (Enterprise custom objects) — Done**
- Migration `1753000006000-crm-enterprise.ts`
- `CrmObjectDefinitionService`, `CrmDynamicRecordService` trong `libs/crm-core`
- `EnterpriseGuard` + controllers `/api/crm/objects`, `/api/crm/objects/:slug/records`
- Unit tests: `dynamic-record-validation`, `object-definition.service` quota

**Phase 9 (Hardening) — Done**
- `ladipage-tenant-smoke-test.js` mở rộng CRM (~20 tests khi `CRM_ENABLED=true`)
- `libs/api-types/src/crm.ts` sync opportunity, activity, enterprise types
- README CRM section + runbook §13

## 13. References & Next Steps

- Xem `plan-crm.md` (root) cho toàn bộ phases.
- Phase 10 (tùy chọn): email/calendar integrations.

## 14. Phase 6 — Migration & Cutover Runbook

### Migrate data (one-time per environment)

```bash
pnpm db:migration:run              # ensure crm_* tables exist
node scripts/db/migrate-lp-crm-to-crm.js --dry-run   # preview
pnpm db:migrate-crm             # run migration
pnpm db:migrate-crm -- --validate                  # count check only
```

Script migrates: `lp_company` → `crm_company`, `lp_customer` → `crm_person`, `crm_id_map`, `lp_order.person_id` backfill, `lp_customer_company` → `crm_person_company`.

### Cutover

1. Run migration script — validation must show `OK` per tenant.
2. Set `CRM_ENABLED=true`, restart `ladipage-backend`.
3. `lp_*` tables become **read-only** (writes blocked via `assertLpCrmWritable`).

### Rollback

1. Set `CRM_ENABLED=false`, restart.
2. `crm_id_map` retained — safe to re-run migration script.
3. `lp_*` data unchanged; new CRM-only records stay in `crm_*` (no auto reverse).

## 10. References

- `plan-crm.md` (root)
- Twenty entity design (chỉ tham khảo, không copy code)
- `@liora/nest-core` TenantModule, TenantScopedService
- Current `lp_*` entities + migration 1752000002000-crm.ts

---

**Kết quả Phase 0**:
- Tài liệu này (crm-architecture.md) được tạo và lock.
- tenantId / organizationId được chốt rõ ràng.
- `CRM_ENABLED` được thêm vào `.env.example`.
- Xác nhận: không GraphQL CRM, không RLS trong MVP.
- Không có thay đổi code không liên quan.