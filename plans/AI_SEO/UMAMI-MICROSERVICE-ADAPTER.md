# Plan — Umami Microservice + SDK Adapter (AI-SEO Traffic)

> **Phạm vi:** Tích hợp [Umami](https://github.com/umami-software/umami) như **microservice analytics** cho landing page; `ladipage-backend` chỉ có **SDK/adapter mỏng**, hiển thị traffic trong AI-SEO.  
> **Không bao gồm code implementation.**  
> **Ước lượng:** 2.5–4 tuần (1 BE + 0.5 FE + DevOps partial).  
> **Ngày soạn:** 2026-07-15  
> **Trạng thái:** Draft — chờ ADR Phase 0  
> **Phụ thuộc:** `plans/AI_SEO/AI-SEO-LANDING-INTEGRATION.md` (publish hook Mode A; có thể ship traffic API trước inject nếu dùng manual script)

---

## Nguồn tham khảo

### Docs / plans trong monorepo

| Tài liệu | Đường dẫn | Dùng cho |
|----------|-----------|----------|
| **Data isolation (chuẩn)** | `plans/AI_SEO/DATA-ISOLATION.md` | Tenant / user / app / MS isolation |
| AI-SEO ↔ Landing plan | `plans/AI_SEO/AI-SEO-LANDING-INTEGRATION.md` | Publish inject, fail-soft, mapping page↔project |
| Publish + tracking | `docs/landing/publish-landingpage.md` | L3 `/p/slug`, PostHog note, inject pattern |
| OpenSEO adapter pattern | `docs/Kho-ung-dung/plan-be-ai-seo-openseo.md` | BE nhẹ, client microservice, không nhét engine |
| AI-SEO overview | `docs/Kho-ung-dung/AI-SEO.md` | Suite metrics / reports vs analytics CRM |
| OpenSEO checklist | `docs/Kho-ung-dung/checklist-openseo.md` | Reports ≠ CRM analytics |
| Docker stack mẫu | `docker/docker-compose.yml` | Pattern service OpenSEO :7003 |

### Code hiện trạng (đối chiếu)

| Vùng | Đường dẫn | Ghi chú |
|------|-----------|---------|
| OpenSEO client | `apps/ladipage-backend/src/modules/ai-seo/services/openseo-client.service.ts` | Pattern MCP client + 503 + retryAfter |
| AI-SEO module | `apps/ladipage-backend/src/modules/ai-seo/` | Nơi gắn traffic API / mapping |
| Publish stub | `apps/ladipage-backend/src/modules/publish/publish.service.ts` | Hook sau publish |
| CRM Analytics | `apps/ladipage-backend/src/modules/analytics/` | Sales/CRM — **không** tái dùng cho page traffic |
| Page counters | `PageEntity.tracking_*` | Counter thô — không thay Umami |
| FE AI-SEO cards | `ladipage-fe-v2/src/features/ai-seo/components/*Score*` | Nơi thêm traffic cards |

### Ngoài monorepo

| Nguồn | Dùng cho |
|-------|----------|
| https://github.com/umami-software/umami | Engine self-host, Docker image, Postgres |
| https://umami.is/docs | API, tracking script, websites, auth |

**Kết luận nguồn:** Plan bám **pattern OpenSEO adapter** đã có trong docs/code; Umami = engine traffic; Nest = orchestration + resilience. Không nhầm với module `analytics` CRM.

---

## 0. Quyết định kiến trúc (ADR tóm tắt)

### Chọn

| # | Quyết định |
|---|------------|
| D1 | **Umami = microservice** (Docker + Postgres riêng hoặc schema riêng). **Không** rewrite collect/aggregate trong Nest. |
| D2 | **`ladipage-backend` = SDK/adapter** (`UmamiClient` + domain service + API AI-SEO). |
| D3 | **FE không gọi Umami** (không API key browser, không iframe bắt buộc). |
| D4 | **Fail-soft toàn pipeline:** Umami down **không** crash Nest, **không** fail publish, traffic API trả empty/stale. |
| D5 | MVP map: **1 Umami website / SEO project (hostname)**; page filter theo path `/p/{slug}`. |
| D6 | Metric traffic **tách** `holisticScores` (OpenSEO); DTO riêng `traffic` / `engagement`. |
| D7 | SDK shape: lib nội bộ `@liora/umami-client` **hoặc** service trong `modules/ai-seo` phase 1; tách lib khi ổn định (giống `openseo-client`). |
| D8 | **Data isolation:** tenant enforce tại Nest trước mọi Umami call; chuẩn chung [`DATA-ISOLATION.md`](./DATA-ISOLATION.md). |

### Không chọn (giai đoạn này)

- All-in Nest pageview store  
- FE → Umami trực tiếp  
- Thay OpenSEO bằng Umami  
- Bắt buộc PostHog + Umami cùng lúc trên public HTML (chốt 1 primary; xem §10)

---

## 1. Mục tiêu sản phẩm

1. Landing đã publish gửi pageview/event về Umami (script trên HTML public).  
2. AI-SEO UI hiện: visits, uniques, bounce (nếu có), top referrers, devices (7d/30d).  
3. Optional: custom events CTA/form → conversion gợi ý.  
4. Hệ thống Liora (auth, publish, AI-SEO scan) **vẫn hoạt động** khi Umami lỗi/timeout.  
5. Multi-tenant: website Umami không leak cross-tenant.

---

## 2. Nguyên tắc resilience (tránh crash hệ thống)

| # | Nguyên tắc | Chi tiết |
|---|------------|----------|
| R1 | **Fail-soft** | Mọi gọi Umami bọc try/catch; không rethrow làm 500 cascade publish/scan. |
| R2 | **Timeout cứng** | Mỗi request SDK: 2–5s connect/read; không treo worker Nest. |
| R3 | **Circuit breaker** | N lỗi liên tiếp (vd 5/60s) → OPEN 30–120s: skip call, trả `degraded`. |
| R4 | **Bulkhead** | Pool HTTP riêng / concurrency limit (vd max 10 inflight); không ăn thread pool chung. |
| R5 | **Cache stale-while-error** | Redis/memory TTL 5–15 phút; lỗi Umami → trả cache + `stale: true`. |
| R6 | **Idempotent provision** | Tạo website Umami: retry an toàn; map local là source of truth. |
| R7 | **Publish independence** | Inject fail hoặc Umami API fail → publish vẫn 200; `trafficSyncStatus=failed`. |
| R8 | **Health tách** | `GET /ai-seo/traffic/health` (hoặc umami health) **không** gate readiness Nest chính (optional liveness riêng). |
| R9 | **No shared DB** | Không viết vào Postgres chính của Liora từ Umami collect path. |
| R10 | **Secrets server-only** | `UMAMI_API_KEY` / admin token chỉ Nest; rotate được. |
| R11 | **Tenant before outbound** | Không gọi Umami với `websiteId` chưa chứng minh thuộc `tenantId` hiện tại (I-E2). |
| R12 | **Cache key isolation** | Key stat/cache: `umami:t{tenantId}:p{projectId}:…` — cấm key chỉ `websiteId`. |
| R13 | **No end-user Umami admin** | User Liora không login Umami UI; ops break-glass only (I-M2). |

### Ma trận lỗi → hành vi

| Tình huống | Publish L1 | AI-SEO scan OpenSEO | GET traffic AI-SEO | Inject script |
|------------|------------|---------------------|--------------------|---------------|
| Umami process down | OK | OK | 200 + empty/stale + `degraded` | Skip inject hoặc inject “best effort” URL tĩnh |
| Umami timeout | OK | OK | degraded | soft |
| Umami 401/403 | OK + alert ops | OK | 503 business **hoặc** degraded (không 500 uncaught) | soft |
| Map thiếu websiteId | OK | OK | empty `not_configured` | skip inject |
| Circuit OPEN | OK | OK | degraded, **0 call** Umami | skip provision call |

**Không bao giờ:** unhandled rejection / exception bubble từ adapter làm sập request pipeline Nest.

---

## 3. Kiến trúc đích

```
                    ┌──────────────────────────────────────┐
                    │         ladipage-backend (Nest)        │
  FE AI-SEO ───────►│  AiSeoTrafficController                │
  (JWT/tenant)      │       │                                │
                    │       ▼                                │
                    │  AiSeoTrafficService (domain)          │
                    │   - tenant check                       │
                    │   - map project → umamiWebsiteId       │
                    │   - cache + circuit breaker            │
                    │       │                                │
                    │       ▼                                │
                    │  UmamiClient SDK  ──timeout/breaker──┐ │
                    │  (optional @liora/umami-client)      │ │
                    └──────────────────────────────────────┼─┘
                                                           │
                         REST (internal network)           │
                                                           ▼
                    ┌──────────────────────────────────────────┐
                    │  Umami microservice (:7004 gợi ý)        │
                    │  + Postgres umami (volume riêng)         │
                    │  collect ← browser script on /p/slug     │
                    └──────────────────────────────────────────┘

  Publish L1 ──► inject Umami script (websiteId) ──► HTML public
            └──► ensure/map (fail-soft) ──► lp_seo_* columns
```

### Ranh giới trách nhiệm

| Layer | Làm | Không làm |
|-------|-----|-----------|
| **Umami MS** | Collect, store events, aggregate, admin UI ops | Tenant Liora, SEO scores, publish |
| **UmamiClient SDK** | HTTP, auth header, timeout, parse DTO raw | Business mapping tenant |
| **TrafficService** | Map, cache, breaker, compose FE DTO | Raw SQL Umami DB |
| **Publish hook** | Inject script idempotent | Gọi stats API trong critical path dài |
| **FE AI-SEO** | Cards/charts | Gọi host Umami |

---

## 4. SDK / Adapter design

### 4.1 Package layout (mục tiêu)

```
apps/ladipage-backend/
  src/modules/ai-seo/
    services/
      umami-client.service.ts      # thin HTTP (phase 1 OK)
      umami-resilience.service.ts  # breaker + metrics (có thể gộp client)
      ai-seo-traffic.service.ts    # domain
    controllers/
      ai-seo-traffic.controller.ts

# Phase 1b (optional tách):
apps/ladipage-backend/libs/umami-client/  
  src/
    umami.sdk.ts
    types.ts
    errors.ts
```

Mirror tinh thần `OpenSeoClientService`: **một chỗ** gọi ngoài, domain service không `fetch` rải rác.

### 4.2 SDK API surface (logical)

| Method | Mục đích | Resilience |
|--------|----------|------------|
| `healthCheck()` | Ping Umami | timeout ngắn; never throw ra ngoài domain |
| `createWebsite({ name, domain })` | Provision | retry 1; map local trước/after |
| `getWebsite(id)` | Verify map | cacheable |
| `getStats(websiteId, { startAt, endAt })` | PV, UV, bounces, totaltime | cache + breaker |
| `getMetrics(websiteId, type, range)` | url, referrer, device, country, event | cache |
| `getPageviews(websiteId, range)` | timeseries chart | cache |
| *(optional)* `createEvent` server-side | hiếm; ưu tiên browser events | — |

Lỗi SDK: typed `UmamiUnavailableError` | `UmamiAuthError` | `UmamiNotFoundError` — domain **bắt** và map `degraded`, **không** để Nest exception filter biến thành 500 trừ khi config sai nghiêm trọng (feature bắt buộc — default không).

### 4.3 Config env

```text
UMAMI_ENABLED=true|false
UMAMI_BASE_URL=http://umami:3002          # internal
UMAMI_PUBLIC_SCRIPT_URL=https://analytics.example.com  # browser load script
UMAMI_API_KEY=...                         # or user/password bootstrap
UMAMI_TIMEOUT_MS=3000
UMAMI_CIRCUIT_FAILURE_THRESHOLD=5
UMAMI_CIRCUIT_OPEN_MS=60000
UMAMI_CACHE_TTL_SECONDS=300
UMAMI_CACHE_STALE_TTL_SECONDS=3600
```

`UMAMI_ENABLED=false` → SDK no-op; traffic API `not_configured`; publish skip inject.

---

## 5. Data model (Liora)

### 5.1 Gắn vào SEO project (MVP)

Mở rộng `lp_seo_project` (jsonb hoặc cột):

| Field | Ý nghĩa |
|-------|---------|
| `umami_website_id` | ID website Umami |
| `umami_share_id` | optional public share |
| `traffic_script_state` | `not_installed` \| `installed` \| `unknown` |
| `traffic_synced_at` | last successful stats pull |
| `traffic_snapshot` | jsonb cache last good stats (optional, hoặc Redis only) |

### 5.2 Page-level (optional)

`lp_seo_project_page`: không bắt buộc website riêng; filter stats theo `page_url` / path.

### 5.3 Mapping rules

| Event Liora | Hành động Umami | Fail-soft |
|-------------|-----------------|-----------|
| `ensureForLandingPage` / create SEO project | createWebsite nếu chưa có id | log; project vẫn active |
| connect landing page | reuse project website | — |
| publish | inject script | skip nếu no id / disabled |
| unpublish | **không** xóa website | giữ history |
| delete/archive SEO project | optional delete website (phase 2) | soft |

---

## 6. Publish inject (Mode A)

Cùng pipeline `AI-SEO-LANDING-INTEGRATION` §4.1 — thêm step:

| Step | Hành động | Fail policy |
|------|-----------|-------------|
| T1 | Resolve `umamiWebsiteId` từ SEO project linked | skip |
| T2 | Build script tag: `UMAMI_PUBLIC_SCRIPT_URL` + `data-website-id` | — |
| T3 | Inject trước `</head>`, idempotent | soft |
| T4 | Set `traffic_script_state=installed` khi inject OK | soft |

**Không** gọi Umami stats API trong hot path publish.  
**Không** block OpenSEO ensure nếu Umami provision fail (parallel soft tasks).

Script browser collect → **Umami public URL** (có thể CDN/reverse proxy), **không** đi qua Nest (tránh Nest thành collect bottleneck).

---

## 7. API Nest cho FE (AI-SEO)

Base: `/api/ai-seo` (TenantGuard).

| Method | Path | Response (logic) |
|--------|------|------------------|
| GET | `/traffic/health` | `{ ok, circuit: closed\|open, latencyMs? }` |
| GET | `/projects/:id/traffic?range=7d\|30d` | stats + `status: ok\|degraded\|not_configured` |
| GET | `/projects/:id/traffic/metrics?type=referrer\|url\|device\|country` | top N |
| GET | `/projects/:id/traffic/timeseries?range=7d` | series |
| GET | `/projects/:id/landing-pages/:pageId/traffic?...` | filter path |
| POST | `/projects/:id/traffic/provision` | manual re-create website (admin) |
| POST | `/projects/:id/traffic/installation/check` | HTML has script **hoặc** recent hit |

### Response envelope (bắt buộc cho UI không crash)

```text
{
  status: "ok" | "degraded" | "not_configured" | "disabled",
  stale: boolean,
  syncedAt: iso | null,
  range: { start, end },
  stats: { pageviews, visitors, bounces?, totaltime? } | null,
  message?: string   // human, không stack trace
}
```

HTTP: **ưu tiên 200** với `status=degraded` thay vì 502/503 cho case Umami down — FE luôn render card.  
Chỉ 4xx khi project not found / forbidden tenant.

**Isolation trên API traffic:**

| Case | HTTP / body |
|------|-------------|
| Project khác tenant | **404** (không leak existence trừ policy khác) |
| Chưa map website | 200 `not_configured` |
| Umami down | 200 `degraded` — **không** trả stats tenant khác từ cache key sai |
| Response product | Không bắt buộc trả `umamiWebsiteId` ra FE (I-E3) |

---

## 7.1 Data isolation (Umami / traffic)

> **Chuẩn đầy đủ:** [`DATA-ISOLATION.md`](./DATA-ISOLATION.md).

| Chủ đề | Rule plan Umami |
|--------|-----------------|
| **Tenant** | `GET .../traffic` chỉ sau `findProjectOrFail`; IT1/IT5 |
| **Outbound** | `UmamiClient.getStats(websiteId)` chỉ nhận id từ row local đã verify |
| **Provision** | `createWebsite` gắn ngay `lp_seo_project.umami_website_id` + tenant; tên `t{tenantId}-…` |
| **App boundary** | Traffic DTO ≠ CRM analytics; ≠ `holisticScores` (I-A3, I-A5) |
| **MS** | Umami DB riêng; port internal; service account Nest (I-M1–I-M4) |
| **Collect script** | Public `website-id` by design; stats API không public |
| **User** | Cùng permission AI-SEO; không vượt tenant |
| **Multi-instance cache** | Redis/memory key có `tenantId` (R12) |

### Gắn phase Umami

| Phase | Isolation deliverable |
|-------|------------------------|
| U0 | Network private; secret vault; ADR no end-user admin |
| U1 | SDK never logs API key; timeout (không leak cross-request) |
| U2 | Map + API + IT1/IT5; cache key tenant; envelope không lộ internal MS host |
| U3 | Inject chỉ websiteId của project đúng tenant khi publish |
| U4 | Events không gửi PII form (I-L3) |
| U5 | Rate limit per tenant; lifecycle archive website (I-M6) |

---

## 8. FE AI-SEO (hiển thị)

### UI

| Vùng | Nội dung |
|------|----------|
| Project card / dashboard | Visits 7d, UV 7d, sparkline |
| Project detail | Referrers, devices, countries |
| Landing page panel | Traffic theo path + SEO scores cạnh nhau |
| Degraded banner | “Traffic tạm thời không đồng bộ” khi `status=degraded` |

### Client

- Gọi Nest `aiSeoApi.getTraffic` (cùng `api-client`, Nest mode).  
- React Query: staleTime ~60s; không retry storm (max 1–2).  
- **Không** throw uncaught nếu body degraded.

Tách component: `SeoProjectTrafficCards` — không sửa semantic `holisticScores`.

---

## 9. Docker / Ops

### Compose (gợi ý)

| Service | Port (host) | Ghi chú |
|---------|-------------|---------|
| `umami` | 7004→3002 | image `docker.umami.is/umami-software/umami` |
| `umami-db` | internal | Postgres 15, volume `umami_pg` |

Network: `liora-network`, alias `umami`.  
Nest env: `UMAMI_BASE_URL=http://umami:3002`.

### Bootstrap

1. First admin user (docs Umami).  
2. Tạo API key / service user cho Nest.  
3. Secret vào `.env` / vault — không commit.  
4. Healthcheck Docker: HTTP 200 Umami.  
5. Backup volume DB Umami độc lập Liora DB.

### Observability

| Metric / log | Ý nghĩa |
|--------------|---------|
| `umami_sdk_calls_total{result}` | ok / timeout / error |
| `umami_circuit_state` | closed/open |
| `umami_cache_hit_ratio` | hiệu quả cache |
| Alert | circuit open > 10m; auth failures |

---

## 10. Phân biệt PostHog / PageEntity.tracking / CRM Analytics

| Hệ | Dùng khi | Plan này |
|----|----------|----------|
| **Umami** | Public landing traffic + privacy-friendly | **Primary** AI-SEO traffic |
| **PostHog** (docs publish) | Deep product/session | **Không** dual-inject MVP; ADR chọn 1 |
| **`tracking_*` Page** | Counter legacy nhanh | Optional dual-write later; không block |
| **`/analytics/reports`** | CRM sales | Không đụng |

---

## 11. Lộ trình phase

### Phase U0 — ADR + staging (2–3 ngày)

| # | Việc | Done khi |
|---|------|----------|
| U0.1 | Chốt D1–D7, PostHog vs Umami | ADR signed |
| U0.2 | Compose Umami + DB trên staging | UI admin login OK |
| U0.3 | API key Nest; network internal only admin | curl stats OK từ Nest container |
| U0.4 | Feature flags env | `UMAMI_ENABLED` doc |

### Phase U1 — SDK + resilience core (3–5 ngày)

| # | Việc | Owner |
|---|------|--------|
| U1.1 | `UmamiClient`: health, stats, metrics, createWebsite | BE |
| U1.2 | Timeout, error types, unit test mock HTTP | BE |
| U1.3 | Circuit breaker + metrics counters | BE |
| U1.4 | Cache layer (memory OK; Redis nếu multi-instance) | BE |
| U1.5 | Chaos test: Umami kill → Nest API vẫn 200 degraded | QA |

**Exit:** SDK không throw uncaught; breaker chặn spam.

### Phase U2 — Domain map + API traffic (3–5 ngày)

| # | Việc | Owner |
|---|------|--------|
| U2.1 | Migration fields `umami_*` trên `lp_seo_project` | BE |
| U2.2 | Provision trong ensure/create project (soft) | BE |
| U2.3 | Controllers traffic + tenant guard | BE |
| U2.4 | Contract tests response envelope | BE |
| U2.5 | FE cards + degraded state | FE |

**Exit:** Project có websiteId; FE hiện zeros hoặc real stats; kill Umami → UI degraded không trắng trang.

### Phase U3 — Publish inject + install check (3–4 ngày)

| # | Việc | Owner |
|---|------|--------|
| U3.1 | Hook inject trong L1 publish (cùng AI-SEO pixel pipeline) | BE |
| U3.2 | Idempotent script; public script URL | BE |
| U3.3 | Installation check (HTML hoặc recent pageview) | BE |
| U3.4 | E2E: publish → visit → stats > 0 (staging) | QA |

**Phụ thuộc:** Publish L1 thật (plan landing Phase 2). Có thể tạm manual dán script để test U2.

### Phase U4 — Page filter + events (3–5 ngày)

| # | Việc |
|---|------|
| U4.1 | Traffic per landing path |
| U4.2 | Custom events: `cta_click`, `lead_submit` (snippet chuẩn builder) |
| U4.3 | FE conversion mini-widget |
| U4.4 | Optional timeseries chart |

### Phase U5 — Hardening (2–3 ngày)

| # | Việc |
|---|------|
| U5.1 | Redis cache multi-instance |
| U5.2 | Rate limit GET traffic per tenant |
| U5.3 | Runbook: rotate key, rebuild Umami, circuit stuck |
| U5.4 | Optional tách `@liora/umami-client` lib |
| U5.5 | Archive project → policy website Umami |

---

## 12. Timeline gợi ý

```
Tuần 1       U0 + U1 (SDK + breaker + chaos)
Tuần 2       U2 (map + API + FE cards)
Tuần 2–3     U3 (inject publish) — song song landing plan P2
Tuần 3–4     U4 events + U5 hardening
```

**Critical path resilience:** U1 trước U2.  
**Critical path product demo:** U2 có thể demo bằng script manual trước U3.

---

## 13. Kiểm thử & DoD

### Test bắt buộc (anti-crash)

| # | Case | Pass |
|---|------|------|
| T1 | Umami container stop → `GET .../traffic` 200 degraded, Nest logs error bounded | |
| T2 | Umami delay 30s → client timeout < 5s, không treo request | |
| T3 | 20 concurrent traffic requests → concurrency limit, no FD leak | |
| T4 | Circuit open → 0 outbound calls trong open window | |
| T5 | Publish khi Umami down → publish 200, page live | |
| T6 | Wrong API key → degraded/auth message, no 500 stack to FE | |
| T7 | Cross-tenant projectId → 404, không gọi Umami id người khác | |
| T8 | `UMAMI_ENABLED=false` → not_configured, zero outbound | |
| T9 | Cache poison: seed cache tenant A, request tenant B cùng projectId spoof → miss/404 | |
| T10 | Direct Umami stats URL từ browser (nếu expose nhầm) → không dùng được token user Liora | |

### DoD MVP (U0–U3)

1. Umami chạy compose; Nest adapter + breaker + cache.  
2. SEO project provision website (soft).  
3. FE AI-SEO traffic cards với envelope `ok|degraded|not_configured`.  
4. Publish inject script (hoặc documented manual path).  
5. Chaos T1–T5 pass.  
6. Runbook ops ngắn.  
7. **Isolation:** T7/T9 + `DATA-ISOLATION.md` IT1/IT5 + I-M1/I-M2 verified.

---

## 14. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|------------|
| Umami API đổi version | TB | Pin image tag; SDK versioned; contract test |
| Collect spam / bot | TB | Umami filters; optional ignore localhost |
| Script chặn adblock | Thấp | UI “no data” ≠ error hệ thống |
| Dual analytics PostHog+Umami | TB | ADR U0 chọn 1 primary |
| Secret leak | Cao | vault; không log API key |
| DB Umami full disk | TB | retention policy; volume monitor |
| Nhầm traffic vào holisticScores | TB | DTO tách; review FE |
| Cross-tenant stats via websiteId | Cao | I-E2 + IT5; không nhận websiteId từ client |
| Ops Umami admin thấy mọi site | TB | I-M2; restrict admin VPN; prefix naming |
| Cache key thiếu tenant | Cao | R12 code review |

---

## 15. RACI (gợi ý)

| Việc | BE | FE | DevOps | QA |
|------|----|----|--------|-----|
| Compose Umami | C | — | R | C |
| SDK + breaker | R | — | C | C |
| API + map | R | C | — | C |
| FE cards | C | R | — | C |
| Publish inject | R | C | — | C |
| Chaos / E2E | C | C | C | R |

---

## 16. Ngoài phạm vi

- Implement code / PR chi tiết.  
- Session replay, heatmaps (không phải Umami core).  
- Multi-region Umami cluster.  
- Billing theo pageview (có thể phase sau).  
- Thay thế OpenSEO / GSC.

---

## 17. Liên kết plan khác

| Plan | Quan hệ |
|------|---------|
| `AI-SEO-LANDING-INTEGRATION.md` | U3 inject chung pipeline publish; fail-soft cùng tinh thần P7 |
| [`DATA-ISOLATION.md`](./DATA-ISOLATION.md) | Chuẩn tách tenant / user / app / MS |
| OpenSEO docs Kho-ung-dung | Cùng mô hình microservice + adapter |
| LANDING-PUBLISH-3-LAYER (FE) | L1/L3; Mode A host Liora |

---

## 18. Tóm tắt một câu

**Umami chạy microservice; Nest chỉ SDK/adapter có timeout + circuit breaker + cache + fail-soft + tenant check trước mọi call; FE AI-SEO đọc traffic qua Nest; publish/scan không bao giờ chết vì Umami; data không leak cross-tenant.**

---

## Lịch sử

| Ngày | Thay đổi |
|------|----------|
| 2026-07-15 | Tạo plan: MS + SDK adapter, resilience matrix, phase U0–U5, nguồn tham khảo |
| 2026-07-16 | Bổ sung D8, R11–R13, §7.1 isolation, T9–T10, DoD/rủi ro; link `DATA-ISOLATION.md` |
