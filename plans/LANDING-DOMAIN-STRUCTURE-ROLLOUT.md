# Kế hoạch triển khai Domain Delivery đúng `structure.md`

> **Ngày:** 2026-07-18  
> **Nguồn chuẩn:** [`docs/landing/structure.md`](../docs/landing/structure.md)  
> **Plan con (đã có, tái dùng):**  
> - Plan A free subdomain → [`FREE-SUBDOMAIN-DELIVERY.md`](./FREE-SUBDOMAIN-DELIVERY.md)  
> - Plan B customer domain → [`CUSTOMER-DOMAIN-DELIVERY.md`](./CUSTOMER-DOMAIN-DELIVERY.md)  
> **Phạm vi code:** `ladipage-fe-v2` + `liora-monorepo` (Nest domain/publish + optional Worker package)  
> **Trạng thái:** Draft plan — **P0 flags + P1 Nest CF control-plane partial** (2026-07-18, free domain test: `ladipage.publicvm.com`)

---

## 0. Mục tiêu

Triển khai **đúng luồng sơ đồ** `structure.md`:

```text
                    Cloudflare
         ┌──────────┴──────────┐
         │ Wildcard *.saas.com │  Custom Hostnames (SaaS)
         └──────────┬──────────┘
                    ▼
            Cloudflare Worker
         ┌──────────┴──────────┐
         ▼                     ▼
   Subdomain?            Custom Domain?
   {slug}.saas.com       shop.customer.com
         │                     │
         └──────────┬──────────┘
                    ▼
           Resolve route (KV / DB)
                    ▼
           Serve published artifact
           (target: R2; MVP: origin /p/slug)
```

**User custom domain (structure.md dòng 56–67):**

```text
User thêm domain shop.customer.com
  → NestJS gọi Cloudflare API → Custom Hostname
  → User CNAME → fallback.yoursaas.com
  → CF validate + SSL free
  → Proxy → Worker → resolve → serve
```

**Nguyên tắc sản phẩm**

| # | Nguyên tắc |
|---|------------|
| P1 | **3 lớp URL:** platform `/p/{slug}` luôn có → free subdomain → custom domain (priority cao dần cho public link). |
| P2 | **Control plane = Nest** (create/delete/check Custom Hostname, route, status) — FE chỉ UI + BFF thin proxy nếu cần. |
| P3 | **Data plane = Cloudflare Worker** (Host header) — không phụ thuộc browser gọi CF. |
| P4 | **Artifact = published HTML** (source of truth publish L1); R2 là store edge; origin Next vẫn fallback. |
| P5 | **Fail-soft:** CF/R2 down không chặn publish content; edge_status phản ánh trạng thái. |
| P6 | **Local:** flags off → chỉ `/p/{slug}`; không bắt buộc CF account. |
| P7 | **Isolation:** domain/route theo owner/tenant; không serve page tenant khác. |

---

## 1. Hiện trạng vs structure (gap)

| structure.md | Hiện trạng (2026-07) | Gap |
|--------------|----------------------|-----|
| Nest tạo Custom Hostname | FE `cloudflare-saas.client` + Nest util pure | **Chuyển ownership → Nest** |
| CNAME → fallback.saas.com | Env `CUSTOM_DOMAIN_CNAME_TARGET` | Ops: zone fallback + doc DNS |
| CF SSL/validate | API client + refresh route | Poll job Nest + status UI |
| Wildcard free | Plan A code + Next rewrite | DNS `*.FREE` + Worker branch prod |
| Worker Host route | `landing-edge-worker.stub.ts` | **Deploy Worker thật** + routes |
| Serve R2 | Supabase `published_html` + Next SSR | **Upload R2 on publish** + Worker fetch R2 |
| Coolify Nest + Supabase | Đã có | Giữ |
| R2 media + static | Chưa full path publish | Phase R2 |

**Không đập rebuild:** giữ tables `landing_domains` / `landing_domain_routes`, publish hook, flags, quota. Chỉnh **ownership + edge serve** cho khớp structure.

---

## 2. Kiến trúc target (chuẩn structure)

```text
┌─────────────────────────────────────────────────────────────────┐
│ FE (ladipage-fe-v2)                                              │
│  • Builder publish L1 (render HTML → Supabase)                   │
│  • UI Domains: add / DNS instructions / status / map page        │
│  • Gọi Nest domain APIs (Bearer); không gọi CF API từ browser    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ JWT + tenant
┌───────────────────────────────▼─────────────────────────────────┐
│ Nest (ladipage-backend) — CONTROL PLANE                         │
│  DomainModule                                                    │
│   POST   /domains                    → create + CF Custom HN     │
│   GET    /domains                    → list + status              │
│   POST   /domains/:id/refresh        → poll CF status             │
│   DELETE /domains/:id                → CF delete + KV delete      │
│   POST   /domains/:id/routes         → map page + path            │
│   DELETE /domains/:id/routes/:rid    → unmap + KV                  │
│  Publish side-effect (optional later):                           │
│   after L1 publish → ensure R2 object + KV sync routes           │
│  CloudflareSaasService (create/get/delete hostname, KV put/del)  │
│  R2PublishService (put/delete HTML object)                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │ CF API / R2 API
┌───────────────────────────────▼─────────────────────────────────┐
│ Cloudflare — DATA PLANE                                         │
│  Zone: FREE_SITE_DOMAIN  → DNS *.FREE → Worker                   │
│  SaaS fallback origin: fallback.FREE (CNAME target cho user)     │
│  Custom Hostnames API                                            │
│  Workers KV: LANDING_ROUTES                                      │
│  R2: landing-published/{tenantOrUser}/{pageId}/{version}.html    │
│  Worker (deployed):                                              │
│    if Host endsWith .FREE → slug = label → serve R2 or /p/slug   │
│    else KV[hostname+path] → originSlug → serve R2 or proxy       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Priority resolve URL (public link)

1. `customPublicUrl` nếu domain VERIFIED + route + edge ok (hoặc flag cho phép pending URL hiển thị)  
2. `subdomainUrl` = `https://{slug}.{FREE_SITE_DOMAIN}` nếu Plan A on  
3. `platformUrl` = `{APP}/p/{slug}` luôn  

### 2.2 Priority serve (Worker)

1. Custom Host (SaaS) + KV hit → artifact  
2. Free subdomain Host → artifact by slug  
3. Miss → 404 / soft landing “domain not connected”

---

## 3. Phases triển khai

### Phase 0 — Chuẩn bị & ADR (0.5–1d)

**Deliverable**

- [ ] ADR ngắn: Nest = control plane CF; FE BFF domain API **proxy Nest** (hoặc deprecate FE CF client dần).  
- [ ] Chốt env names (staging):

| Env | Ví dụ | Dùng cho |
|-----|--------|----------|
| `FREE_SITE_DOMAIN` | `liora.app` | Wildcard free |
| `CUSTOM_DOMAIN_CNAME_TARGET` | `fallback.liora.app` | User CNAME |
| `CLOUDFLARE_ACCOUNT_ID` / `API_TOKEN` / `ZONE_ID` | — | SaaS + zone |
| `CLOUDFLARE_LANDING_ROUTES_KV_ID` | — | KV |
| `CLOUDFLARE_R2_*` + bucket | — | Artifact |
| `LANDING_FREE_SUBDOMAIN_ENABLED` | `true` staging | Plan A |
| `LANDING_CUSTOM_DOMAIN_EDGE_ENABLED` | `true` staging | Plan B |
| `LANDING_ORIGIN_BASE_URL` | `https://app.liora.app` | Worker proxy fallback |
| `LANDING_SERVE_MODE` | `origin` → `r2` | Feature flag serve |

- [ ] CF account: enable **SSL for SaaS / Custom Hostnames**, fallback origin, KV namespace, R2 bucket, Worker route.  
- [ ] Cập nhật `structure.md` note: “MVP serve origin; R2 phase 3” nếu team chốt hai bước (khuyến nghị).

**DoD:** checklist ops CF + ADR merge.

---

### Phase 1 — Control plane Nest (Custom Hostname đúng structure) (3–5d)

**Mục tiêu:** “User thêm domain → Nest gọi CF → PENDING + CNAME instruction”.

| Task | Chi tiết | Ưu tiên |
|------|----------|---------|
| 1.1 | `CloudflareSaasService` Nest: create / get / delete custom hostname (port từ FE client) | P0 |
| 1.2 | `DomainController` REST tenant-scoped (không chỉ RPC fixture) | P0 |
| 1.3 | Persist `landing_domains` **hoặc** dual-write Nest table + Supabase sync (chọn 1 SSOT — **khuyến nghị Supabase SSOT** giai Nest service dùng service role / internal API) | P0 |
| 1.4 | POST domain: status `PENDING`, lưu `cloudflare_hostname_id`, `cname_target` | P0 |
| 1.5 | POST refresh: poll CF → map `status` / `ssl_status` | P0 |
| 1.6 | DELETE domain: CF delete + cascade routes + KV | P0 |
| 1.7 | Routes CRUD Nest: map `domain_id` ↔ `landing_page_id` + `path_prefix` + `origin_slug` | P0 |
| 1.8 | FE domains API: **proxy Nest** (Bearer forward); bỏ dần gọi CF trực tiếp trong FE | P0 |
| 1.9 | Unit + contract tests Nest CF client (mock fetch) | P0 |

**Luồng sau Phase 1**

```text
UI Add domain
  → FE POST /api/landing-pages/domains (BFF)
  → Nest POST /api/domains
  → CF Custom Hostname API
  → DB PENDING + cname_target
  → UI: "CNAME shop.customer.com → fallback.liora.app"
UI Refresh
  → Nest poll CF → VERIFIED / ACTIVE when ready
```

**DoD:** staging với token thật: create hostname visible trên CF dashboard; refresh phản ánh status; delete sạch.

**Không làm Phase 1:** R2 serve, Worker production (có thể KV put stub).

---

### Phase 2 — Edge Worker production (Host routing) (3–4d)

**Mục tiêu:** Worker live theo structure (wildcard + custom).

| Task | Chi tiết |
|------|----------|
| 2.1 | Promote `landing-edge-worker.stub.ts` → package deployable (`tools/landing-edge-worker` hoặc `ladipage-fe-v2/cloudflare/worker`) |
| 2.2 | Bindings: `LANDING_ROUTES_KV`, `LANDING_ORIGIN_BASE_URL`, `FREE_SITE_DOMAIN`, optional R2 |
| 2.3 | Logic Host: free subdomain branch + custom KV branch (đã có trong stub — harden tests) |
| 2.4 | Nest/FE `CloudflareEdgeAdapter.syncRoute`: **real KV PUT/DELETE** khi credentials đủ |
| 2.5 | Publish hook: sau map route + publish → sync KV (idempotent) |
| 2.6 | DNS: `*.FREE_SITE` → Worker; custom hosts qua SaaS → Worker |
| 2.7 | Serve mode Phase 2 = **proxy origin** `GET {origin}/p/{slug}` (đúng structure “proxy về origin”, R2 sau) |
| 2.8 | E2E staging: free subdomain 200 + custom hostname 200 sau CNAME |

**DoD:**  
- `https://{slug}.FREE` trả HTML published  
- `https://shop.customer.com` (CNAME done + verified) trả đúng page  
- Local vẫn `/p/slug` không cần Worker  

---

### Phase 3 — Artifact R2 (serve từ object storage) (4–6d)

**Mục tiêu:** khớp dòng structure “Serve từ R2”.

| Task | Chi tiết |
|------|----------|
| 3.1 | `R2PublishService` Nest (hoặc FE server sau publish): upload `published_html` → key ổn định |
| 3.2 | Key scheme: `landing/{ownerId}/{pageId}/current.html` (+ version history optional) |
| 3.3 | Publish L1 success → put R2; unpublish → delete hoặc empty marker |
| 3.4 | Worker: prefer R2 get by slug/pageId from KV payload `{ r2Key, originSlug }` |
| 3.5 | Fallback origin nếu R2 miss (fail-soft) |
| 3.6 | Cache headers + purge on re-publish |
| 3.7 | Metrics: R2 hit rate, origin fallback count |

**KV payload mở rộng**

```json
{
  "originSlug": "cafe",
  "landingPageId": "uuid",
  "originBaseUrl": "https://app.liora.app",
  "r2Key": "landing/user/uuid/current.html"
}
```

**DoD:** Worker serve 100% từ R2 trên staging cho free + custom; origin chỉ fallback.

---

### Phase 4 — Product UX + harding (2–3d)

| Task | Chi tiết |
|------|----------|
| 4.1 | UI Domains panel: list, add, CNAME copy, status badge, refresh, map page/path, delete |
| 4.2 | Publish dialog: chọn domain route (domainId + path) — đã có body; wire UI |
| 4.3 | AI-SEO: `publicUrl` ưu tiên custom → free → platform (đã partial sau publish sync) |
| 4.4 | Quota + RLS regression |
| 4.5 | Observability: Nest logs CF errors; Worker log miss rate |
| 4.6 | Runbook ops: add domain troubleshooting, SSL pending, CNAME wrong |

---

### Phase 5 — Production cutover (1–2d)

- [ ] Flags on production  
- [ ] CF SaaS billing check  
- [ ] Rollback: `LANDING_CUSTOM_DOMAIN_EDGE_ENABLED=false` + Worker route off → platform only  
- [ ] Load test Worker + R2  
- [ ] Update `structure.md` status: Implemented (date) + link plan  

---

## 4. Data model (giữ + bổ sung)

### 4.1 Giữ (Supabase)

| Table | Role |
|-------|------|
| `landing_pages` | slug, published_html, status |
| `landing_domains` | name, status, ssl_status, cloudflare_hostname_id, cname_target |
| `landing_domain_routes` | domain_id, landing_page_id, path_prefix, origin_slug, edge_status |

### 4.2 Bổ sung (Phase 3)

| Field / table | Mục đích |
|---------------|----------|
| `landing_pages.r2_object_key` (nullable) | Key current artifact |
| `landing_pages.r2_synced_at` | Audit |
| Optional `landing_publish_artifacts` | versioned R2 keys |

### 4.3 Nest

- Service layer gọi Supabase service role **hoặc** mirror TypeORM nếu team đã chọn SSOT Nest — **khuyến nghị 1 SSOT = Supabase landing_*** để FE list không dual-write lệch.

---

## 5. API surface (Nest — target)

```text
POST   /api/landing-domains
GET    /api/landing-domains
GET    /api/landing-domains/:id
POST   /api/landing-domains/:id/refresh
DELETE /api/landing-domains/:id

POST   /api/landing-domains/:id/routes
GET    /api/landing-domains/:id/routes
DELETE /api/landing-domains/:id/routes/:routeId

# Internal / publish side-effect (optional)
POST   /api/landing-domains/edge/sync-page   { pageId, slug }
```

FE BFF `app/api/landing-pages/domains/*` → forward Nest (giữ URL FE ổn định).

---

## 6. Sequence diagrams

### 6.1 Add customer domain (structure.md)

```text
User → FE UI → FE BFF → Nest DomainService
                              │
                              ├─ insert domain PENDING
                              ├─ CF createCustomHostname
                              ├─ save cloudflare_hostname_id
                              └─ return { cnameTarget, status }
User → DNS provider: CNAME shop.customer.com → fallback.saas.com
User → FE Refresh → Nest → CF get hostname → VERIFIED/ACTIVE
```

### 6.2 Map + publish + serve

```text
User map route: domain + path → page
  → Nest save landing_domain_routes + KV put

User Publish page
  → L1 HTML Supabase
  → (P3) R2 put
  → sync all routes KV (origin_slug = slug)
  → AI-SEO sync (optional, fail-soft)

Visitor Host: shop.customer.com
  → CF → Worker
  → KV get
  → R2 get HTML  (or proxy ORIGIN/p/slug)
  → 200
```

### 6.3 Free subdomain (structure wildcard)

```text
Publish → subdomainUrl https://slug.FREE
Visitor Host slug.FREE
  → Worker / Next middleware
  → serve same artifact as /p/slug
```

---

## 7. Testing strategy

| Lớp | Nội dung |
|-----|----------|
| Unit | CF client mock, domain util, Worker pure functions, resolvePublicUrls priority |
| Integration Nest | Domain CRUD + mock CF + DB |
| Contract | FE BFF proxy status codes |
| Staging E2E | Add domain → CNAME (manual/real) → verified → map → publish → curl Host header 200 |
| Regression | Local flags off = only /p/slug; publish without domain still OK |
| Isolation | User A domain không resolve page user B |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| CF SaaS cost / quota | Quota plan + soft limit Nest |
| SSL pending lâu | UI clear + retry refresh; email later |
| Apex domain `@` | Doc: dùng www / CNAME flattening; apex phase sau |
| Dual SSOT FE+Nest | Phase 1 chốt Supabase SSOT; Nest service role |
| Worker cold / miss | Fallback origin; alert KV miss |
| R2 eventual consistency | version key + cache purge |
| OpenSEO scan localhost | Custom/free public host only — đã document |

---

## 9. Ước lượng & thứ tự làm

| Phase | Effort | Phụ thuộc |
|-------|--------|-----------|
| P0 ADR + CF ops | 0.5–1d | — |
| P1 Nest control plane | 3–5d | P0 |
| P2 Worker deploy + proxy | 3–4d | P1 (KV sync), DNS |
| P3 R2 serve | 4–6d | P2 |
| P4 UX + AI-SEO polish | 2–3d | P1–P2 |
| P5 Prod cutover | 1–2d | P2 min; P3 optional |

**Critical path structure.md:** P0 → **P1 (Nest CF)** → **P2 (Worker)** → P4 UI → P5.  
**R2 (P3)** có thể song song sau P2 hoặc lùi nếu cần ship custom domain sớm (serve origin vẫn đúng “proxy về origin” trong structure).

**MVP “đúng structure tối thiểu” (không R2):** P0 + P1 + P2 + P4 partial + P5.  
**Full structure (có R2):** + P3.

---

## 10. Checklist DoD tổng

- [ ] Nest là nơi duy nhất create/delete/check Custom Hostname (FE không còn CF token)  
- [ ] User nhận CNAME target = fallback.saas.com  
- [ ] CF validate + SSL phản ánh trên UI  
- [ ] Free: `*.FREE` → Worker → đúng page  
- [ ] Custom: Host customer → Worker → đúng page  
- [ ] Publish không fail khi edge down; edge_status visible  
- [ ] (Full) Serve primary từ R2  
- [ ] structure.md cập nhật “Implemented” + link plan này  
- [ ] E2E staging signed-off  

---

## 11. File / module chạm chính (preview implement)

| Vùng | Path |
|------|------|
| Nest domain | `apps/ladipage-backend/src/modules/domain/*` |
| Nest CF | new `cloudflare-saas.service.ts` (từ util + FE client) |
| Nest R2 | new `modules/publish/r2-artifact.service.ts` (P3) |
| FE domains API | `ladipage-fe-v2/src/app/api/landing-pages/domains/**` → proxy Nest |
| FE edge | `features/landing-domain-edge/**` (adapter gọi Nest edge sync) |
| Worker | promote `cloudflare/landing-edge-worker.stub.ts` |
| Docs | `docs/landing/structure.md` status footer |

**Không đụng:** AI-SEO core, Umami, OpenSEO MCP (chỉ consume `publicUrl` sau domain live).

---

## 12. Đề xuất bước làm ngay (khi approve)

1. Merge ADR Phase 0 + chốt SSOT Supabase.  
2. Implement **P1** Nest Domain REST + proxy FE (đúng câu “NestJS gọi Cloudflare API” trong structure).  
3. Deploy **P2** Worker staging + 1 domain test.  
4. Quyết định ship prod với serve origin trước, R2 (P3) sprint sau.

---

*Plan này supersede thứ tự rời rạc A/B: A + B chạy song song dưới một rollout structure; chi tiết task A/B vẫn tham chiếu FREE/CUSTOMER plans.*
