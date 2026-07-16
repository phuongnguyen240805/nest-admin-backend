# Kế hoạch đấu nối AI-SEO ↔ Landing Page

> **Phạm vi:** nối module AI-SEO (Nest adapter + OpenSEO) với luồng create → publish → public URL của landing page.  
> **Không bao gồm code implementation.**  
> **Ước lượng:** 4–6 tuần (2–3 engineer, OpenSEO + Nest module stub đã có).  
> **Ngày soạn:** 2026-07-15  
> **Trạng thái:** Draft — chờ chốt ADR Phase 0

---

## Nguồn tham khảo (docs & code dự án)

Plan này **đã tham khảo** tài liệu và mã nguồn trong monorepo — **không** viết từ zero. Chi tiết:

### Plans AI_SEO (nội bộ thư mục)

| Tài liệu | Đường dẫn | Dùng cho |
|----------|-----------|----------|
| **Data isolation (chuẩn)** | `plans/AI_SEO/DATA-ISOLATION.md` | Tenant / user / app / MS isolation |
| Umami adapter | `plans/AI_SEO/UMAMI-MICROSERVICE-ADAPTER.md` | Traffic MS + fail-soft |

### Đã đọc / dùng trong `liora-monorepo/docs/`

| Tài liệu | Đường dẫn | Dùng cho |
|----------|-----------|----------|
| Publish + AI-SEO sequence | `docs/landing/publish-landingpage.md` | Luồng target inject script, `ensureForLandingPage`, `/p/slug`, OTTO SDK |
| Plan BE AI-SEO OpenSEO | `docs/Kho-ung-dung/plan-be-ai-seo-openseo.md` | Kiến trúc adapter, DB `lp_seo_*`, nguyên tắc BE nhẹ |
| Prompt implement BE | `docs/Kho-ung-dung/prompt-be-ai-seo-openseo.md` | Contract API Nest, MCP, FE dual-mode |
| Checklist OpenSEO | `docs/Kho-ung-dung/checklist-openseo.md` | Mapping MCP skills ↔ feature FE |
| Overview AI-SEO checklist | `docs/Kho-ung-dung/AI-SEO.md` | Phase microservice + adapter approach |

### Đã tham khảo plans FE (sibling app, ngoài `docs/`)

| Tài liệu | Đường dẫn | Dùng cho |
|----------|-----------|----------|
| Publish 3-layer + AI-SEO checklist §9 | `ladipage-fe-v2/plans/LANDING-PUBLISH-3-LAYER.md` | Mode A/B, Phase 1B–1C hook, E2E E1–E5, unpublish policy |
| App Store gate | `ladipage-fe-v2/plans/APP-STORE-INTEGRATION.md` | Route `/ai-seo`, access control |

### Đã đối chiếu code (hiện trạng thực tế)

| Vùng | Đường dẫn chính | Ghi chú so với docs cũ |
|------|-----------------|------------------------|
| Nest AI-SEO module | `apps/ladipage-backend/src/modules/ai-seo/` | Docs Kho-ung-dung ghi “CHƯA CÓ” — **code module đã có** (adapter, entities, controllers) |
| Publish hook stub | `apps/ladipage-backend/src/modules/publish/publish.service.ts` | `onLandingPagePublished` → `ensureForLandingPage` |
| API types | `apps/ladipage-backend/libs/api-types/src/ai-seo.ts` | `SeoProjectDto` contract |
| FE dual-mode | `ladipage-fe-v2/src/features/ai-seo/utils/ai-seo-api-mode.ts` | `NEXT_PUBLIC_AI_SEO_USE_NEST` default false |
| FE Nest client | `ladipage-fe-v2/src/lib/endpoints/ai-seo.api.ts` | Path Nest khi flag bật |
| FE BFF + mock | `ladipage-fe-v2/src/app/api/ai-seo/*` | Legacy write path |
| FE inject hook | `ladipage-fe-v2/src/features/landing-publish/hooks/ai-seo-publish.hook.ts` | OTTO script + Supabase `ai_seo_project_pages` |
| Env | `liora-monorepo/.env.example`, `ladipage-fe-v2/.env.example` | `OPENSEO_*`, `NEXT_PUBLIC_AI_SEO_*` |

### Chưa dùng làm nguồn chính (có thể bổ sung sau)

- `docs/LANDING-AI-STATUS.md` — status Landing AI (S2C), không phải SEO landing core  
- `docs/document.md` — tổng quan monorepo  
- Full OpenSEO source repo (`open-seo/`) — chỉ suy ra qua MCP client Nest + checklist docs  

**Kết luận nguồn:** Plan **có nền từ `docs/` dự án** (đặc biệt `docs/landing/` + `docs/Kho-ung-dung/`) **và** cập nhật theo **code hiện tại** (module Nest đã ship partial, FE dual-mode). Phần gap/cutover là tổng hợp phân tích 2026-07-15, không copy nguyên một file docs cũ.

---

## 0. Mục tiêu & nguyên tắc

### Mục tiêu sản phẩm

1. Mỗi landing (khi user bật AI-SEO / publish) có **SEO project** gắn 1–1 hoặc 1–n page.
2. Sau **publish**, public URL `/p/{slug}` (hoặc custom domain) là **startUrl** cho scan/audit.
3. HTML public **có pixel/script AI-SEO** khi page đã link SEO project (Mode A — host Liora).
4. User trong AI-SEO UI: xem score, task, approve/reject/deploy meta **theo page** đã publish.
5. Toàn bộ orchestration đi **Nest** (không logic SEO nặng trên BFF; OpenSEO chỉ BE gọi).

### Nguyên tắc kỹ thuật

| # | Nguyên tắc |
|---|------------|
| P1 | **Single source of truth publish = L1 API** (Nest/Publish hoặc Landing-CMS). Hook AI-SEO chạy **sau** render HTML, **trước** lưu artifact. |
| P2 | FE **không** inject script / tạo SEO project ở client; chỉ gọi API. |
| P3 | FE chuyển sang Nest (`NEXT_PUBLIC_AI_SEO_USE_NEST=true`) sau parity; BFF chỉ fallback / chat tạm. |
| P4 | Nest = tenant, quota, mapping page↔project, poll job, deploy metadata; OpenSEO = audit/keyword. |
| P5 | Unpublish **không** xóa link SEO; chỉ ngừng crawl URL live (404). |
| P6 | Idempotent: re-publish không duplicate script / duplicate project. |
| P7 | Fail-soft: lỗi OpenSEO/AI-SEO **không chặn** publish thành công (log + flag `seoSyncStatus=failed`). |
| P8 | **Data isolation:** tenant-first; Nest enforce; xem `DATA-ISOLATION.md` (bắt buộc). |

---

## 0.1 Data isolation (tóm tắt — chi tiết `DATA-ISOLATION.md`)

> **Chuẩn đầy đủ:** [`DATA-ISOLATION.md`](./DATA-ISOLATION.md) (I-T*, I-E*, I-A*, I-U*, IT1–IT5).

### Ranh giới áp dụng plan landing

| Lớp | Rule bắt buộc khi implement |
|-----|-----------------------------|
| **Tenant** | Mọi `lp_seo_*` + list/connect landing: `tenantId` từ JWT/`TenantGuard`; path id mismatch → **404** |
| **External OpenSEO** | Chỉ gọi MCP **sau** `findProjectOrFail` (tenant match); FE không cầm `openseoProjectId` như capability |
| **User** | MVP: workspace-shared trong tenant + permission `app:aiseo:use`; deploy/approve ghi actor |
| **Store** | MVP mode **S0** (tenant-only); giữ `storeId` filter-ready → upgrade **S1** không vỡ API |
| **App lớn** | AI-SEO không đọc CRM/Ecom repos; publish ↔ SEO chỉ qua hook/service explicit |
| **BFF dual-mode** | Cutover: freeze write BFF lệch tenant (I-F3) |

### Gắn phase

| Phase | Isolation deliverable |
|-------|------------------------|
| P0 | ADR: S0 vs S1 store; map BFF org ↔ Nest tenant |
| P1 | IT1/IT3 connect+list; page ownership tenant |
| P2 | Publish chỉ page thuộc tenant; inject project đúng tenant |
| P3 | Job/task join tenant (IT2); scan không dùng id chéo |
| P4 | Deploy meta chỉ page/project tenant; audit actor |
| P5 | Full IT regression; BFF write freeze |
| P6 | RBAC viewer/editor (nếu product); S1 store nếu cần |

### DoD isolation (gate kèm MVP-B / production)

- [ ] IT1–IT5 (`DATA-ISOLATION.md` §3.4) pass  
- [ ] Không tin `x-org-id` làm tenant source trên Nest  
- [ ] OpenSEO network không public end-user  
- [ ] Permission `app:aiseo:use` trên write path  

---

## 1. Hiện trạng & khoảng trống

### Đã có

| Thành phần | Ghi chú |
|------------|---------|
| Nest `AiSeoModule` | Project, page link, scan, task, job, keyword, website-projects bridge |
| `ensureForLandingPage(pageId)` | Auto-create SEO project theo landing |
| `PublishService.onLandingPagePublished` | Stub gọi ensure |
| FE dual client | Flag Nest vs BFF |
| FE `applyAiSeoPublishHook` | Inject OTTO script nếu có row Supabase `ai_seo_project_pages` |
| Docs luồng target | `docs/landing/publish-landingpage.md` + checklist §9 LANDING-PUBLISH |

### Chưa khép vòng (gap)

| Gap | Ảnh hưởng |
|-----|-----------|
| Publish L1 thật **chưa** gọi hook inject + ensure trong một pipeline | Script / project không đồng bộ lúc ship |
| 2 store: Supabase BFF vs Postgres `lp_seo_*` | Connect trên BFF ≠ data Nest |
| Deploy task chỉ ghi `siteAudit.deployedSuggestions` | Meta title/desc **không** vào `published_meta` / HTML |
| Installation check chỉ đọc flag local | Không verify script trên live URL |
| Scan dùng `hostname` project, chưa ưu tiên `publicUrl` post-publish | Audit sai URL draft |
| Chat/agents vẫn BFF | Không block MVP landing |
| App Store `AiSeo` seed `statusActive: false` | Access control chưa enforce |

### Gap → phase hoàn thiện

| Gap | Phase |
|-----|-------|
| FE dual-mode / BFF write path | P1 connect Nest; **P5** cutover |
| 2 store Supabase vs `lp_seo_*` | **P1**; §7 M2–M3 |
| Publish chưa inject + ensure | **P2** pipeline §4.1 |
| Inject vẫn FE Supabase | **P2.2–P2.5** |
| Scan chưa public URL | **P3.1–3.2** |
| Installation check local only | **P3.4–3.5** |
| Deploy meta chưa live | **P4** |
| GSC/GBP, Redis quota, domain, chat agent, billing | **P6** |

---

## 2. Kiến trúc đích

```
┌─────────────┐     connect / publish      ┌──────────────────────┐
│ Builder FE  │ ──────────────────────────►│ L1 Publish API (Nest)│
└─────────────┘                            └──────────┬───────────┘
                                                      │
                    1. Render HTML (Puck → HTML)
                    2. AiSeoPublishHook: inject script (nếu linked)
                    3. Lưu published_html + published_meta + slug
                    4. onLandingPagePublished → ensure + link page
                    5. (optional) queue first audit
                                                      │
                      ┌───────────────────────────────┼────────────────┐
                      ▼                               ▼                ▼
               ┌─────────────┐                 ┌─────────────┐   ┌──────────┐
               │ L3 /p/slug  │                 │ AI-SEO Nest │   │ OpenSEO  │
               │ public HTML │◄── crawl ───────│ scan/tasks  │──►│ MCP      │
               └─────────────┘                 └─────────────┘   └──────────┘
                      ▲
               visitor + SEO pixel / OTTO SDK
```

Tham chiếu sequence gốc: `docs/landing/publish-landingpage.md` (AiSeoPublishHook + ensureForLandingPage).

### Mapping identity (chốt trước code — Phase 0)

| Khái niệm | ID dùng | Lưu ở |
|-----------|---------|--------|
| Tenant / workspace | `tenantId` (Nest JWT) | mọi bảng `lp_seo_*` |
| Landing page | `PageEntity.externalId` / `websitePageId` | `lp_seo_project.landing_page_id`, `lp_seo_project_page.website_page_id` |
| SEO project | UUID `lp_seo_project.id` | FE AI-SEO UI |
| OpenSEO project | `openseo_project_id` | chỉ BE |
| Public URL | `/p/{slug}` hoặc custom domain | sau publish → `published_url` / hostname SEO |
| Script project key | `lp_seo_project.id` (hoặc openseo id — **chốt 1**) | inject vào HTML |

**Khuyến nghị MVP:** 1 landing ↔ 1 SEO project; scan URL = public URL Liora; script = Liora pixel (hoặc OTTO nếu đã contract); id inject = `lp_seo_project.id`.

**Quyết định Product/Tech Lead (Phase 0):**

1. Script: OTTO external SDK vs pixel Liora self-host  
2. 1 landing = 1 SEO project hay 1 domain nhiều pages  
3. Host scan: free subdomain vs custom domain priority  

---

## 3. User journeys (E2E)

### J1 — Connect rồi publish (happy path)

1. User mở AI-SEO → tạo SEO project (hostname) **hoặc** chọn landing từ “Website projects”.  
2. **Connect** landing page → SEO project (`lp_seo_project_page`).  
3. Builder **Publish**.  
4. L1: HTML + inject script + save + `ensureForLandingPage` (idempotent).  
5. Response `publicUrl`.  
6. AI-SEO: `pixelTagState`; user **Start audit** (hoặc auto).  
7. Poll job → scores + tasks.  
8. Approve task meta → **Deploy** → patch meta + revalidate L3.

### J2 — Publish trước, bật AI-SEO sau

1. Publish landing (không script).  
2. Connect AI-SEO → ensure + link.  
3. **Re-publish** hoặc “Sync SEO tag” để inject.  
4. Scan trên `publicUrl`.

### J3 — Unpublish

1. Unpublish → L3 404.  
2. Giữ SEO project + link.  
3. Scan mới fail soft; UI “page not live”.

### J4 — App Store gate (optional)

1. Workspace chưa cài `AiSeo` → ẩn CTA / 403.  
2. Sau install → full flow.

---

## 4. Hợp đồng API & event

### 4.1 Publish pipeline (L1) — bước cố định

| Step | Hành động | Fail policy |
|------|-----------|-------------|
| 1 | Auth + tenant + ownership page | hard fail |
| 2 | Render HTML artifact | hard fail |
| 3 | Resolve SEO link (by `websitePageId`) | soft: skip inject |
| 4 | Inject script (idempotent) | soft: publish without script + log |
| 5 | Persist `published_html`, slug, meta, `isPublish=true` | hard fail |
| 6 | `onLandingPagePublished` → ensure + sync hostname/publicUrl | soft |
| 7 | Optional: enqueue audit job | soft, feature flag |
| 8 | Return `{ publicUrl, seoProjectId?, seoSyncStatus }` | — |

### 4.2 AI-SEO API ổn định cho landing

| Endpoint group | Dùng cho landing |
|----------------|------------------|
| `POST/GET .../projects`, link landing-pages | connect UI |
| `website-projects/*` list/publish/connect | bridge builder |
| `scan` / `jobs/:id` | audit sau publish |
| `tasks` approve/reject/deploy | tối ưu meta/content |
| `installation` + `installation/check` | verify script live |
| (mới) `POST .../pages/:id/sync-seo-tag` | inject lại không full content change |

### 4.3 Events nội bộ Nest

| Event | Producer | Consumer |
|-------|----------|----------|
| `landing.published` | Publish/Landing-CMS | AI-SEO ensure + optional scan |
| `landing.unpublished` | Publish | AI-SEO mark page offline |
| `seo.task.deployed` | AI-SEO TaskService | Publish patch meta + revalidate L3 |
| `seo.audit.completed` | JobsService | Update page scores UI |

---

## 5. Lộ trình theo phase

### Phase 0 — Chốt scope & nền (3–5 ngày)

| # | Việc | Done khi |
|---|------|----------|
| 0.1 | Chốt Mode A (Liora host) MVP; Mode B later | ADR 1 trang |
| 0.2 | Chốt identity mapping (page id, script id, public URL) | bảng §2 signed |
| 0.3 | Staging: Nest + Postgres + OpenSEO + FE flag Nest | health MCP OK |
| 0.4 | Inventory gap BFF vs Nest (endpoint matrix) | sheet parity |
| 0.5 | Feature flags: `AI_SEO_LANDING_HOOK`, `AI_SEO_AUTO_SCAN_ON_PUBLISH`, `AI_SEO_USE_NEST` | doc env |
| 0.6 | RACI: BE publish, BE AI-SEO, FE builder, FE AI-SEO, QA | wiki |

**Deliverable:** ADR + matrix + staging green.

---

### Phase 1 — Single write path: link landing ↔ SEO project trên Nest (1 tuần)

| # | Việc | Owner |
|---|------|--------|
| 1.1 | List pages builder qua Nest `website-projects` (tenant-scoped) | BE |
| 1.2 | Connect/unlink → `lp_seo_project_page` + set `landingPageId` nếu empty | BE |
| 1.3 | FE: bật Nest cho connect/list projects/landing-pages | FE |
| 1.4 | UI Builder: entry “Gắn AI-SEO” / deep-link | FE |
| 1.5 | Contract test: page DTO shape FE panel | BE |
| 1.6 | Staging seed Nest (ignore mock BFF) | BE/DevOps |

**Acceptance:** Connect page A → project P; reload Nest mode thấy link; unlink không xóa SEO project; không cần Supabase `ai_seo_project_pages` cho path Nest.

---

### Phase 2 — Publish pipeline + inject + ensure (1–1.5 tuần)

| # | Việc | Owner |
|---|------|--------|
| 2.1 | L1 publish production path gọi pipeline §4.1 | BE Publish |
| 2.2 | Di chuyển inject FE BFF → Nest hook (idempotent) | BE |
| 2.3 | `onLandingPagePublished`: ensure + sync URL + link page | BE AI-SEO |
| 2.4 | Response: `publicUrl`, `seoProjectId`, `seoSyncStatus` | BE |
| 2.5 | FE Builder publish chỉ L1; xóa inject client | FE |
| 2.6 | AI-SEO BFF publish delegate L1 hoặc deprecate | FE |
| 2.7 | L3 `/p/[slug]` serve HTML đã inject; metadata crawl được | FE L3 |
| 2.8 | Unpublish: 404, giữ SEO link | BE |
| 2.9 | Unit + E2E: linked / unlinked / re-publish | QA |

**Acceptance E2E (staging):**

| # | Scenario | Pass |
|---|----------|------|
| E1 | Chưa link → publish → HTML **không** script SEO | |
| E2 | Đã link → publish → HTML **có** script + `seoProjectId` | |
| E3 | Re-publish → không duplicate script | |
| E4 | OpenSEO down → publish OK, `seoSyncStatus=failed` | |
| E5 | Unpublish → `/p/slug` 404; SEO project còn | |

*(E1–E5 align với `ladipage-fe-v2/plans/LANDING-PUBLISH-3-LAYER.md` §9.4.)*

---

### Phase 3 — Scan / scores / installation theo public URL (1 tuần)

| # | Việc | Owner |
|---|------|--------|
| 3.1 | `startUrl` = `published_url` nếu published, else hostname | BE |
| 3.2 | Block/warn scan nếu page unpublished | BE + FE |
| 3.3 | Job poll sync scores → project + page | BE |
| 3.4 | Installation check: HTTP GET public URL, detect script | BE |
| 3.5 | Update `pixelTagState` | BE |
| 3.6 | FE: scan + job polling + score cards theo page | FE |
| 3.7 | Optional flag: auto-scan on first publish | BE |
| 3.8 | Quota assert trước scan | BE |

**Acceptance:** Publish + scan → scores; installation true khi script live; scan unpublished → message rõ.

---

### Phase 4 — Task → deploy meta về landing (1 tuần)

| # | Việc | Owner |
|---|------|--------|
| 4.1 | Payload deploy: `metaTitle`, `metaDescription` (+ H1/OG later) | Product |
| 4.2 | Deploy → patch `published_meta` + optional re-render head | BE |
| 4.3 | Revalidate L3 cache | BE |
| 4.4 | FE task board: approve → deploy → verify meta | FE |
| 4.5 | Reject + reason trong `task.result` | BE |
| 4.6 | Human-in-loop MVP (không auto-deploy) | Product |

**Acceptance:** Deploy title/desc phản ánh trên `/p/slug`; deploy fail không stuck status.

---

### Phase 5 — Cutover FE Nest + deprecate BFF AI-SEO landing (3–5 ngày)

| # | Việc |
|---|------|
| 5.1 | Default `NEXT_PUBLIC_AI_SEO_USE_NEST=true` staging → production |
| 5.2 | Parity: projects, pages, scan, jobs, tasks, installation |
| 5.3 | Giữ BFF chat nếu cần; freeze write path BFF landing SEO |
| 5.4 | Monitor 7 ngày; rollback flag 1 click |
| 5.5 | Runbook: env, OpenSEO down, quota 429 |

---

### Phase 6 — Hardening & mở rộng (sau MVP)

| # | Việc | Priority |
|---|------|----------|
| 6.1 | Redis cache keyword + multi-instance quota | P1 |
| 6.2 | Custom domain Mode B scan + install | P1 |
| 6.3 | GSC/GBP real → `connectedData` | P2 |
| 6.4 | App Store gate `AiSeo` active | P2 |
| 6.5 | Keyword research per landing UI | P2 |
| 6.6 | Chat agent thật | P3 |
| 6.7 | Billing DataForSEO | P2 |
| 6.8 | Metrics publish_seo_*, audit_*, deploy_* | P1 |

---

## 6. Ma trận trách nhiệm module

| Domain | Module | Được làm | Không làm |
|--------|--------|----------|-----------|
| Publish HTML | Publish / Landing-CMS | render, persist, revalidate | SEO scoring |
| AI-SEO | `AiSeoModule` | project, link, scan, task, inject resolve | render Puck |
| OpenSEO | microservice | audit, keyword MCP | tenant Liora |
| FE Builder | editor | gọi publish L1 | inject script, mock SEO |
| FE AI-SEO | feature ai-seo | UI project/task/scan | gọi OpenSEO trực tiếp |
| L3 | `/p/[slug]` | serve artifact + meta | business SEO |

---

## 7. Dữ liệu & migration

| Bước | Nội dung |
|------|----------|
| M1 | Confirm migrations `lp_seo_*` staging/prod |
| M2 | Không migrate mockDb production (seed demo riêng) |
| M3 | Optional one-shot Supabase `ai_seo_project_pages` → Nest; else cold start |
| M4 | Đồng bộ sau publish: `hostname`, `landingPageId`, `pixelTagState`, `published_url` |

---

## 8. Feature flags & rollout

| Flag | Default MVP | Ý nghĩa |
|------|-------------|---------|
| `NEXT_PUBLIC_AI_SEO_USE_NEST` | false → true sau P5 | FE path |
| `AI_SEO_LANDING_HOOK` | true staging | inject + ensure trong publish |
| `AI_SEO_AUTO_SCAN_ON_PUBLISH` | false | auto audit (tốn quota) |
| `AI_SEO_DEPLOY_META` | false → true P4 | deploy meta thật |
| App `AiSeo` active | false → true | store gate |

**Rollout:** internal tenant → 10% workspace → 100%.  
**Rollback:** tắt hook + FE Nest flag false.

---

## 9. Kiểm thử & Definition of Done

### Test pyramid

| Layer | Case chính |
|-------|------------|
| Unit | inject idempotent; ensure idempotent; startUrl public vs hostname |
| Contract | SeoProjectDto, page DTO, publish response |
| Integration | publish → ensure → scan (mock OpenSEO) |
| E2E | J1–J3 staging browser + curl HTML |

### DoD MVP

1. Connect + publish + HTML script + publicUrl (E1–E5).  
2. Scan + scores + installation check trên URL live.  
3. Task approve/deploy cập nhật meta public (hoặc ship MVP-A không P4 — ghi rõ).  
4. Nest là write path chính (flag Nest on staging).  
5. OpenSEO down không block publish.  
6. Runbook + metrics cơ bản.  
7. **Isolation:** DoD §0.1 + `DATA-ISOLATION.md` §10 (tenant tests + app boundary).

### Ship slices

| Slice | Phase | Nội dung |
|-------|-------|----------|
| **MVP-A** | P2 + P3 | connect, publish script, scan, install |
| **MVP-B** | + P4 + P5 | deploy meta + cutover Nest |

---

## 10. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|------------|
| Hai nguồn sự thật BFF vs Nest | Cao | P1 cut connect; freeze BFF write |
| OpenSEO/MCP không ổn | Cao | soft fail publish; health endpoint |
| Scan URL draft / localhost | Trung bình | chỉ scan khi published + public host |
| Duplicate project per page | Trung bình | unique (tenantId, landingPageId); ensure first |
| Script vendor OTTO vs self | Trung bình | ADR Phase 0 |
| Deploy meta phá layout | Trung bình | chỉ patch head/meta; human approve |
| Quota DataForSEO | Trung bình | daily quota; không auto-scan default |
| Auth tenant ≠ orgId BFF | Cao | Nest JWT only sau cutover; `DATA-ISOLATION` I-F3 |
| IDOR project/task/job cross-tenant | Cao | I-T3 + IT1–IT2 bắt buộc CI |
| OpenSEO local_noauth lộ net | Cao | I-M1/I-M5 private network only |
| Store/null scope mơ hồ | TB | ADR S0/S1; document MVP S0 |
| User trong tenant thấy hết project | TB (product) | I-U3 default shared; RBAC P6 nếu cần |

---

## 11. Timeline gợi ý

```
Tuần 1      Phase 0 + Phase 1 (connect Nest)
Tuần 2–3    Phase 2 (publish hook + L3)
Tuần 3–4    Phase 3 (scan + install)
Tuần 4–5    Phase 4 (deploy meta)
Tuần 5–6    Phase 5 cutover + buffer QA
Song song   Phase 6 hardening
```

**Critical path:** Phase 2 (publish pipeline).  
**Có thể ship sớm:** MVP-A (P2+P3) không chờ P4.

---

## 12. Ngoài phạm vi plan này

- Implementation code / PR chi tiết từng file.  
- Full suite App Store (Local / Authority / Reports) ngoài landing core.  
- Cloudflare custom domain edge (Mode B) — sau MVP.  
- Chat LLM agent thay playbook static.  
- Thay OpenSEO bằng engine khác.

---

## 13. Checkpoint stakeholder (Phase 0)

1. Pixel provider: OTTO SDK vs Liora self-host?  
2. Auto-scan on publish: on/off + ai trả phí quota?  
3. Deploy meta: human approve only?  
4. Cold start Nest vs migrate Supabase?  
5. Timeline MVP-A vs MVP-B?  
6. **Isolation:** store mode S0 vs S1? workspace-shared vs per-user projects?  
7. **Isolation:** BFF orgId map sang Nest tenant thế nào trước cutover?

---

## 14. Tóm tắt

Đấu nối AI-SEO với landing = (1) **một write path Nest** cho link page↔project, (2) **publish pipeline** inject + ensure, (3) **scan/install** trên public URL, (4) **deploy meta** đóng vòng optimize, (5) **cutover FE** khỏi BFF, (6) **tách data tenant/app** theo `DATA-ISOLATION.md`.

BE adapter và hook stub **đã có trong code**; plan này là **khép vòng product + cutover**, có nền từ `docs/landing/` + `docs/Kho-ung-dung/` và cập nhật theo hiện trạng module Nest / FE dual-mode.

---

## 15. Tài liệu liên quan (isolation)

| File | Nội dung |
|------|----------|
| [`DATA-ISOLATION.md`](./DATA-ISOLATION.md) | Chuẩn I-T/I-E/I-A/I-U, tests IT*, DoD gate |
| [`UMAMI-MICROSERVICE-ADAPTER.md`](./UMAMI-MICROSERVICE-ADAPTER.md) | Isolation traffic + Umami MS |

---

## Lịch sử

| Ngày | Thay đổi |
|------|----------|
| 2026-07-15 | Tạo plan; ghi nguồn tham khảo docs/ + code; map gap → phase |
| 2026-07-16 | Bổ sung P8 + §0.1 data isolation; DoD/rủi ro/checkpoint; link `DATA-ISOLATION.md` |
