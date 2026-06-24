# Kế hoạch W2-1 — Pilot RPC Board LadiWork (trả 200)

> **Mục tiêu:** `POST /ladiflow/1.0/crm-pipeline/list` và các route board bắt buộc trả **200** (không `NotImplementedException`), đủ để FE mở `/ladiwork/board/6a3a8d71da6cd800128221ee`.  
> **Chiến lược:** **Fixture-seed pilot** — seed từ contract fixtures CDP, chưa cần migration `lp_crm_*` (W1 làm sau).  
> **Thời gian:** 1–1.5 ngày · **2 PR** stack  
> **Ngày:** 2026-06-24

---

## 1. Phạm vi board — route bắt buộc

Theo `plan-be-phase-bc-ladiwork-automation.md` §6 và fixtures `phaseB/`:

| Ưu tiên | Route | Lý do |
|---------|-------|-------|
| P0 | `crm-pipeline/list` | Load pipeline + stages (cột Kanban) |
| P0 | `crm-deal/list` | Deal cards theo `pipeline_stage_id` |
| P0 | `crm-deal/get-summary` | Header tổng giá trị / số deal |
| P1 | `ladiwork-dashboard/config` | Bootstrap widget layout |
| P1 | `crm-pipeline/search` | Sidebar chọn pipeline |
| P2 | `crm-filter/get-system-filters` | Filter dropdown (có fixture) |

**W2-1 thuần** chỉ `crm-pipeline/list` + `search`. **Board 200** cần thêm 3 route P0 + 1 P1 → gói **W2-1+** (cùng sprint).

---

## 2. Kiến trúc đề xuất

```
LadiflowRpcController  POST /ladiflow/1.0/:resource/:action
        │
        ▼
LadiflowDispatcherService  handlers['crm-pipeline/list'] = ...
        │
        ▼
LadiworkRpcRegistrar (OnModuleInit)  ← PR-1
        │
        ├── PipelineService.list() / .search()
        ├── DealService.listByStage() / .getSummary()
        └── LadiworkDashboardService.config()
        │
        ▼
LadiworkSeedStore (in-memory, load từ fixtures phaseB)  ← pilot, không DB
        │
        ▼
pipeline.mapper.ts / deal.mapper.ts / dashboard.mapper.ts  → LpCrmPipeline shape
        │
        ▼
LadiflowResponseInterceptor  → { data, message: 'Thành công', code: 200 }
```

**Không dùng** `CrmPipelineService` (`libs/crm-core`) trực tiếp — schema Liora (`crm_pipeline` UUID) **khác** Ladipage (`_id` Mongo, 28 fields). Pilot dùng **adapter riêng** trong `modules/ladiwork/`.

---

## 3. PR stack (2 PR, ~4–6h mỗi PR)

### PR-BC-PILOT-01 — Registry + seed + PipelineService (W2-1 core)

| # | File | Việc |
|---|------|------|
| 1 | `ladiflow-rpc/ladiflow-dispatcher.service.ts` | Thêm `registerHandler(routeKey, handler)` public |
| 2 | `ladiwork/ladiwork-rpc.registrar.ts` | `OnModuleInit` inject dispatcher + services, register routes |
| 3 | `ladiwork/data/ladiwork-seed.store.ts` | Load JSON từ fixtures phaseB at startup (hoặc embed typed constant) |
| 4 | `ladiwork/services/pipeline.service.ts` | `list(body)`, `search(body)` — paginate in-memory |
| 5 | `ladiflow-rpc/mappers/ladiwork/pipeline.mapper.ts` | Bỏ identity — map seed record → `LpCrmPipeline` |
| 6 | `ladiwork/ladiwork.module.ts` | providers + exports PipelineService, LadiworkSeedStore |
| 7 | `ladiflow-rpc/ladiflow-rpc.module.ts` | `imports: [LadiworkModule]`, providers: `[LadiworkRpcRegistrar]` |

**Wire handlers:**
- `crm-pipeline/list`
- `crm-pipeline/search`

**DoD PR-01:**
```bash
curl -s -X POST http://localhost:3000/ladiflow/1.0/crm-pipeline/list \
  -H 'Content-Type: application/json' \
  -H 'owner-id: 6a2c26c92d543800211b5157' \
  -d '{"lang":"vi","page":1,"limit":100}' | jq '.code'
# → 200
```

---

### PR-BC-PILOT-02 — Deal + Dashboard + contract test (board 200)

| # | File | Việc |
|---|------|------|
| 1 | `ladiwork/services/deal.service.ts` | `listByStage(body)`, `getSummary(body)` |
| 2 | `ladiwork/services/ladiwork-dashboard.service.ts` | `config(body)` — trả widgets từ fixture |
| 3 | `mappers/ladiwork/deal.mapper.ts` | Map seed deal → `LpCrmDeal` |
| 4 | `mappers/ladiwork/dashboard.mapper.ts` | Map config widgets |
| 5 | `ladiwork-rpc.registrar.ts` | Register thêm 4 handlers |
| 6 | `test/contract/phaseB-ladiwork-board.contract.spec.ts` | Gọi dispatcher, assert keys vs fixture |

**Wire handlers:**
- `crm-deal/list`
- `crm-deal/get-summary`
- `ladiwork-dashboard/config`
- `crm-filter/get-system-filters` (optional stub từ fixture)

**DoD PR-02 (board):**
```bash
# Deal list stage 1
curl -s -X POST http://localhost:3000/ladiflow/1.0/crm-deal/list \
  -H 'owner-id: 6a2c26c92d543800211b5157' \
  -d '{"pipeline_id":"6a3a8d71da6cd800128221ee","pipeline_stage_id":"6a3a8d71da6cd800128221f0","filter_id":"3"}' \
  | jq '.data.deals | length'
# → >= 1

# Summary
curl -s -X POST http://localhost:3000/ladiflow/1.0/crm-deal/get-summary \
  -H 'owner-id: 6a2c26c92d543800211b5157' \
  -d '{"pipeline_id":"6a3a8d71da6cd800128221ee","mode":"kanban","full_stage":true}' \
  | jq '.code'
# → 200
```

---

## 4. Chi tiết implementation

### 4.1. `registerHandler` trên dispatcher

```typescript
// ladiflow-dispatcher.service.ts
registerHandler(routeKey: string, handler: LadiflowRpcHandler): void {
  this.handlers[routeKey] = handler;
}
```

Giữ `dispatch()` như cũ — chỉ thêm registration API.

### 4.2. `LadiworkSeedStore`

Nguồn seed (chọn 1):

| Cách | Ưu | Nhược |
|------|-----|-------|
| **A. Đọc fixture runtime** | Không duplicate data | Phụ thuộc path `test/contract/fixtures/` |
| **B. Embed `ladiwork-seed.data.ts`** | Production-safe | Duplicate khi fixture đổi |

**Khuyến nghị pilot:** **A** — `readFileSync` fixtures phaseB:
- `crm-pipeline__list.json` → `pipelines[]`
- `crm-deal__list.json` → `deals[]` keyed by `pipeline_stage_id`
- `crm-deal__get-summary.json` → summary template
- `ladiwork-dashboard__config.json` → widgets

Filter theo `owner-id` header (match `owner_id` trong seed).

### 4.3. `PipelineService.list(body)`

```typescript
interface ListBody {
  lang?: string;
  page?: number;
  limit?: number;
}

// Return shape (interceptor bọc nếu chưa có code/message):
{ total: number; limit: number; items: LpCrmPipeline[] }
```

Logic:
1. Lấy tất cả pipelines từ seed (filter `is_delete !== true`)
2. Paginate `page`/`limit` (default 1/100)
3. Mỗi item **phải có** `stages[]` embedded (từ fixture pipeline list)

### 4.4. `DealService.listByStage(body)`

Request từ fixture:
```json
{
  "pipeline_id": "6a3a8d71da6cd800128221ee",
  "filter_id": "3",
  "pipeline_stage_id": "6a3a8d71da6cd800128221f0"
}
```

Response shape (khớp fixture):
```json
{
  "deals": [...],
  "pipelines": [],
  "total": 1,
  "total_page": 1,
  "hasNext": false,
  "stages": [ /* 4 stages từ pipeline */ ]
}
```

**Quan trọng:** FE gọi `crm-deal/list` **mỗi cột** với `pipeline_stage_id` khác nhau — seed phải trả `deals: []` cho stage không có deal (không 404).

### 4.5. Mapper rules

- Field names **snake_case** + `_id` (Mongo style) — không camelCase
- `stages[].order_number` giữ nguyên từ CDP
- Không thêm field không có trong fixture (contract test sẽ so keys)

### 4.6. `LadiworkRpcRegistrar`

```typescript
@Injectable()
export class LadiworkRpcRegistrar implements OnModuleInit {
  constructor(
    private readonly dispatcher: LadiflowDispatcherService,
    private readonly pipelineService: PipelineService,
    private readonly dealService: DealService,
    private readonly dashboardService: LadiworkDashboardService,
  ) {}

  onModuleInit() {
    this.dispatcher.registerHandler('crm-pipeline/list', (body, ctx) =>
      this.pipelineService.list(body, ctx));
    // ...
  }
}
```

---

## 5. Testing

### 5.1. Unit tests (PR-01)

`pipeline.service.spec.ts`:
- list default → `total >= 1`, `items[0]._id === '6a3a8d71da6cd800128221ee'`
- list page 2 empty → `items: []`
- stages length === 4

### 5.2. Unit tests (PR-02)

`deal.service.spec.ts`:
- list stage `...21f0` → 1 deal
- list stage `...21f1` → `deals: []`
- getSummary → `summary.total_deals === 1`

### 5.3. Contract test (PR-02)

`phaseB-ladiwork-board.contract.spec.ts`:
- Bootstrap `TestingModule` với `LadiflowDispatcherService` + `LadiworkModule`
- Gọi `dispatch('crm-pipeline', 'list', fixture.request, ctx)`
- `expect(response).toMatchObject({ code: 200, data: { total: expect.any(Number), items: expect.any(Array) } })`
- Deep compare **required keys** của `items[0]` với fixture (không so timestamp chính xác)

### 5.4. Verify sau merge

```bash
rtk npx nx run ladipage-backend:build
rtk npx nx run ladipage-backend:test
# Target: ≥78 tests (72 hiện tại + ~6 mới)
```

---

## 6. Cấu hình FE proxy (manual smoke)

Để board hit local backend:

| FE config | Value |
|-----------|-------|
| API host override | `api.ladiflow.com` → `localhost:3000` |
| Header `owner-id` | `6a2c26c92d543800211b5157` (trial) |

**Smoke:** Mở `/ladiwork/board/6a3a8d71da6cd800128221ee` — Network tab chỉ thấy 200 cho 4 route P0.

---

## 7. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|------------|
| Seed fixture lệch production | Contract test so keys; re-export fixture khi CDP đổi |
| `owner-id` không khớp seed | Guard trả empty list thay vì 401 (pilot); log warning |
| FE gọi thêm route chưa wire | Stub empty 200 cho `crm-label/list-all`, `crm-organization/list` (có fixture) |
| Pilot in-memory không scale | PR tiếp theo W1-1 thay `LadiworkSeedStore` bằng TypeORM `lp_crm_*` |

---

## 8. PROMPT triển khai (copy-paste)

```
Triển khai W2-1+ pilot RPC Board LadiWork theo plans/plan-w2-1-ladiwork-board-pilot.md.

Phạm vi PR-BC-PILOT-01 + PR-BC-PILOT-02 (cùng branch nếu 1 session):
1. LadiflowDispatcherService.registerHandler()
2. LadiworkModule: LadiworkSeedStore (load fixtures phaseB), PipelineService, DealService, LadiworkDashboardService
3. LadiworkRpcRegistrar onModuleInit — wire 6 routes:
   crm-pipeline/list, crm-pipeline/search,
   crm-deal/list, crm-deal/get-summary,
   ladiwork-dashboard/config, crm-filter/get-system-filters
4. Implement pipeline.mapper.ts, deal.mapper.ts, dashboard.mapper.ts (bỏ TODO identity)
5. Unit tests pipeline + deal services
6. phaseB-ladiwork-board.contract.spec.ts — dispatcher integration

Contract truth:
- test/contract/fixtures/phaseB/crm-pipeline__list.json
- test/contract/fixtures/phaseB/crm-deal__list.json
- test/contract/fixtures/phaseB/crm-deal__get-summary.json
- test/contract/fixtures/phaseB/ladiwork-dashboard__config.json

Ràng buộc:
- Mọi lệnh shell dùng rtk
- Response RPC: { data, message: 'Thành công', code: 200 } (interceptor đã có)
- Không migration DB trong PR này
- Không dùng CrmPipelineService từ crm-core (schema khác)
- Sau xong: curl 4 route P0 trả 200 + nx test pass

Báo cáo: handlers wired count, tests added, curl output mẫu.
```

---

## 9. Sau pilot — bước tiếp (W1 + W2-3)

1. **W1-1** — `lp_crm_pipeline` + `lp_crm_deal` migration; seed từ fixture → DB
2. **Refactor** `LadiworkSeedStore` → repository đọc DB
3. **W2-3** — 6 route `ladiwork-dashboard/*` còn lại
4. **W3-2** — mở rộng contract test toàn phaseB (12 fixtures)

---

## 10. Checklist hoàn tất

- [ ] `registerHandler` có ≥6 registrations
- [ ] `crm-pipeline/list` curl → code 200, `items[0].stages.length === 4`
- [ ] `crm-deal/list` mỗi stage → 200 (empty hoặc có deal)
- [ ] `crm-deal/get-summary` → `total_deals >= 1`
- [ ] `ladiwork-dashboard/config` → `widgets.length >= 1`
- [ ] `nx run ladipage-backend:test` pass
- [ ] Board URL load không 501 trên 4 route P0