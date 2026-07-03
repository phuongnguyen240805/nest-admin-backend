# Plan BE — AI SEO (OpenSEO Microservice Adapter)

> **Nguồn checklist:** `AI-SEO.md`, `checklist-openseo.md`  
> **OpenSEO repo:** `open-seo/` (every-app/open-seo v0.0.22, Docker port mặc định `3001` → map `7003` trong stack Liora)  
> **App codes kho:** `AiSeo` (FE `17`), suite: `SiteMetrics`, `Local`, `Content`, `Keywords`, `Reports`, `Authority`  
> **Ngày:** 2026-07-01 (cập nhật theo phân tích OpenSEO)  
> **Phạm vi:** Module Nest adapter — FE migrate từ Next BFF `/api/ai-seo` sang `/api/ai-seo` Nest; tự động SEO landing page

---

## 1. Nguyên tắc triển khai

### 1.1 BE nhẹ — OpenSEO là microservice

```
FE → ladipage-backend /api/ai-seo/* → OpenSeoClient → OpenSEO :7003
                    ↓
              Supabase/Postgres (cache, projects, tasks)
                    ↓
              PublishModule (landing page context)
```

| Quy tắc | Chi tiết |
|---------|----------|
| **Không nhét logic SEO nặng vào Nest** | Keyword research, audit, MCP → delegate OpenSEO |
| **Nest quản:** tenant, quota, cache, mapping landing page, billing pass-through |
| **FE chỉnh input** | Form create project: `hostname` → BE chuẩn hóa thành `slug` + `landingPageId` |
| **Response shape ổn định** | Giữ field FE đang dùng (`taskStatus`, `holisticScores`, …) qua mapper |

### 1.2 Hiện trạng

| Layer | Trạng thái |
|-------|------------|
| BE `modules/ai-seo/` | ❌ Chưa có |
| FE `/api/ai-seo/*` | ✅ 39 route Next.js — đọc/ghi Supabase `landing_pages` + `mockDb` |
| FE `projects.api.ts` | `POST { name }`, `GET ?orgId=` — **orgId FE gửi nhưng BFF không dùng** |
| Docker OpenSEO | ❌ Chưa có |
| Catalog `AiSeo` | ✅ Seed `app-store` |

### 1.3 Đối chiếu nhanh `checklist-openseo.md`

| Checklist kết luận | Bổ sung vào plan |
|--------------------|------------------|
| OpenSEO match ~95% FE AI-SEO | §5 inventory MCP + serverFn mapping |
| Phase 1: project setup, audit, keywords, tasks | §5.4 P0/P1, §7.1–7.4 flows |
| Phase 2: 6 suite apps kho | §5.5, §9 |
| MCP `executeMcpSkill` linh hoạt | §6 `callMcpTool` / `executeSkill`, PR-S8 |
| GSC/GBP + per-tenant DataForSEO key | §4.6, `lp_seo_integration` |
| PR-S1 → S3 → contract test | §10 lộ trình cập nhật |

---

## 2. Kiến trúc module

```
apps/ladipage-backend/src/modules/
  ai-seo/
    ai-seo.module.ts
    controllers/
      ai-seo-projects.controller.ts
      ai-seo-tasks.controller.ts
      ai-seo-integrations.controller.ts
      ai-seo-keywords.controller.ts      # phase 2 — suite apps
    dto/
      create-seo-project.dto.ts
      update-seo-project.dto.ts
      list-seo-projects-query.dto.ts
      keyword-research.dto.ts
      site-audit.dto.ts
      seo-task-action.dto.ts
    entities/
      seo-project.entity.ts
      seo-task.entity.ts
      seo-keyword-cache.entity.ts
      seo-integration.entity.ts
    services/
      ai-seo-project.service.ts
      ai-seo-task.service.ts
      ai-seo-integration.service.ts
      openseo-client.service.ts
      ai-seo-cache.service.ts
      ai-seo-quota.service.ts
    mappers/
      seo-project.mapper.ts

apps/ladipage-backend/libs/openseo-client/                     # optional phase 1b
  src/
    openseo-http.client.ts
    types/
```

Import vào `app.module.ts` sau `PublishModule` (cần `pageId` context).

---

## 3. Database

### 3.1 `lp_seo_project`

| Column | Type | Ghi chú |
|--------|------|---------|
| `id` | uuid PK | |
| `tenant_id` | int | |
| `store_id` | varchar | |
| `landing_page_id` | uuid nullable | Link Supabase landing |
| `name` | varchar | |
| `hostname` | varchar | domain/slug hiển thị |
| `slug` | varchar | normalized |
| `status` | `draft` \| `active` \| `archived` | |
| `openseo_project_id` | varchar nullable | ID trên OpenSEO |
| `task_status` | varchar | `pending`, `running`, `done` |
| `pixel_tag_state` | varchar | `not_installed`, `installed` |
| `is_favorite` | boolean | |
| `holistic_scores` | jsonb | `{ technicalsScore, uxScore, … }` |
| `connected_data` | jsonb | GSC/GBP flags |
| `last_analysis_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

### 3.2 `lp_seo_task`

| Column | Type |
|--------|------|
| `id` | uuid |
| `seo_project_id` | FK |
| `external_task_id` | varchar |
| `type` | `AUDIT`, `KEYWORD`, `DEPLOY`, … |
| `status` | `pending`, `approved`, `rejected`, `deployed` |
| `payload` | jsonb |
| `result` | jsonb |

### 3.3 `lp_seo_keyword_cache`

Cache OpenSEO response — TTL Redis + fallback DB.

---

## 4. API REST — Phase 1 (parity FE hiện tại)

Base: `/api/ai-seo/*` — thay thế toàn bộ Next BFF.

### 4.1 Projects (map FE dashboard)

| Method | Path | Input DTO | Output |
|--------|------|-----------|--------|
| `GET` | `/ai-seo/projects` | `ListSeoProjectsQueryDto { page?, pageSize?, favorite? }` | `SeoProjectDto[]` |
| `POST` | `/ai-seo/projects` | `CreateSeoProjectDto` | `SeoProjectDto` |
| `GET` | `/ai-seo/projects/:id` | — | `SeoProjectDto` |
| `PATCH` | `/ai-seo/projects/:id` | `UpdateSeoProjectDto` | `SeoProjectDto` |
| `DELETE` | `/ai-seo/projects/:id` | — | `void` |
| `POST` | `/ai-seo/projects/:id/favorite` | `{ favorite: boolean }` | `SeoProjectDto` |
| `POST` | `/ai-seo/projects/:id/scan` | `ScanProjectDto { depth?: 'quick' \| 'full' }` | `{ jobId }` |
| `GET` | `/ai-seo/projects/:id/agent-status` | — | `AgentStatusDto` |

### 4.2 `CreateSeoProjectDto` — chuẩn hóa FE input

```typescript
export class CreateSeoProjectDto {
  /** FE hiện gửi hostname — BE normalize */
  @IsString() @MinLength(1)
  hostname: string;

  @IsOptional() @IsString()
  name?: string;

  /** FE mới: link landing có sẵn thay vì tạo mới */
  @IsOptional() @IsUUID()
  landingPageId?: string;

  /** Bỏ orgId từ query — tenant lấy từ JWT */
}
```

**FE chỉnh:**
- Bỏ header `x-org-id` / query `orgId` — dùng `TenantGuard`
- Form create: giữ `hostname` + `name`; thêm optional `landingPageId` picker
- `fetchProjects()` → `aiSeoApi.listProjects()`

### 4.3 `SeoProjectDto` — giữ shape FE

```typescript
export interface SeoProjectDto {
  id: string;
  uuid: string;           // alias id — FE legacy
  projectId: string;      // alias id
  hostname: string;
  name: string;
  slug: string;
  status: string;
  taskStatus: string;
  pixelTagState: string;
  isFavorite: boolean;
  isEngaged: boolean;
  isFrozen: boolean;
  holisticScores: HolisticScoresDto;
  connectedData: ConnectedDataDto;
  afterSummary: { healthyPages: number; totalPages: number };
  aiGradeOverall: number;
  siteAudit: Record<string, unknown>;
  readyForProcessing: boolean;
  isFirstProcessing: boolean;
  timeSavedTotal: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}
```

Mapper `seo-project.mapper.ts` đảm bảo FE **không phải đổi UI card** — chỉ đổi API client.

### 4.4 Landing pages sub-resource

| Method | Path | Ghi chú |
|--------|------|---------|
| `GET` | `/ai-seo/projects/:id/landing-pages` | List pages gắn project |
| `GET` | `/ai-seo/projects/:id/landing-pages/:pageId` | Detail |
| `POST` | `/ai-seo/projects/:id/landing-pages/:pageId/scan` | Trigger OpenSEO |
| `GET` | `/ai-seo/projects/:id/landing-pages/:pageId/scores` | Scores |
| `GET` | `/ai-seo/projects/:id/landing-pages/:pageId/tasks` | Tasks |

Đọc `landing_pages` qua `SupabaseService` hoặc `PublishModule` — không duplicate logic FE BFF.

### 4.5 SEO Projects & Tasks (setup flow)

| Method | Path |
|--------|------|
| `POST` | `/ai-seo/seo-projects` |
| `GET` | `/ai-seo/seo-projects/:id` |
| `POST` | `/ai-seo/seo-projects/:id/setup` |
| `POST` | `/ai-seo/seo-projects/:id/start-audit` |
| `GET` | `/ai-seo/seo-projects/:id/installation` |
| `GET` | `/ai-seo/seo-projects/:id/installation/check` |
| `GET` | `/ai-seo/seo-projects/:id/tasks` |
| `PATCH` | `/ai-seo/seo-tasks/:id/approve` |
| `PATCH` | `/ai-seo/seo-tasks/:id/reject` |
| `POST` | `/ai-seo/seo-tasks/:id/deploy` |

### 4.6 Integrations (GSC/GBP)

| Method | Path |
|--------|------|
| `GET` | `/ai-seo/integrations/google/gsc/connect-url` |
| `GET` | `/ai-seo/integrations/google/gbp/connect-url` |
| `GET` | `/ai-seo/integrations/google/gsc/callback` |
| `GET` | `/ai-seo/integrations/google/gbp/callback` |

Query: `projectId` (required) — validate tenant ownership.

### 4.7 Jobs & Agents (async)

| Method | Path |
|--------|------|
| `GET` | `/ai-seo/jobs/:jobId` |
| `GET` | `/ai-seo/jobs/:jobId/events` | SSE optional |
| `GET` | `/ai-seo/agents` |
| `GET/POST` | `/ai-seo/conversations`, `/ai-seo/conversations/:id` |

---

## 5. OpenSEO — Inventory chức năng (đối chiếu `checklist-openseo.md`)

OpenSEO expose **2 lớp API** mà Nest adapter cần wrap:

| Lớp | Cơ chế | Nest gọi thế nào |
|-----|--------|------------------|
| **MCP Tools** | 18 tools tại `/mcp` (17 nghiệp vụ + `whoami`) | `OpenSeoMcpClient.callTool(name, input)` — **ưu tiên cho agent + automation** |
| **Server Functions** | TanStack `createServerFn` nội bộ app | Không có REST public — Nest **không gọi trực tiếp**; map qua MCP hoặc bridge HTTP riêng (PR-S2b) |

Self-host Docker: `AUTH_MODE=local_noauth`, `DATAFORSEO_API_KEY` bắt buộc, volume `.wrangler` cho D1 local.

### 5.1 MCP Tools — danh sách đầy đủ (18 tools, `open-seo/src/server/mcp/server.ts`)

| MCP Tool | Mục đích | Dùng cho Ladipage AI-SEO |
|----------|----------|--------------------------|
| `whoami` | Xác thực context | Health check adapter |
| `list_projects` | List project OpenSEO | Sync `lp_seo_project.openseo_project_id` |
| `research_keywords` | Keyword discovery (DataForSEO) | **Landing: gợi ý từ khóa theo page/topic** |
| `get_keyword_metrics` | Volume, KD, intent, CPC (≤700 kw) | **Landing: chấm điểm keyword đã chọn** |
| `save_keywords` | Lưu keyword vào project | Task approve → lưu cluster |
| `list_saved_keywords` | Đọc keyword đã lưu | Keywords suite / Content planning |
| `get_domain_overview` | Organic footprint domain | SiteMetrics suite |
| `get_domain_keyword_suggestions` | Gợi ý keyword theo domain | Competitor gap |
| `get_ranked_keywords` | Keyword domain đang rank | **Landing: so sánh page vs competitor** |
| `get_serp_results` | SERP live inspection | Validate intent trước khi deploy meta |
| `find_serp_competitors` | SERP competitors | Competitive landscape |
| `get_backlinks_overview` | Backlink summary | Authority suite (phase 2) |
| `get_backlinks_profile` | Chi tiết backlink | Authority suite |
| `get_rank_tracker` | Vị trí keyword theo thời gian | Keywords suite — rank tracking |
| `search_local_businesses` | Local business search | Local suite |
| `get_local_serp_results` | Maps/local SERP | Local suite |
| `get_google_business_questions` | GBP Q&A | Local suite |
| `get_search_console_performance` | GSC clicks/impressions (**0 credit**) | **Landing: striking-distance queries** |
| `inspect_urls` | URL inspection index status (**0 credit**) | **Landing: kiểm tra index sau publish** |

### 5.2 Agent Skills — workflow cao cấp (gọi qua `executeMcpSkill`)

| Skill | File | Ladipage use case |
|-------|------|-------------------|
| `seo-project-setup` | `.agents/skills/seo-project-setup/` | Onboarding project khi publish landing lần đầu |
| `keyword-research` | `.agents/skills/keyword-research/` | Auto keyword cluster cho landing page |
| `keyword-clustering` | `.agents/skills/keyword-clustering/` | Map keyword → page sections |
| `competitor-analysis` | `.agents/skills/competitor-analysis/` | Phân tích 1 đối thủ |
| `competitive-landscape` | `.agents/skills/competitive-landscape/` | Map thị trường |
| `link-prospecting` | `.agents/skills/link-prospecting/` | Authority / outreach |
| `seo-coach` | `.agents/skills/seo-coach/` | Content suite — gợi ý next step |

### 5.3 Server Functions nội bộ — map sang Nest REST (logic reference)

Các function trong `open-seo/src/serverFunctions/` là **contract logic** Nest cần replicate hoặc delegate:

| OpenSEO ServerFn | Input chính | Nest method / endpoint |
|------------------|-------------|------------------------|
| `createProject` | `{ name, domain? }` | `OpenSeoClient.createProject()` → `POST /ai-seo/projects` |
| `getProjects` | — | `listProjects()` |
| `startAudit` | `{ projectId, startUrl, maxPages?, lighthouseStrategy? }` | `runSiteAudit()` → `POST .../scan` |
| `getAuditStatus` | `{ auditId }` | `GET /ai-seo/jobs/:jobId` |
| `getAuditResults` | `{ auditId }` | mapper → `holisticScores`, `siteAudit` |
| `getCrawlProgress` | `{ auditId }` | SSE `/jobs/:id/events` |
| `getAuditLighthouseIssues` | `{ auditId }` | tasks type `LIGHTHOUSE` |
| `researchKeywords` | seeds, location, language | `keywordResearch()` |
| `getSavedKeywords` | `projectId` | `GET .../keywords` |
| `getDomainOverview` | domain | `GET /ai-seo/metrics/overview` |
| `getGscConnection` / `startSelfHostedGscLink` | OAuth | `GET .../integrations/google/gsc/*` |
| `getRankTrackingConfigs` + `triggerRankCheck` | config | phase 2 Keywords suite |
| `getBacklinksOverview` | domain | phase 2 Authority |

### 5.4 Chức năng **ưu tiên Phase 1** — tự động SEO landing page

Theo `checklist-openseo.md` §2 + use case Ladipage:

| Ưu tiên | OpenSEO capability | Ladipage trigger | Nest endpoint |
|---------|-------------------|------------------|---------------|
| **P0** | `createProject` + `seo-project-setup` skill | `PublishModule.publish(pageId)` | auto `ensureForLandingPage()` |
| **P0** | `startAudit` (Lighthouse + on-page crawl) | User click "Quét SEO" / auto sau publish | `POST /projects/:id/scan` |
| **P0** | `getAuditResults` + Lighthouse issues | Poll job → render scores | `GET /jobs/:id`, mapper `holisticScores` |
| **P1** | `research_keywords` + `get_keyword_metrics` | Tab Keywords trên landing detail | `POST /projects/:id/keyword-research` |
| **P1** | `keyword-clustering` skill | Gợi ý H1/meta/section | `POST /projects/:id/keyword-clusters` |
| **P1** | `inspect_urls` | Sau publish — index check | `POST /projects/:id/url-inspect` |
| **P2** | `get_search_console_performance` | Dashboard opportunities (0 credit) | `GET /projects/:id/gsc/performance` |
| **P2** | `get_serp_results` | Validate intent keyword chính | `POST /projects/:id/serp-preview` |
| **P3** | Task approve/reject/deploy | FE task workflow hiện có | `PATCH /seo-tasks/:id/*` |

### 5.5 Chức năng Phase 2 — suite apps kho

| App code kho | OpenSEO sources | Nest prefix |
|--------------|-----------------|-------------|
| `SiteMetrics` | `get_domain_overview`, `get_domain_keywords_page` | `/ai-seo/metrics` |
| `Keywords` | `research_keywords`, rank-tracking serverFns | `/ai-seo/keywords` |
| `Local` | `search_local_businesses`, `get_local_serp_results`, GSC/GBP | `/ai-seo/local` |
| `Content` | `seo-coach` skill + saved keywords | `/ai-seo/content` |
| `Reports` | audit history + GSC export | `/ai-seo/reports` |
| `Authority` | `get_backlinks_*` | `/ai-seo/authority` (feature flag off) |

### 5.6 Lợi ích microservice (từ `checklist-openseo.md` §4)

| Góc nhìn | Lợi ích |
|----------|---------|
| **Technical** | Nest chỉ proxy + mapper; SEO nặng ở OpenSEO Docker, scale độc lập |
| **Business** | FE migrate nhẹ (base URL + `hostname`); chi phí chủ yếu DataForSEO pay-as-you-go |
| **AI** | MCP skills → "AI SEO Coach" / "AI Optimize" trên builder không cần fork OpenSEO |
| **Landing page** | `pageId` → auto project + quick audit + keyword cluster trong 1 flow publish |

---

## 6. OpenSEO Client — adapter methods (mở rộng)

```typescript
@Injectable()
export class OpenSeoClientService {
  // ── Projects ──
  healthCheck(): Promise<{ ok: boolean }>;
  listProjects(): Promise<OpenSeoProject[]>;
  createProject(input: { name: string; domain?: string }): Promise<OpenSeoProject>;
  getProject(projectId: string): Promise<OpenSeoProject>;

  // ── Site Audit (core landing SEO) ──
  startAudit(input: {
    projectId: string;
    startUrl: string;
    maxPages?: number;          // default 50, single landing → 10
    lighthouseStrategy?: 'auto' | 'all' | 'manual' | 'none';
  }): Promise<{ auditId: string }>;
  getAuditStatus(projectId: string, auditId: string): Promise<AuditStatus>;
  getAuditResults(projectId: string, auditId: string): Promise<AuditResults>;
  getAuditLighthouseIssues(projectId: string, auditId: string): Promise<LighthouseIssues>;

  // ── Keywords ──
  researchKeywords(input: KeywordResearchDto): Promise<KeywordResearchResult>;
  getKeywordMetrics(keywords: string[], locationCode?: number): Promise<KeywordMetricsResult>;
  listSavedKeywords(projectId: string): Promise<SavedKeyword[]>;
  saveKeywords(projectId: string, keywords: SaveKeywordInput[]): Promise<void>;

  // ── GSC (0 credit) ──
  getSearchConsolePerformance(input: GscPerformanceDto): Promise<GscPerformanceResult>;
  inspectUrls(projectId: string, urls: string[]): Promise<UrlInspectionResult[]>;
  getGscConnectUrl(projectId: string): Promise<{ url: string }>;

  // ── Competitor / Domain ──
  getDomainOverview(domain: string): Promise<DomainOverview>;
  getRankedKeywords(domain: string): Promise<RankedKeyword[]>;
  getSerpResults(keyword: string): Promise<SerpResult>;
  findSerpCompetitors(keyword: string): Promise<SerpCompetitor[]>;

  // ── Rank / Backlinks (phase 2) ──
  getRankTracker(projectId: string): Promise<RankTrackerSnapshot>;
  getBacklinksOverview(domain: string): Promise<BacklinksOverview>;

  // ── Agent / MCP generic ──
  callMcpTool<T>(toolName: string, input: Record<string, unknown>): Promise<T>;
  executeSkill(skill: OpenSeoSkillName, payload: Record<string, unknown>): Promise<unknown>;
}
```

**Cách tích hợp kỹ thuật (PR-S2):**

1. **MCP SDK client** kết nối `OPENSEO_BASE_URL/mcp` (self-host `local_noauth`)
2. Service account / org mapping: mỗi `tenantId` Liora → 1 `organizationId` OpenSEO (hoặc shared org pilot)
3. `projectId` OpenSEO lưu vào `lp_seo_project.openseo_project_id`
4. Job async: `auditId` OpenSEO ↔ `lp_seo_task.external_task_id` ↔ FE `jobId`

Env: `OPENSEO_BASE_URL`, `OPENSEO_MCP_URL`, `DATAFORSEO_API_KEY` (global hoặc per-tenant encrypted trong `lp_seo_integration`)

**Cache:** `AiSeoCacheService` — Redis `seo:kw:{tenant}:{hash}` TTL 24h; `seo:audit:{auditId}` TTL 1h

**Quota:** `AiSeoQuotaService` — đếm DataForSEO calls (research, domain, backlinks); GSC/URL inspect **không tính quota**

---

## 7. Business logic chắc chẽ (đối chiếu `checklist-openseo.md` §2–4)

### 7.1 Auto-create SEO project khi publish landing

```
PublishModule.publish(pageId)
  → AiSeoProjectService.ensureForLandingPage(pageId)
  → đọc landing_pages (url, title, meta) từ Supabase
  → nếu chưa có lp_seo_project:
       create lp_seo_project (hostname từ publish domain)
       OpenSeoClient.createProject({ name, domain })
       executeSkill('seo-project-setup', { projectId, domain, goals })
  → trả seoProjectId cho FE (optional webhook/event)
```

**Edge case (checklist §4):** Không có `landingPageId` → vẫn tạo project thuần `hostname` (form create thủ công).

### 7.2 Luồng tự động SEO landing page (core use case)

```
Trigger: publish | "Quét SEO" | "AI Optimize" trên builder
  1. ensureForLandingPage(pageId)
  2. runSiteAudit(projectId, depth: 'quick', startUrl: publishedUrl, maxPages: 10)
  3. poll getAuditStatus → getAuditResults + getAuditLighthouseIssues
  4. mapper → holisticScores, siteAudit, tasks (LIGHTHOUSE, ON_PAGE)
  5. keywordResearchForPage(pageId):
       seed = title + H1 + meta description
       executeSkill('keyword-research') → executeSkill('keyword-clustering')
       saveKeywords → lp_seo_keyword_cache
  6. (optional, sau GSC connect) inspectUrls + getSearchConsolePerformance (0 credit)
  7. FE render: scores card + keyword cluster table + suggestion tasks
```

| Bước | OpenSEO call | Nest service method |
|------|--------------|---------------------|
| Setup | `createProject` + `seo-project-setup` | `ensureForLandingPage()` |
| Audit | `startAudit` → `getAuditResults` | `runSiteAudit()`, `pollAuditJob()` |
| Keywords | `research_keywords` + `keyword-clustering` skill | `keywordResearchForPage()` |
| Index check | `inspect_urls` | `inspectPublishedUrl()` |
| GSC | `get_search_console_performance` | `getGscOpportunities()` |

### 7.3 Scan flow (manual)

```
POST /projects/:id/scan
  → quota check (AiSeoQuotaService)
  → OpenSeoClient.startAudit({ projectId, startUrl, maxPages: 10, lighthouseStrategy: 'auto' })
  → lưu lp_seo_task (type AUDIT, external_task_id = auditId)
  → update task_status = 'running'
  → trả { jobId } — FE poll GET /jobs/:jobId
  → on complete: mapper holistic_scores + siteAudit shape FE
```

### 7.4 Task workflow (approve → deploy)

```
PATCH /seo-tasks/:id/approve
  → lp_seo_task.status = approved
  → (meta/H1 suggestion) lưu payload.result

POST /seo-tasks/:id/deploy
  → ghi meta/title vào landing_pages qua PublishModule (single write path)
  → task.status = deployed
  → optional: inspect_urls sau deploy
```

### 7.5 Quota, cache, edge cases

| Tình huống | Hành vi Nest |
|------------|--------------|
| Quota DataForSEO hết | HTTP 429 + `{ upgrade: true }` — FE hiện upgrade UI |
| Research trùng seed 24h | Trả từ `lp_seo_keyword_cache` / Redis |
| OpenSEO down | Circuit breaker → 503 + retry-after |
| GSC chưa connect | Bỏ qua bước 6; `connected_data.gsc = false` |
| `Authority` suite | Feature flag `ai-seo.authority.enabled = false` |

### 7.6 Tenant isolation

Mọi query filter `tenantId` từ `TenantGuard` — **không** tin `orgId` từ FE.

### 7.7 Adapter methods bổ sung (từ checklist §3)

```typescript
// Bổ sung vào OpenSeoClientService — landing-page-first API
keywordResearchForPage(pageId: string, opts?: KeywordResearchDto): Promise<KeywordClusterResult>;
analyzeCompetitor(domain: string): Promise<CompetitorAnalysisResult>;  // skill competitor-analysis
generateBacklinkProspect(domain: string): Promise<LinkProspect[]>;       // skill link-prospecting
executeMcpSkill(skill: OpenSeoSkillName, payload: Record<string, unknown>): Promise<unknown>;
getJobStatus(jobId: string): Promise<JobStatus>;
connectGsc(projectId: string, code: string): Promise<GscConnection>;    // OAuth callback
```

---

## 8. Map FE field → BE DTO (bảng chỉnh sửa)

| FE hiện tại | BE mới | Hành động FE |
|-------------|--------|--------------|
| `GET ?orgId=` | tenant từ JWT | Bỏ query orgId |
| `POST { name }` only | `CreateSeoProjectDto { hostname, name? }` | Form thêm hostname (required) |
| `x-org-id` header | — | Bỏ header |
| `fetch('/api/ai-seo/...')` | `aiSeoApi.*` → `localhost:7002/api` | Đổi base URL |
| `Project` type local | import từ `@liora/api-types` | Sync types |
| `mockDb.ts` | — | Xóa sau migrate |

---

## 9. Suite apps (phase 2 — cùng module)

| Code | Controller prefix | OpenSEO skill |
|------|-------------------|---------------|
| `SiteMetrics` | `/ai-seo/metrics` | domain metrics |
| `Local` | `/ai-seo/local` | GBP/local |
| `Content` | `/ai-seo/content` | content assistant |
| `Keywords` | `/ai-seo/keywords` | keyword DB |
| `Reports` | `/ai-seo/reports` | SEO report builder |
| `Authority` | `/ai-seo/authority` | backlinks (flag off) |

FE placeholder pages (`/site-metrics`, `/local`, …) wire dần — BE expose stub `501` + OpenAPI trước.

**Lưu ý:** `Reports` code kho ≠ `/bao-cao` analytics — registry nên map `Reports` → `/ai-seo/reports` (FE chỉnh route sau).

---

## 10. Lộ trình PR (đối chiếu `AI-SEO.md` + `checklist-openseo.md` §5)

| PR | Phase `AI-SEO.md` | `checklist-openseo` | Nội dung | Effort |
|----|-------------------|---------------------|----------|--------|
| **PR-S0** | Phase 0 | — | Branch `feature/ai-seo-openseo-integration`, data flow diagram | 0.5d |
| **PR-S1** | Phase 1 | Khuyến nghị #1 | Docker OpenSEO port `7003`, `.env.openseo`, `DATAFORSEO_API_KEY` | 1d |
| **PR-S2** | Phase 2 | Khuyến nghị #2 | `libs/openseo-client` + MCP client + `whoami` health | 1.5d |
| **PR-S3** | Phase 3 (partial) | Phase 1 core #1 | Entity `lp_seo_*` + CRUD projects + `ensureForLandingPage` | 2d |
| **PR-S4** | Phase 3 | Phase 1 core #2–4 | Site audit + tasks approve/reject/deploy + job poll | 2d |
| **PR-S5** | Phase 4 (partial) | Integrations | GSC/GBP OAuth connect + callback | 1.5d |
| **PR-S6** | Phase 3–4 | Phase 1 #3 + Phase 2 | `keywordResearchForPage`, clustering, suite stubs | 2d |
| **PR-S7** | Phase 4 | — | FE: `ai-seo.api.ts`, hostname field, migrate 39 BFF routes | 2d (FE) |
| **PR-S8** | Phase 5 (opt.) | Phase AI nâng cao | `executeMcpSkill` expose cho Liora AI chat | 1d |
| **PR-S9** | Phase 6–7 | Test contract §10 | Contract spec, E2E publish→scan, monitoring, feature flag | 1.5d |

**Tổng BE:** ~10–11 ngày (khớp `AI-SEO.md` 9–13 ngày)

### 10.1 Ma trận checklist → deliverable

| `checklist-openseo.md` | Plan section | Deliverable |
|------------------------|--------------|-------------|
| §2 Phase 1 core (4 chức năng) | §5.4, §7.1–7.4 | Auto project, scan, keywords, tasks |
| §2 Phase 2 suite apps | §5.5, §9 | 6 controller prefix + stub 501 |
| §2 Phase AI nâng cao | §5.2, PR-S8 | `executeMcpSkill`, saved keywords refresh |
| §2 Integrations PR-S5 | §4.6, §7.5 | GSC/GBP + per-tenant encrypted key |
| §3 OpenSeoClientService | §6, §7.7 | Method list copy-paste ready |
| §4 Lợi ích / edge cases | §1.1, §7.5 | Cache, quota 429, hostname-only project |
| §5 Khuyến nghị triển khai | §10 | PR-S1 → S3 → contract test |

---

## 11. Contract test & DoD

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:7002/api/ai-seo/projects

curl -X POST -H "Authorization: Bearer $TOKEN" \
  -d '{"hostname":"example.com","name":"Demo SEO"}' \
  http://localhost:7002/api/ai-seo/projects
```

**DoD BE:**
- [ ] `SeoProjectDto` field parity với FE card (≥20 fields)
- [ ] Tenant isolation test pass
- [ ] OpenSEO client mock + integration test
- [ ] `@liora/api-types` export đầy đủ DTO
- [ ] `test/contract/ai-seo-projects.contract.spec.ts`

**DoD FE:**
- [ ] Không còn gọi `src/app/api/ai-seo/*` (trừ static assets)
- [ ] Create form có `hostname`
- [ ] Types từ `@liora/api-types`

---

## 12. Rủi ro

| Rủi ro | Giảm thiểu |
|--------|------------|
| FE phụ thuộc shape mockDb | Mapper giữ backward-compatible fields |
| DataForSEO cost | Quota service + cache |
| Supabase landing vs Nest entity | `landing_page_id` FK — single write path qua Nest |
| 39 route BFF migrate lớn | PR-S7 từng nhóm: projects → tasks → integrations |

---

## 13. Tham chiếu

| File | Vai trò |
|------|---------|
| `AI-SEO.md` | Checklist triển khai Phase 0–8 |
| `checklist-openseo.md` | Phân tích OpenSEO capabilities + Nest adapter mapping |
| `open-seo/src/server/mcp/server.ts` | 18 MCP tools (17 DataForSEO/GSC + `whoami`) |
| `open-seo/src/serverFunctions/` | Logic reference cho audit/keywords/projects |
| `open-seo/.agents/skills/` | 7 agent skills (`seo-project-setup`, …) |
| FE `src/app/api/ai-seo/projects/route.ts` | Contract hiện tại cần parity |
| FE `src/features/ai-seo/api/projects.api.ts` | Client cần migrate |
| `modules/publish/` | Hook auto-create project |
| `modules/app-store/` | `AiSeo` catalog entry |