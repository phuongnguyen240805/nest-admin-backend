# Kế hoạch Hoàn chỉnh: Kết hợp Reverse Engineering + Xây dựng Schema & Core Backend

## 1. Đánh giá tổng hợp mức độ đáp ứng Reverse (kết hợp tất cả plan & artifacts)

### 1.1. Dữ liệu Reverse hiện có (từ CDP + reverse-skill efforts)
- **tools/cdp-reverse-engineer/**: Công cụ chính với 20+ config phase (phase1-landing*, phase4-baocao, phaseA-appstore, phaseB-ladiwork*, phaseC-automation* + legacy). 
  - Collectors: network, websocket, state, heap hints.
  - Exporters: schema-tables-merged.json (29+ tables), typeorm-hints.json, unique-routes.json (81 routes), ladipage-post-apis.json, ts-types, contract-fixtures.
- **Merged coverage** (manifest + unique-routes):
  - **Kho ứng dụng**: `application/list`, `application/update` → `lp_application` (code, name, status_active/pin, owner_id, store_id...).
  - **Ladiwork**: 16+ routes (`crm-pipeline/list|search`, `crm-deal/list|get-summary`, `ladiwork-dashboard/*` (config, attention-stats, member-performance, pipeline-by-stage...)) → `lp_crm_pipeline`, `lp_crm_deal`, `lp_ladiwork_dashboard`, `lp_crm_filter`.
  - **Automation**: 8+ routes (`flow/list|show` (apiv5), `broadcast/list`, `integration/list-all`, `flow-tag/list-all`) → `lp_flow`, `lp_broadcast`, `lp_integration`, `lp_flow_tag`.
  - **Báo cáo**: `report/overview`, `report/top-product` → `lp_analytics_report`.
  - **Landing pages**: `ladi-page/list|show`, `domain/list`, `staff/list`, `form-config/list`, `asset-list` → `lp_page`, `lp_domain`.
- **RE-SETUP-REMOVAL.md + REVERSE-RESULTS-appv6-capture-report.md**: Setup reverse-skill bên ngoài monorepo (D:\Tools\reverse-skill-ladipage-re) + removable (xóa dễ dàng sau khi export). Current reverse đã cover khá tốt list/read + một số mutations cho 5 chức năng. Nhiều phase có data phong phú, nhưng một số capture có lỗi partial (ERR_NAME_NOT_RESOLVED).
- **plan-be-phase-bc-ladiwork-automation.md**: Chi tiết inventory routes, schema tables, 8-stage roadmap, dual-host (api.ladiflow vs apiv5), PR DAG, entity map (lp_crm_deal, lp_flow...), mutation gaps.
- **plan-reverse-skill-cdp-integration-missing-features.md**: Phương pháp 4 lớp (CDP + HAR + Heap + Frida) + reverse-skill (jshookmcp, browser-automation, field-journal). Phased execution: Phase0 (auth+reports), Phase1 (landing), PhaseA (appstore), PhaseB (ladiwork), PhaseC (automation). Grok/Codex analysis loop + removable setup.

### 1.2. Mức độ đầy đủ (tổng hợp)
- **Đã tốt (70-85%)**: Read/list + một số update (app store, ladiwork board/deals, automation flows/broadcast, reports top, landing catalog). Schema inference mạnh (từ samples → typeorm-hints + tables). Header patterns rõ (owner-id cho ladiflow, store-id cho ladipage). Nhiều samples sẵn sàng cho mappers.
- **Gaps còn thiếu**:
  - Mutations phức tạp/editor (flow/save, page publish, deal drag, broadcast create) — cần thêm HAR/headed/Frida.
  - Deep relations & full graphs (page content_versions, flow nodes/edges, deal custom fields).
  - Một số reports stub (automation/jobs), full landing builder/publish.
  - Edge cases, error paths, large pagination.
- **Kết luận từ tất cả plan**: Reverse **chưa 100% đầy đủ** nhưng **đủ vững chắc** để chuyển sang schema + core backend ngay. Sử dụng merged artifacts + samples làm nguồn sự thật. Tiếp tục capture song song cho gaps mutations.

**Tổng hợp 5 chức năng**:
- **Kho ứng dụng**: Đủ tốt (list + update).
- **Ladiwork**: Rất tốt (16+ routes + board/deals/dashboards).
- **Automation**: Tốt (flow + broadcast + apiv5 editor).
- **Báo cáo**: Trung bình (overview/top-product; cần mở rộng).
- **Landing pages**: Trung bình (catalog + domain; cần publish + editor sâu).

---

## 2. Kiến trúc tổng thể (Kết hợp tất cả)

Sử dụng **reverse-skill + cdp-reverse-engineer** cho capture (4 lớp + removable setup bên ngoài).

**Workflow hoàn chỉnh**:
```
1. Setup Removable (RE-SETUP-REMOVAL.md + reverse-skill plan)
   - Clone reverse-skill ngoài monorepo
   - MCP (jshookmcp, anything-analyzer)
   - Chuẩn bị Frida + CDP tool

2. Per-Feature Capture (plan-reverse-skill + plan-bc + cdp configs)
   - Phase0: Auth + reports baseline
   - Phase1: Landing
   - PhaseA: App store
   - PhaseB: Ladiwork (board/detail/mutations)
   - PhaseC: Automation (editor/mutations)
   - 4 lớp: CDP (Playwright) + HAR + Heap + Frida (hook fetch/XHR/owner-id)
   - Dùng browser-automation skill thay selector brittle

3. Export & Analysis (Grok/Codex loop)
   - merge:schema + export:ts-types + export:contract-fixtures + typeorm-hints
   - Đọc merged/*.json + phase samples → map route → DTO/entity
   - Field-journal (reverse-skill) để evolution

4. Schema & Core Backend (plan-schema + plan-bc)
   - Từ schema-tables-merged + typeorm-hints → entities (TenantScoped)
   - Core services (thay seed)
   - Mappers + RPC wiring (ladipage-rpc + ladiflow-rpc + v5)
   - 8-stage cho Ladiwork/Automation + tương tự cho các cái khác
```

**Module map** (kết hợp):
- `ladiflow-rpc/` + `ladiflow-v5-rpc/` (dual host)
- `ladiwork/` (pipeline, deal, dashboard, filter)
- `automation/` (flow, broadcast, integration)
- `app-store/` (thay seed)
- `analytics/` (mở rộng reports)
- Landing: `publish/`, `domain/`, `website/`, `funnelx/`, `builder-bridge/`

---

## 3. Kế hoạch Chi tiết Hoàn chỉnh (Tích hợp)

### Phase 0: Setup Removable + Baseline (1-2 ngày)
- Clone reverse-skill (D:\Tools\...) + bootstrap (refresh-tool-index, MCP).
- Chuẩn bị `tools/cdp-reverse-engineer` (install browsers, session).
- Chạy lại phase4-baocao + merge.
- Tạo `docs/reverse/schema-freeze-all.json` từ merged (81 routes).

### Phase 1-5: Capture Song song + Analysis (theo plan-reverse-skill + plan-bc)
- **Phase 1 (Landing)**: Chạy phase1-* configs (headed cho mutations). Dùng jshookmcp cho JS initiator + editor. Heap cho page state.
- **Phase A (App Store)**: phaseA-* . Thêm activate/pin/search nếu thiếu (HAR).
- **Phase B (Ladiwork)**: phaseB-read/board/detail/mutations (từ plan-bc). Tập trung board Kanban, deal drag.
- **Phase C (Automation)**: phaseC-read/editor/mutations. Bắt apiv5 flow/show + save.
- Sau mỗi phase:
  - `npm run merge:schema && npm run export:ts-types && npm run export:contract-fixtures`
  - Grok phân tích: map routes → types/entities, extract samples cho mappers.
  - Ghi field-journal (reverse-skill) hoặc update reverse docs.

**4 lớp chuẩn hóa** (từ reverse-skill plan):
- CDP (Playwright + element-ref từ browser-automation).
- HAR (Chrome thật cho mutations phức tạp).
- Heap Snapshot (sau load, sau list, sau editor).
- Frida+ (hook fetch/XHR/owner-id, bypass headless).

### Phase 6: Schema Derivation (2-3 ngày)
- Parse `schema-tables-merged.json` + `typeorm-hints.json`.
- Tạo entities (dựa plan-bc + plan-schema):
  - `lp_application` → app-store/entities/application.entity.ts
  - `lp_crm_pipeline`, `lp_crm_deal`, `lp_ladiwork_dashboard` → ladiwork/entities/
  - `lp_flow`, `lp_broadcast`, `lp_integration` → automation/entities/
  - `lp_page`, `lp_domain` → publish/domain/ (hoặc new landing module)
  - `lp_analytics_report` → analytics/
- Áp dụng `TenantScopedEntity`, JSONB cho graph/content, FKs.
- Migrations (TypeORM).
- Update `libs/ladipage-types/` (từ export hoặc manual từ samples).

### Phase 7: Core Backend Implementation (per area, 8-10 ngày)
**Tích hợp plan-bc 8-stage + plan-schema**:

- **Ladiwork (Stage 3,5,6 từ plan-bc)**:
  - Entities + migrations.
  - Services: PipelineService, DealService, LadiworkDashboardService (real query thay seed).
  - Read RPC: wire `crm-pipeline/*`, `crm-deal/*`, `ladiwork-dashboard/*` vào ladiflow-rpc.
  - Mutations (sau HAR): create/update/deal drag.

- **Automation (Stage 4,5,6)**:
  - Entities.
  - Services: FlowService (graph JSONB), BroadcastService, IntegrationService.
  - Dual-host: ladiflow-rpc (list) + ladiflow-v5-rpc (flow/show + editor).
  - Wire `flow/*`, `broadcast/*`.

- **Kho ứng dụng**:
  - Thay `application-seed.store.ts` bằng real repo + ApplicationEntity.
  - Update catalog/lifecycle services + mapper.
  - Wire `application/list|update`.

- **Báo cáo**:
  - Mở rộng analytics.service từ samples (sales, business, customers).
  - Thêm automation/jobs reports (dùng flow/broadcast data).
  - DTOs + controller mở rộng.

- **Landing pages**:
  - Entities cho lp_page, lp_domain.
  - Basic services (list/show/create/update) trong publish/domain.
  - Mappers + wire `ladi-page/*`, `domain/*`.
  - Bổ sung publish flow cơ bản (từ samples).

**Mappers chung**: Thay TODO identity mapping bằng entity ↔ CDP (dựa samples từ phase outputs).

**RPC Wiring**: 
- ladiflow-dispatcher + v5-dispatcher.
- ladipage-rpc dispatcher.
- Context guards (owner-id / store-id).

### Phase 8: Verification & Evolution
- Contract tests từ exported fixtures (phaseB/C/A/4/1).
- Replay samples: compare response shape.
- Smoke: board, flow editor, app list qua RPC.
- Removable: xóa reverse-skill + output/ (giữ types/fixtures) theo RE-SETUP-REMOVAL.md.
- Evolution: field-journal sau mỗi phase + update merged schema.
- Docs: `docs/reverse/phase*-full-capture.md`, `phaseB-ladiwork-api.md`, v.v.

## 4. Timeline & PR DAG (tích hợp)

**Ước lượng**: 18-25 ngày (kết hợp capture song song + implement).

**PRs (kết hợp plan-bc DAG + các phase khác)**:
- PR-Rev-Setup: reverse-skill + enhanced CDP (heap/frida).
- PR-Rev-Capture: chạy phases + merge/export.
- PR-Schema-01: entities + migrations (lp_application, lp_crm_*, lp_flow, lp_page...).
- PR-Core-Ladiwork: services + read RPC (từ plan-bc Stage 3/5).
- PR-Core-Automation: services + dual RPC (Stage 4/5).
- PR-Core-AppStore + Reports + Landing: tương tự.
- PR-Mutations: (sau HAR) + apiv5 bridge.
- PR-Tests-Docs: contract + smoke + removable cleanup.

**Stack**: Graphite/branch per phase.

## 5. Rủi ro & Mitigation (từ tất cả plans)

- Capture chưa đủ mutations → Dùng HAR/Frida/browser-automation + headless fallback.
- Schema inference thiếu relations → Infer từ samples + cross-ref (CRM/ecom) + manual review.
- Breaking shape → Giữ format CDP 1:1.
- Removability → Luôn external setup (RE-SETUP).
- Legal → Chỉ account test.

## 6. Lệnh vận hành chính

```powershell
# Setup
cd D:\Tools\reverse-skill-ladipage-re && .../refresh-tool-index.ps1

cd tools/cdp-reverse-engineer
npm run capture:phaseA:read
npm run capture:phaseB:board -- --headed
... (các phase khác)

npm run merge:schema && npm run export:ts-types && npm run export:contract-fixtures

# Backend
nx run ladipage-backend:build
```

---

**Kết luận & Báo cáo kết quả**:

- **Đánh giá reverse**: Đã đáp ứng khá đầy đủ (70-85%) cho 5 chức năng qua dữ liệu phong phú từ CDP + reverse-skill. Đủ để dựng schema/core ngay.
- **Kế hoạch hoàn chỉnh**: Đã tích hợp tất cả (reverse-skill methodology, 4 lớp capture, plan-bc 8-stage cho Ladiwork/Automation, removable setup, Grok analysis loop, schema từ merged hints, core implementation thay seed).
- **Kết quả**: Tạo được kế hoạch toàn diện tại `plans/plan-schema-from-reverse-core-backend.md` (đã bổ sung). Sẵn sàng chuyển sang implement schema/entities → services → RPC wiring cho các chức năng còn thiếu.
- **Next**: Thực thi Phase 0-1 (setup + capture bổ sung) → Phase 6 (schema) theo plan.

Kế hoạch này đảm bảo kết hợp tốt nhất các plan reverse để bổ sung chính xác các chức năng thiếu.

## 2. Mục tiêu kế hoạch

Từ reverse results (schema-tables-merged.json, typeorm-hints.json, ladipage-post-apis samples, unique-routes):
- Xây dựng **schema DB thực** (TypeORM entities, relations, indexes, tenant-scoped).
- Xây **core backend** cho 5 chức năng (thay seed/stub bằng real logic).
- Giữ tương thích RPC (ladipage-rpc, ladiflow-rpc).
- Re-use patterns hiện có: TenantScopedEntity, mappers, dispatcher, ladipage-types.
- Output: entities + basic services + mappers + migration hints.

**Scope ưu tiên** (theo impact):
1. Kho ứng dụng + Ladiwork (đã có data tốt + seed hiện tại dễ migrate).
2. Automation + Reports.
3. Landing pages (cơ bản: list/show + domain).

## 3. Kiến trúc & Reuse

- **DB**: TypeORM (hiện tại). Dùng `TenantScopedEntity` cho multi-tenant (store_id, owner_id, ladi_uid).
- **Schema source**:
  - Bắt đầu từ `typeorm-hints.json` (entityName, columns).
  - Bổ sung từ `schema-tables-merged.json` (full fields + samples).
  - Validate với real samples từ `output/phase*/ladipage-post-apis.json`.
- **Modules hiện có cần extend**:
  - app-store/ → real entities thay seed.
  - ladiwork/ → real entities + services (deal, pipeline, dashboard).
  - automation/ → implement (flow, broadcast).
  - analytics/ → mở rộng reports.
  - landing-related: website/funnelx/publish/domain/builder-bridge (thêm entities cho lp_page, lp_domain).
- **RPC layers**:
  - ladipage-rpc/mappers/landing/ + ecom.
  - ladiflow-rpc/mappers/ (automation, ladiwork, ...).
  - Replace TODO identity mappers bằng entity <-> CDP.
- **Reuse patterns** (từ code hiện có):
  - `TenantScopedService`, `paginate`, guards.
  - `application-catalog.service.ts` style cho list.
  - `ladiwork-seed.store.ts` → migrate sang repository.
  - Existing entities in crm/ecom (extend relations nếu cần, e.g. deal ↔ customer).
- **Types**: Extend `libs/ladipage-types` từ schema (hoặc dùng generator).
- **Không**: Full publish/build engine, billing integration sâu, UI collab.

## 4. Các bước thực hiện (phased)

### Phase 0: Prep & Analysis (1-2 ngày)
- Review `schema-tables-merged.json` + `typeorm-hints.json` + phase samples cho 5 areas.
- List full tables cần: lp_application, lp_page, lp_domain, lp_flow, lp_broadcast, lp_crm_deal, lp_crm_pipeline, lp_ladiwork_dashboard, lp_analytics_report, + relations (e.g. deal ↔ pipeline, flow ↔ integration).
- Tạo branch `feat/schema-from-reverse`.
- Run `npm run merge:schema` (nếu có data mới) để refresh.

### Phase 1: Core Schema (Entities + Migrations)
- Tạo entities (dựa typeorm-hints):
  - `src/modules/app-store/entities/application.entity.ts` (LpApplicationEntity).
  - `src/modules/ladiwork/entities/` (crm-deal.entity.ts, crm-pipeline.entity.ts, ladiwork-dashboard.entity.ts...).
  - `src/modules/automation/entities/` (flow.entity.ts, broadcast.entity.ts...).
  - Landing: thêm vào module mới hoặc publish/domain (lp-page.entity.ts, lp-domain.entity.ts).
  - Reports: mở rộng `lp_analytics_report` nếu cần (hoặc dùng existing analytics).
- Áp dụng TenantScopedEntity + decorators (@Column theo type: varchar/objectId/int/datetime/jsonb/array).
- Thêm relations (ManyToOne/OneToMany) từ samples (e.g. deal.pipeline_id).
- Indexes: tenant + code/_id, search fields.
- Tạo migration (typeorm cli).
- Update `data-source` nếu cần.

**Ví dụ entity skeleton** (reuse pattern từ crm):
```ts
import { Entity, Column, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@liora/nest-core/...';

@Entity('lp_application')
export class ApplicationEntity extends TenantScopedEntity {
  @Column() code: string;
  @Column() name: string;
  // ... from hints
  @Column({ type: 'jsonb', nullable: true }) addon?: any;
}
```

### Phase 2: Core Services & Repos
- Thay seed stores:
  - app-store: `application-catalog.service.ts`, `application-lifecycle.service.ts` dùng real repo.
  - ladiwork: services/deal.service.ts, pipeline.service.ts, ladiwork-dashboard.service.ts → query DB thay readFixture.
- Tạo services cho new:
  - automation: flow.service.ts, broadcast.service.ts.
  - landing: page.service.ts, domain.service.ts (basic CRUD + list).
  - reports: mở rộng analytics.service (nếu cần).
- Re-use: TenantContextService, paginate, Between/In queries (như hiện tại trong analytics/dashboard).

### Phase 3: Mappers & RPC Wiring
- Cập nhật mappers (dựa samples response):
  - `ladipage-rpc/mappers/landing/application.mapper.ts` → entity to LpApplication.
  - `ladiflow-rpc/mappers/ladiwork/*.mapper.ts`, automation/flow.mapper.ts.
  - Thêm cho page/domain nếu cần.
- Update registrars/dispatchers: wire real services thay TODO NotImplemented.
- Giữ format response giống CDP (data, message, code).

### Phase 4: Integration & Polish
- Wire modules (app.module imports đã có).
- Update ladipage-types nếu schema mới (hoặc generate).
- Handle owner-id vs store-id (từ headers trong samples).
- Basic validation, error handling.
- Seed data migration script (nếu cần migrate từ fixtures sang DB).
- Update tests/contract fixtures nếu thay đổi.

### Phase 5: Verification
- Replay samples từ reverse (compare response shape).
- Manual test qua RPC (list/update app, ladiwork board, flow list...).
- Check DB: relations, tenant isolation.
- Run existing contract tests + new for core.
- Measure: all TODO routes for these features được implement cơ bản.

## 5. Deliverables
- Entities + migrations.
- Core services (real DB).
- Updated mappers + wired RPC (no more seeds/stubs for core).
- Plan follow-up: full mutations, reports advanced, landing builder.
- Docs: update structure.md hoặc README nếu cần.

## 6. Rủi ro & Mitigations
- Schema inference incomplete → Validate với nhiều samples + manual review fields.
- Relations missing → Infer từ joins trong samples + existing crm/ecom patterns.
- Performance (large content_versions in page) → JSONB + lazy load.
- Breaking RPC → Giữ response shape 1:1 với reverse.
- Time: Bắt đầu với read-heavy (list), add mutations sau.

## 7. Timeline gợi ý (sau khi reverse ổn)
- Phase 0-1: 2-3 ngày (schema + entities).
- Phase 2-3: 3-4 ngày (services + mappers).
- Phase 4-5: 2 ngày (wire + verify).

**Bắt đầu ngay với Phase 0**: Review schema-tables-merged + typeorm-hints cho lp_application, lp_crm_deal, lp_flow, lp_page.

Dữ liệu chính:
- plan bổ sung: `plan-be-phase-bc-ladiwork-automation.md, plan-reverse-skill-cdp-integration-missing-features.md, REVERSE-RESULTS-appv6-capture-report.md`
- Merged: `tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json`
- Hints: `typeorm-hints.json`
- Samples: phaseA/B/C/4/1 outputs + ladipage-post-apis.json

Plan này dựa trực tiếp trên kết quả reverse hiện có. Sẵn sàng execute sau approval.
