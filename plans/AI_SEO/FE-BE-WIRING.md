# Plan — Đấu nối FE-v2 AI-SEO ↔ ladipage-backend

> **Ngày:** 2026-07-16  
> **Scope:** `ladipage-fe-v2` + `liora-monorepo/apps/ladipage-backend` (+ api-types).  
> **Không:** Docker Umami trong compose Liora (Umami base `localhost:3002` đã chạy).  
> **Không:** Đổi logic module không liên quan.

---

## 1. Phân tích FE-v2 AI-SEO (hiện trạng)

| Lớp | Path | Ghi chú |
|-----|------|---------|
| Dual mode | `features/ai-seo/utils/ai-seo-api-mode.ts` | `NEXT_PUBLIC_AI_SEO_USE_NEST` |
| Feature API | `features/ai-seo/api/*` | BFF `/api/ai-seo/*` **hoặc** Nest `aiSeoApi` |
| Nest client | `lib/endpoints/ai-seo.api.ts` | Projects, pages, jobs, tasks, website publish — **chưa traffic** |
| Mapper | `lib/mappers/ai-seo.mapper.ts` | DTO → list card |
| UI cards | `SeoProjectCard` + `SeoProjectScoreCards` | Scores OpenSEO only |
| Env | `.env.example` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AI_SEO_USE_NEST=false` |
| Types | `packages/@liora/api-types` (mirror BE) | Chưa traffic envelope |

**Gap:** BE đã có `/ai-seo/projects/:id/traffic*` + publish wire; FE chưa client/hook/UI traffic; default Nest flag off → vẫn BFF mock.

---

## 2. Mục tiêu phase này

1. Types traffic shared (BE + FE packages).  
2. Nest client methods traffic (health, stats, metrics, timeseries, provision).  
3. Feature layer `traffic.api.ts` + React Query hooks.  
4. UI `SeoProjectTrafficCards` trên project card (Nest mode).  
5. Env docs: Nest on + BE Umami `3002`.  
6. Unit tests FE mapper/traffic + BE regression focused.

**Ngoài phase:** Chat BFF, full dashboard redesign, inject L3 Instatic.

---

## 3. Contract FE ↔ BE

| FE | BE |
|----|-----|
| `GET .../traffic?range=7d\|30d` | `AiSeoTrafficController` |
| Envelope `status: ok\|degraded\|not_configured\|disabled` | Fail-soft, **không** 500 khi Umami down |
| Auth JWT Nest + tenant | `TenantGuard` (không `x-org-id`) |
| Flag Nest off | FE **không** gọi Umami; trả `disabled` local |

---

## 4. Env

**FE**

```bash
NEXT_PUBLIC_API_URL=http://localhost:7002/api
NEXT_PUBLIC_AI_SEO_USE_NEST=true
```

**BE** (đã có)

```bash
UMAMI_ENABLED=true
UMAMI_BASE_URL=http://localhost:3002
UMAMI_PUBLIC_SCRIPT_URL=http://localhost:3002
UMAMI_API_KEY=...
```

---

## 5. Deliverables file

| File | Action |
|------|--------|
| `liora/.../libs/api-types/src/ai-seo.ts` | + traffic types |
| `fe-v2/packages/@liora/api-types/src/ai-seo.ts` | mirror |
| `fe-v2/src/lib/endpoints/ai-seo.api.ts` | + traffic methods |
| `fe-v2/src/features/ai-seo/api/traffic.api.ts` | dual-mode |
| `fe-v2/src/features/ai-seo/hooks/useTrafficQueries.ts` | RQ |
| `fe-v2/src/features/ai-seo/components/SeoProjectTrafficCards.tsx` | UI |
| `fe-v2/src/lib/mappers/ai-seo-traffic.mapper.ts` | map envelope |
| Tests | vitest + jest focused |

---

## 6. Acceptance

- [x] Nest flag on → card traffic gọi BE (unit traffic.api).  
- [x] Nest flag off → không crash, status disabled (unit).  
- [x] Degraded envelope map + UI banner (mapper + component).  
- [x] Tests pass trong scope (FE vitest 9, BE jest 28 focused).  

## 7. Hai luồng song song + auto publish

| Luồng | Entry | Hành vi |
|-------|--------|---------|
| **Thủ công** | FE tạo project → connect → publish | Reuse project (landingPageId / hostname tenant) |
| **Auto** | `completeLandingPublish` / website publish Nest | `afterPublish`: ensure → **autoLink** `lp_seo_project_page` → Umami → inject |

Thứ tự auto: **ensure+link trước, inject sau** (first publish đã có script).  
`ensureSeoProject: false` → tắt auto (manual-only publish flag).

Private data: mọi ensure/link/inject filter `tenantId`; autoLink từ chối project id khác tenant.

## 8. Lịch sử

| Ngày | Thay đổi |
|------|----------|
| 2026-07-16 | Plan + implement FE traffic wire + types + tests |
| 2026-07-16 | Auto link on publish + reorder inject; private-data tests |
