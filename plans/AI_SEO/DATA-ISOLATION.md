# AI-SEO / Umami — Chính sách tách biệt dữ liệu (Data Isolation)

> **Phạm vi:** Chuẩn isolation dùng chung cho mọi plan trong `plans/AI_SEO/`.  
> **Áp dụng:** `AI-SEO-LANDING-INTEGRATION.md`, `UMAMI-MICROSERVICE-ADAPTER.md`, và PR implement liên quan.  
> **Ngày soạn:** 2026-07-16  
> **Trạng thái:** Draft — bắt buộc review Security/BE trước production cutover

---

## 1. Mục tiêu

1. **Tenant (workspace) A không đọc/ghi** SEO project, task, job, keyword cache, integration, traffic map của tenant B.  
2. **User không được vượt quyền** trong cùng tenant (khi RBAC bật): viewer ≠ deployer.  
3. **App lớn không trộn schema/API:** AI-SEO / Landing publish / CRM Analytics / Umami raw / OpenSEO raw.  
4. **Microservice** (Umami, OpenSEO) không phải trust boundary duy nhất — **Nest là enforcement point** multi-tenant.  
5. Mọi lỗ hổng isolation là **P0 blocker** ship production.

---

## 2. Mô hình ranh giới (layers)

```
┌─────────────────────────────────────────────────────────────┐
│ L0  Platform auth (JWT) + TenantGuard + permission app:*    │
├─────────────────────────────────────────────────────────────┤
│ L1  Liora Postgres: lp_seo_*, pages — EVERY row has tenant_id│
├─────────────────────────────────────────────────────────────┤
│ L2  Domain services: assert ownership before external IDs     │
├─────────────────────────────────────────────────────────────┤
│ L3  Adapters: OpenSeoClient / UmamiClient (server secrets)    │
├─────────────────────────────────────────────────────────────┤
│ L4  Microservices: no public multi-tenant UI for end-users    │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Ai enforce | Fail closed? |
|-------|------------|--------------|
| L0 | Nest guards | 401/403 |
| L1 | Query `tenantId = requireTenantId()` | 404 (không 403 leak existence nếu policy hide) |
| L2 | `findProjectOrFail`, job join project.tenant | 404 |
| L3 | Chỉ gọi external id **sau** L1/L2 pass | Không call outbound |
| L4 | Network internal + service account | Ops only |

---

## 3. Tenant isolation (bắt buộc MVP)

### 3.1 Database Liora

| Bảng / dữ liệu | Rule |
|----------------|------|
| `lp_seo_project` | `tenant_id` NOT NULL; index `(tenant_id, …)` |
| `lp_seo_project_page` | `tenant_id` + `seo_project_id` thuộc cùng tenant |
| `lp_seo_task` | Truy cập qua join `project.tenant_id` (không query task id trần không join) |
| `lp_seo_keyword_cache` | PK/lookup có `tenant_id` |
| `lp_seo_integration` | unique `(tenant_id, provider)` |
| Landing `PageEntity` | `tenant_id` khi list/connect/publish |
| Cache keys | Prefix `tenant:{id}:…` (memory/Redis) — **cấm** key chỉ `projectId` |

### 3.2 API

| Rule ID | Rule |
|---------|------|
| I-T1 | Mọi controller AI-SEO / traffic: `@UseGuards(TenantGuard)` (hoặc chain auth tương đương). |
| I-T2 | **Không** tin `orgId` / `x-org-id` / body `tenantId` từ FE làm source of truth. |
| I-T3 | Path param `projectId`, `taskId`, `jobId`, `pageId`: load + so `tenantId`; mismatch → **404**. |
| I-T4 | List endpoints: `WHERE tenant_id = :tenant` luôn có; cấm “list all” admin trên API user. |
| I-T5 | Dual-mode BFF: sau cutover Nest, **freeze write** BFF path lệch tenant; trước cutover document risk. |
| I-T6 | Quota / rate limit theo `tenantId` (và optional `storeId`). |

### 3.3 External IDs (OpenSEO / Umami)

| Rule ID | Rule |
|---------|------|
| I-E1 | `openseo_project_id`, `umami_website_id`, `external_task_id` **không** expose như capability: client chỉ gửi Liora UUID. |
| I-E2 | Trước mọi `OpenSeoClient.*` / `UmamiClient.*`: đã resolve entity local + tenant match. |
| I-E3 | Response FE **có thể** ẩn external ids (hoặc chỉ internal admin); default product API không cần trả Umami website id. |
| I-E4 | Naming provision: prefix gợi ý `t{tenantId}-{slug}` trên OpenSEO/Umami để ops phân biệt (không thay thế I-E2). |

### 3.4 Tests bắt buộc (tenant)

| # | Case | Pass |
|---|------|------|
| IT1 | Tenant A token + `projectId` của B → 404 mọi method | |
| IT2 | Tenant A + `jobId`/`taskId` của B → 404, **0** call OpenSEO/Umami | |
| IT3 | Tenant A list không chứa row tenant B | |
| IT4 | Keyword cache seed hash trùng nội dung khác tenant → **không** share row | |
| IT5 | Traffic API: map websiteId của B không đọc được qua project A | |

---

## 4. Store / sub-workspace (khuyến nghị chốt ADR)

Field `store_id` trên `lp_seo_project` đã có trong schema.

| Mode | Hành vi | Khi nào |
|------|---------|---------|
| **S0 — Tenant only (MVP default)** | Mọi user trong tenant (đủ permission app) thấy mọi SEO project của tenant; `storeId` optional filter UI | MVP AI-SEO |
| **S1 — Store-scoped** | Header/context `store-id` bắt buộc với app multi-store; query `tenant_id AND store_id`; cross-store → 404 | Khi Ecom/store isolation bắt buộc |
| **S2 — Store + deny null** | Project phải có `store_id`; legacy null migrate | Sau S1 ổn định |

**Plan mặc định ship:** **S0**, document upgrade path **S1**.  
Mọi PR list/create phải **không chặn** thêm filter `storeId` sau này (không hardcode “ignore store forever”).

---

## 5. User isolation & RBAC (trong tenant)

### 5.1 MVP (tối thiểu)

| Rule ID | Rule |
|---------|------|
| I-U1 | User phải authenticated + thuộc tenant context. |
| I-U2 | App gate: permission `app:aiseo:use` (và suite con nếu bật) trước write AI-SEO. |
| I-U3 | **Chưa** tách “chỉ thấy project mình tạo” trừ khi product yêu cầu — default **workspace-shared**. |
| I-U4 | Mọi action đổi trạng thái (deploy, approve, reject, scan): ghi `actorUserId` (hoặc equivalent) vào audit trail `task.result` / log có cấu trúc. |

### 5.2 Phase sau (P6 / hardening) — nếu product yêu cầu

| Role (logical) | Read project | Scan | Approve/Reject | Deploy meta | Connect landing | Admin provision Umami |
|----------------|--------------|------|----------------|-------------|-----------------|------------------------|
| Viewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Editor | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Admin / Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Implement: Nest guards/permissions — **không** dựa FE ẩn nút.

### 5.3 Tests user

| # | Case |
|---|------|
| IU1 | User không có `app:aiseo:use` → 403 write |
| IU2 | (Khi RBAC bật) Viewer gọi deploy → 403 |
| IU3 | Audit log có user id sau deploy |

---

## 6. Tách biệt giữa các app lớn

### 6.1 Boundary matrix

| App / domain | Data store | API prefix | Được đọc AI-SEO? | AI-SEO được đọc? |
|--------------|------------|------------|------------------|------------------|
| **AI-SEO** | `lp_seo_*` | `/api/ai-seo/*` | — | — |
| **Landing / Publish** | pages, published_html | publish / landing-cms | SEO đọc page meta/url **qua service** | Publish gọi ensure/inject **qua hook** — không SQL chéo lung tung |
| **CRM Analytics** | `lp_analytics_*` / reports | `/api/analytics/*` | **Không** | **Không** |
| **Ecom** | orders, products | ecom controllers | **Không** (trừ future explicit) | **Không** |
| **Umami** | DB riêng | chỉ Nest adapter | Nest map only | Collect browser → Umami, không qua CRM |
| **OpenSEO** | DB/MS riêng | MCP internal | Nest map only | Nest only |

### 6.2 Rules

| Rule ID | Rule |
|---------|------|
| I-A1 | **Cấm** AI-SEO service import repository CRM/Ecom trừ facade được approve. |
| I-A2 | Cache/redis key namespace: `aiseo:`, `umami:`, `openseo:` — không overlap. |
| I-A3 | DTO traffic Umami **không** merge vào `holisticScores` OpenSEO. |
| I-A4 | Suite kho (`SiteMetrics`, `Local`, `Keywords`…): permission code riêng; data vẫn `tenant_id`; feature flag per app install. |
| I-A5 | Module `analytics` (sales) **không** dùng làm backend traffic landing. |
| I-A6 | Secrets: `OPENSEO_*`, `UMAMI_*`, DataForSEO — scope service; không share một “god key” log ra client. |

### 6.3 Integration cho phép (explicit)

| From | To | Channel |
|------|-----|---------|
| Publish | AI-SEO | `onLandingPagePublished` / ensure / inject hook |
| AI-SEO Task deploy | Publish | patch meta API nội bộ |
| AI-SEO Traffic | Umami | UmamiClient sau tenant check |
| AI-SEO Scan | OpenSEO | OpenSeoClient sau tenant check |
| FE | AI-SEO | JWT + TenantGuard only |

Mọi channel khác = **out of policy** cần ADR.

---

## 7. Microservice isolation (Umami & OpenSEO)

| Rule ID | Rule |
|---------|------|
| I-M1 | Port MS **không** public internet end-user (internal docker network / private VPC). |
| I-M2 | End-user **không** login Umami/OpenSEO admin; chỉ ops/break-glass. |
| I-M3 | Một service account Nest; rotate key; không embed key trong HTML (chỉ `website-id` public cho collect script — đây là design Umami, chấp nhận được). |
| I-M4 | Collect script: public by design; **stats API** không public không auth. |
| I-M5 | OpenSEO `AUTH_MODE=local_noauth` chỉ safe khi network isolated — document risk staging vs prod. |
| I-M6 | Xóa/archive SEO project (phase sau): policy xóa hoặc orphan external website — không để ID dangling dùng lại nhầm tenant. |

---

## 8. FE / BFF isolation

| Rule ID | Rule |
|---------|------|
| I-F1 | Browser **không** gọi Umami/OpenSEO admin API. |
| I-F2 | `NEXT_PUBLIC_*` không chứa secret analytics. |
| I-F3 | Dual-mode: BFF Supabase org ≠ Nest tenant — cutover plan phải map 1-1 hoặc freeze BFF writes. |
| I-F4 | FE không “đoán” tenant từ query string để bypass. |

---

## 9. Logging & PII

| Rule ID | Rule |
|---------|------|
| I-L1 | Không log JWT, API keys, Umami/OpenSEO tokens. |
| I-L2 | Log được `tenantId`, `projectId`, `requestId`; hạn chế raw URL query có PII. |
| I-L3 | Traffic/stats aggregate OK; không lưu form field lead trong Umami event value nếu policy cấm PII. |
| I-L4 | Error FE: message generic; không stack / internal host MS. |

---

## 10. DoD isolation (gate production)

Ship AI-SEO landing / Umami traffic **production** chỉ khi:

1. IT1–IT5 pass (tenant).  
2. I-T1–I-T6, I-E1–I-E4 implement hoặc documented exception.  
3. I-A1–I-A6 review architecture.  
4. I-M1–I-M5 verified trên staging network.  
5. IU1 pass (app permission).  
6. Không còn BFF write path production cho AI-SEO **hoặc** BFF enforce cùng tenant map đã chứng minh.  
7. Security sign-off ngắn (checklist này).

---

## 11. Phase gắn isolation vào delivery

| Wave | Isolation focus |
|------|-----------------|
| Umami W1–W2 | I-E*, I-M*, IT2/IT5, cache key tenant, circuit không leak body cross-tenant |
| Landing P1 | I-T*, connect page tenant-scoped |
| Landing P2 | Publish ownership page; inject không đụng project tenant khác |
| Landing P5 cutover | I-F3 freeze BFF; IT full regression |
| Hardening P6 / U5 | S1 store (nếu cần), RBAC §5.2, I-M6 lifecycle |

---

## 12. Liên kết

| Document | Vai trò |
|----------|---------|
| `AI-SEO-LANDING-INTEGRATION.md` | § Data isolation (landing + OpenSEO) |
| `UMAMI-MICROSERVICE-ADAPTER.md` | § Data isolation (traffic + Umami) |
| `docs/Kho-ung-dung/plan-be-ai-seo-openseo.md` | TenantGuard nguyên tắc gốc |
| Code `TenantScopedService` / entities `tenantId` | Implementation reference |

---

## Lịch sử

| Ngày | Thay đổi |
|------|----------|
| 2026-07-16 | Tạo chuẩn isolation dùng chung plans/AI_SEO |
