# Prompt — Xây dựng BE AI-SEO kết nối OpenSEO Microservice

> **Cách dùng:** Copy toàn bộ nội dung trong khối `PROMPT` bên dưới vào AI agent (Cursor / Claude / Copilot) khi implement backend.  
> **Tài liệu bắt buộc đọc trước:** `plan-be-ai-seo-openseo.md`, `checklist-openseo.md`, `AI-SEO.md`

---

## PROMPT (copy từ đây)

```
Bạn là Senior NestJS Backend Engineer. Nhiệm vụ: xây dựng module `ai-seo` trong `ladipage-backend` — một **adapter mỏng** gọi microservice OpenSEO, KHÔNG implement logic SEO nặng trong Nest.

═══════════════════════════════════════════════════════════════
1. BỐI CẢNH HỆ THỐNG
═══════════════════════════════════════════════════════════════

**Monorepo:** `liora-monorepo/`
- BE app: `apps/ladipage-backend/` (NestJS + Fastify + TypeORM)
- Shared: `@liora/nest-core` (TenantGuard, JwtAuthGuard, TransformInterceptor…)
- DB: Postgres qua `@liora/database`
- Landing pages: Supabase `landing_pages` + `PublishModule` (`modules/publish/`)

**Microservice:** `open-seo/` (repo sibling, v0.0.22)
- Docker port mặc định `3001` → map `7003` trong stack Liora
- Self-host: `AUTH_MODE=local_noauth`, cần `DATAFORSEO_API_KEY`
- **Không có REST public** cho audit/keywords — gọi qua **MCP** tại `{OPENSEO_BASE_URL}/mcp`
- Server Functions (`open-seo/src/serverFunctions/`) chỉ là logic reference, Nest KHÔNG import trực tiếp

**Frontend (contract cần parity):** `ladipage-fe-v2/`
- Hiện tại: 39 route Next BFF `src/app/api/ai-seo/*` — map `landing_pages` → `SeoProjectDto`
- Sau migrate: gọi `http://localhost:7002/api/ai-seo/*` (Nest)
- FE client: `src/features/ai-seo/api/*.api.ts`
- FE hiện gửi `orgId` / `x-org-id` — **BE bỏ qua**, dùng `TenantGuard`

**App kho:** code `AiSeo` (FE id `17`), suite phase 2: SiteMetrics, Local, Content, Keywords, Reports, Authority

**Trạng thái hiện tại:**
- `modules/ai-seo/` → CHƯA CÓ (cần tạo mới)
- `modules/app-store/` → catalog `AiSeo` đã seed
- Docker OpenSEO → CHƯA CÓ trong compose Liora

═══════════════════════════════════════════════════════════════
2. NGUYÊN TẮC KIẾN TRÚC (BẮT BUỘC)
═══════════════════════════════════════════════════════════════

```
FE → ladipage-backend /api/ai-seo/* → OpenSeoClientService → OpenSEO :7003 (MCP)
                    ↓
              Postgres (lp_seo_project, lp_seo_task, lp_seo_keyword_cache, lp_seo_integration)
                    ↓
              PublishModule (landing page context, auto-create on publish)
```

| Quy tắc | Chi tiết |
|---------|----------|
| BE nhẹ | Keyword research, site audit, SERP, backlinks → **delegate OpenSEO MCP** |
| Nest quản | tenant isolation, quota DataForSEO, Redis cache, mapper DTO, job polling |
| Không duplicate | Đọc landing qua `PublishModule` / Supabase — không copy logic FE BFF |
| DTO là contract | BE DTO là source of truth; FE sẽ chỉnh form cho khớp |
| Response shape | Giữ field FE đang dùng: `taskStatus`, `holisticScores`, `siteAudit`, `uuid` alias `id` |
| Tenant | Mọi query filter `tenantId` từ `TenantGuard` — KHÔNG tin `orgId` từ FE |

**Pattern code hiện có — bám theo:**
- Controller: `@UseGuards(TenantGuard)` như `modules/app-store/applications.controller.ts`
- Module: TypeORM entities + services như `modules/automation/automation.module.ts`
- Import module vào `apps/ladipage-backend/src/app/app.module.ts` **sau** `PublishModule`
- DTO: class-validator decorators, export sang `@liora/api-types` nếu repo có lib đó

═══════════════════════════════════════════════════════════════
3. CẤU TRÚC FILE CẦN TẠO
═══════════════════════════════════════════════════════════════

```
apps/ladipage-backend/src/modules/ai-seo/
  ai-seo.module.ts
  controllers/
    ai-seo-projects.controller.ts      # CRUD + scan
    ai-seo-tasks.controller.ts         # approve/reject/deploy
    ai-seo-integrations.controller.ts  # GSC/GBP OAuth
    ai-seo-jobs.controller.ts          # poll async audit
    ai-seo-keywords.controller.ts      # phase 2 stub → 501
  dto/
    create-seo-project.dto.ts
    update-seo-project.dto.ts
    list-seo-projects-query.dto.ts
    scan-project.dto.ts
    keyword-research.dto.ts
    seo-task-action.dto.ts
  entities/
    seo-project.entity.ts              # table lp_seo_project
    seo-task.entity.ts                 # table lp_seo_task
    seo-keyword-cache.entity.ts
    seo-integration.entity.ts
    index.ts
  services/
    ai-seo-project.service.ts
    ai-seo-task.service.ts
    ai-seo-integration.service.ts
    openseo-client.service.ts          # MCP wrapper — CORE
    ai-seo-cache.service.ts            # Redis TTL
    ai-seo-quota.service.ts            # DataForSEO quota → 429
  mappers/
    seo-project.mapper.ts              # entity → SeoProjectDto (≥20 fields)

apps/ladipage-backend/libs/openseo-client/                   # PR-S2 — tách lib nếu có thể
  src/
    openseo-mcp.client.ts
    types/
      audit.types.ts
      keyword.types.ts
      project.types.ts
```

═══════════════════════════════════════════════════════════════
4. DATABASE (TypeORM migrations)
═══════════════════════════════════════════════════════════════

**lp_seo_project:** id (uuid), tenant_id (int), store_id, landing_page_id (uuid nullable),
name, hostname, slug, status (draft|active|archived), openseo_project_id (varchar nullable),
task_status, pixel_tag_state, is_favorite, holistic_scores (jsonb), connected_data (jsonb),
last_analysis_at, created_at, updated_at

**lp_seo_task:** id, seo_project_id (FK), external_task_id (auditId OpenSEO), type (AUDIT|KEYWORD|DEPLOY),
status (pending|approved|rejected|deployed), payload (jsonb), result (jsonb)

**lp_seo_keyword_cache:** tenant_id, seed_hash, response (jsonb), expires_at

**lp_seo_integration:** tenant_id, provider (dataforseo|gsc|gbp), encrypted_credentials (jsonb)

Index: `(tenant_id, landing_page_id)`, `(tenant_id, hostname)`

═══════════════════════════════════════════════════════════════
5. API REST — PHASE 1 (parity FE BFF)
═══════════════════════════════════════════════════════════════

Base prefix controller: `@Controller('ai-seo')` → full path `/api/ai-seo/*`

### Projects
- GET    /ai-seo/projects              → ListSeoProjectsQueryDto → SeoProjectDto[]
- POST   /ai-seo/projects              → CreateSeoProjectDto → SeoProjectDto
- GET    /ai-seo/projects/:id
- PATCH  /ai-seo/projects/:id
- DELETE /ai-seo/projects/:id
- POST   /ai-seo/projects/:id/favorite → { favorite: boolean }
- POST   /ai-seo/projects/:id/scan     → ScanProjectDto { depth?: 'quick'|'full' } → { jobId }
- GET    /ai-seo/projects/:id/agent-status

### Landing pages (sub-resource)
- GET  /ai-seo/projects/:id/landing-pages
- GET  /ai-seo/projects/:id/landing-pages/:pageId
- POST /ai-seo/projects/:id/landing-pages/:pageId/scan
- GET  /ai-seo/projects/:id/landing-pages/:pageId/scores
- GET  /ai-seo/projects/:id/landing-pages/:pageId/tasks

### SEO setup flow
- POST /ai-seo/seo-projects
- GET  /ai-seo/seo-projects/:id
- POST /ai-seo/seo-projects/:id/setup
- POST /ai-seo/seo-projects/:id/start-audit
- GET  /ai-seo/seo-projects/:id/installation
- GET  /ai-seo/seo-projects/:id/installation/check
- GET  /ai-seo/seo-projects/:id/tasks
- PATCH /ai-seo/seo-tasks/:id/approve
- PATCH /ai-seo/seo-tasks/:id/reject
- POST  /ai-seo/seo-tasks/:id/deploy

### Integrations
- GET /ai-seo/integrations/google/gsc/connect-url?projectId=
- GET /ai-seo/integrations/google/gbp/connect-url?projectId=
- GET /ai-seo/integrations/google/gsc/callback
- GET /ai-seo/integrations/google/gbp/callback

### Jobs (async)
- GET /ai-seo/jobs/:jobId
- GET /ai-seo/jobs/:jobId/events  (SSE optional, dùng SseModule nếu có)

### CreateSeoProjectDto (FE sẽ chỉnh form cho khớp)
```typescript
class CreateSeoProjectDto {
  @IsString() @MinLength(1) hostname: string;   // REQUIRED — FE hiện chỉ gửi name, cần thêm
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsUUID() landingPageId?: string;
}
```

### SeoProjectDto — mapper PHẢI trả đủ field FE card dùng:
id, uuid (=id), projectId (=id), hostname, name, slug, status, taskStatus, pixelTagState,
isFavorite, isEngaged, isFrozen, holisticScores, connectedData, afterSummary,
aiGradeOverall, siteAudit, readyForProcessing, isFirstProcessing, timeSavedTotal,
createdAt, updatedAt, publishedAt

Tham chiếu mapping hiện tại: `ladipage-fe-v2/src/app/api/ai-seo/projects/route.ts` (lines 66-100)

═══════════════════════════════════════════════════════════════
6. OPENSEO CLIENT — CÁCH GỌI MICROSERVICE
═══════════════════════════════════════════════════════════════

**Ưu tiên MCP** (`@modelcontextprotocol/sdk` Client) kết nối `{OPENSEO_MCP_URL}/mcp`.

18 MCP tools (đăng ký tại `open-seo/src/server/mcp/server.ts`):

| Tool | Nest dùng khi |
|------|---------------|
| whoami | Health check PR-S2 |
| list_projects | Sync openseo_project_id |
| research_keywords | keywordResearchForPage() |
| get_keyword_metrics | Chấm điểm keyword |
| save_keywords / list_saved_keywords | Lưu cluster sau approve |
| startAudit* | POST .../scan — map qua serverFn logic |
| get_search_console_performance | GSC opportunities (0 credit, không quota) |
| inspect_urls | Index check sau publish (0 credit) |
| get_domain_overview, get_ranked_keywords, get_serp_results | Phase 2 suite |

*Audit: OpenSEO dùng serverFn `startAudit({ projectId, startUrl, maxPages, lighthouseStrategy })`.
Nest gọi tương đương qua MCP hoặc HTTP bridge nếu PR-S2b thêm — ưu tiên MCP tool mapping.

**OpenSeoClientService interface:**

```typescript
@Injectable()
export class OpenSeoClientService {
  healthCheck(): Promise<{ ok: boolean }>;
  listProjects(): Promise<OpenSeoProject[]>;
  createProject(input: { name: string; domain?: string }): Promise<OpenSeoProject>;
  startAudit(input: { projectId: string; startUrl: string; maxPages?: number; lighthouseStrategy?: string }): Promise<{ auditId: string }>;
  getAuditStatus(auditId: string): Promise<AuditStatus>;
  getAuditResults(projectId: string, auditId: string): Promise<AuditResults>;
  getAuditLighthouseIssues(projectId: string, auditId: string): Promise<LighthouseIssues>;
  researchKeywords(input: KeywordResearchDto): Promise<KeywordResearchResult>;
  getKeywordMetrics(keywords: string[]): Promise<KeywordMetricsResult>;
  keywordResearchForPage(pageId: string, opts?: KeywordResearchDto): Promise<KeywordClusterResult>;
  getSearchConsolePerformance(input: GscPerformanceDto): Promise<GscPerformanceResult>;
  inspectUrls(projectId: string, urls: string[]): Promise<UrlInspectionResult[]>;
  callMcpTool<T>(toolName: string, input: Record<string, unknown>): Promise<T>;
  executeSkill(skill: 'seo-project-setup'|'keyword-research'|'keyword-clustering'|..., payload: object): Promise<unknown>;
}
```

**Env:**
```
OPENSEO_BASE_URL=http://openseo:7003
OPENSEO_MCP_URL=http://openseo:7003/mcp
DATAFORSEO_API_KEY=...          # global pilot; sau: per-tenant trong lp_seo_integration
```

**Cache (AiSeoCacheService):** Redis `seo:kw:{tenant}:{hash}` TTL 24h; `seo:audit:{auditId}` TTL 1h

**Quota (AiSeoQuotaService):** Đếm calls tốn DataForSEO credit; GSC + inspect_urls KHÔNG tính.
Hết quota → `HttpException 429` body `{ upgrade: true, message: '...' }`

**Circuit breaker:** OpenSEO down → 503 + `Retry-After`

═══════════════════════════════════════════════════════════════
7. BUSINESS LOGIC — LUỒNG LANDING PAGE AUTO SEO
═══════════════════════════════════════════════════════════════

### 7.1 Auto-create khi publish
```
PublishModule.publish(pageId)  [hook/event — inject AiSeoProjectService]
  → ensureForLandingPage(pageId)
  → đọc landing (url, title, meta) từ Supabase/PublishModule
  → nếu chưa có lp_seo_project:
       create record (hostname từ publish domain)
       openseoClient.createProject({ name, domain })
       openseoClient.executeSkill('seo-project-setup', { projectId, domain })
```

Edge case: không có landingPageId → vẫn tạo project thuần hostname (form manual).

### 7.2 Scan flow
```
POST /projects/:id/scan
  → validate tenant owns project
  → quotaService.assertAvailable(tenantId)
  → openseoClient.startAudit({ projectId: openseo_project_id, startUrl, maxPages: 10, lighthouseStrategy: 'auto' })
  → save lp_seo_task { type: AUDIT, external_task_id: auditId, status: pending }
  → return { jobId: auditId }

GET /jobs/:jobId
  → poll getAuditStatus + getAuditResults
  → mapper update holistic_scores, siteAudit trên lp_seo_project
  → generate tasks từ Lighthouse issues
```

### 7.3 Keyword flow
```
keywordResearchForPage(pageId):
  seed = landing.title + H1 + metaDescription
  → cache check
  → callMcpTool('research_keywords', { seeds, location, language })
  → executeSkill('keyword-clustering', ...)
  → saveKeywords + lp_seo_keyword_cache
```

### 7.4 Task deploy
```
POST /seo-tasks/:id/deploy
  → đọc task.payload (meta/title suggestions)
  → ghi vào landing_pages qua PublishModule/PageService (single write path)
  → task.status = deployed
  → optional inspect_urls
```

═══════════════════════════════════════════════════════════════
8. LỘ TRÌNH IMPLEMENT (theo thứ tự — không nhảy bước)
═══════════════════════════════════════════════════════════════

**PR-S1 — Infra (làm trước nếu chưa có)**
- Thêm service `openseo` vào `docker-compose` Liora, port 7003
- `.env.openseo`: AUTH_MODE=local_noauth, DATAFORSEO_API_KEY
- Verify: curl health + MCP whoami

**PR-S2 — OpenSEO Client lib**
- `libs/openseo-client` + `OpenSeoMcpClient`
- `OpenSeoClientService` inject vào module
- Unit test mock MCP response
- Health endpoint nội bộ hoặc dùng `@liora/nest-core` HealthModule pattern

**PR-S3 — Entities + Projects CRUD**
- Migration 4 tables
- `AiSeoProjectsController` + `AiSeoProjectService`
- `seo-project.mapper.ts` parity FE card
- `ensureForLandingPage()` skeleton (hook PublishModule sau)
- Contract test: GET/POST /ai-seo/projects

**PR-S4 — Audit + Tasks + Jobs**
- Scan endpoint + job polling
- Tasks approve/reject/deploy
- Mapper holisticScores từ audit results

**PR-S5 — Integrations GSC/GBP**
- OAuth connect-url + callback
- Lưu token encrypted lp_seo_integration

**PR-S6 — Keywords**
- keywordResearchForPage + clustering
- POST endpoint cho landing page keywords

**PR-S8 (optional) — MCP skill expose** cho AgentModule Liora

═══════════════════════════════════════════════════════════════
9. KHÔNG ĐƯỢC LÀM
═══════════════════════════════════════════════════════════════

- ❌ Implement DataForSEO API trực tiếp trong Nest (phải qua OpenSEO)
- ❌ Import code từ `open-seo/src/serverFunctions/` vào ladipage-backend
- ❌ Tin `orgId` / `x-org-id` từ FE làm tenant scope
- ❌ Thay đổi shape `SeoProjectDto` breaking FE card (chỉ thêm field, không xóa)
- ❌ Duplicate CRUD landing_pages — đọc qua PublishModule
- ❌ Gọi OpenSEO sync blocking trên request thread cho audit full — luôn trả jobId + poll
- ❌ Scope creep phase 2 suite (Authority, backlinks) trước khi phase 1 pass contract test

═══════════════════════════════════════════════════════════════
10. ĐỊNH NGHĨA HOÀN THÀNH (DoD)
═══════════════════════════════════════════════════════════════

```bash
# Health
curl -H "Authorization: Bearer $TOKEN" http://localhost:7002/api/ai-seo/health

# List projects (tenant từ JWT, không cần orgId)
curl -H "Authorization: Bearer $TOKEN" http://localhost:7002/api/ai-seo/projects

# Create project
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"hostname":"example.com","name":"Demo SEO"}' \
  http://localhost:7002/api/ai-seo/projects

# Scan → job poll
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:7002/api/ai-seo/projects/{id}/scan \
  -d '{"depth":"quick"}'
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:7002/api/ai-seo/jobs/{jobId}
```

Checklist:
- [ ] `SeoProjectDto` ≥20 fields, FE card render không đổi UI
- [ ] Tenant isolation test: user A không đọc project user B
- [ ] OpenSeoClient mock test + integration test (Docker OpenSEO)
- [ ] Quota 429 khi vượt limit
- [ ] Cache hit cho keyword research trùng seed
- [ ] `test/contract/ai-seo-projects.contract.spec.ts` pass
- [ ] Module registered trong `app.module.ts`
- [ ] Export DTO sang `@liora/api-types` nếu monorepo có lib

═══════════════════════════════════════════════════════════════
11. TÀI LIỆU THAM CHIẾU (đọc trước khi code)
═══════════════════════════════════════════════════════════════

| Path | Mục đích |
|------|----------|
| `liora-monorepo/docs/Kho-ung-dung/plan-be-ai-seo-openseo.md` | Plan đầy đủ §1–13 |
| `liora-monorepo/docs/Kho-ung-dung/checklist-openseo.md` | MCP inventory + phase mapping |
| `liora-monorepo/docs/Kho-ung-dung/AI-SEO.md` | Phase 0–8 checklist |
| `open-seo/src/server/mcp/server.ts` | 18 MCP tools |
| `open-seo/.agents/skills/` | 7 agent skills |
| `ladipage-fe-v2/src/app/api/ai-seo/projects/route.ts` | FE contract hiện tại |
| `ladipage-fe-v2/src/features/ai-seo/api/projects.api.ts` | FE client cần migrate |
| `ladipage-fe-v2/plans/BE-INTEGRATION.md` | Nguyên tắc BE là contract chuẩn |
| `apps/ladipage-backend/src/modules/app-store/applications.controller.ts` | TenantGuard pattern |
| `apps/ladipage-backend/src/modules/publish/publish.module.ts` | Hook publish |

═══════════════════════════════════════════════════════════════
12. YÊU CẦU ĐẦU RA KHI BẮT ĐẦU CODE
═══════════════════════════════════════════════════════════════

Khi nhận task implement, hãy:

1. Đọc các file tham chiếu ở §11 (ít nhất plan + FE BFF route + MCP server.ts)
2. Xác nhận PR đang làm (S1–S6) — chỉ implement scope PR đó
3. Liệt kê file sẽ tạo/sửa trước khi viết code
4. Viết migration → entities → services → controllers → tests theo thứ tự
5. Mỗi endpoint mới: DTO + validation + TenantGuard + mapper test
6. Commit message format: `feat(ai-seo): PR-S3 — add seo project CRUD`
7. Sau mỗi PR: chạy contract curl ở §10 và báo kết quả

Bắt đầu với PR được chỉ định. Nếu chưa có Docker OpenSEO, làm PR-S1 trước.
```

---

## Biến thể prompt ngắn (quick start)

Dùng khi đã có context, chỉ cần kick-off 1 PR:

```
Implement PR-S{N} cho module ai-seo trong ladipage-backend theo
docs/Kho-ung-dung/plan-be-ai-seo-openseo.md và prompt-be-ai-seo-openseo.md.

Quy tắc: Nest = adapter mỏng, SEO logic delegate OpenSEO MCP (:7003).
TenantGuard trên mọi route. SeoProjectDto parity FE BFF.
Đọc ladipage-fe-v2/src/app/api/ai-seo/projects/route.ts trước khi viết mapper.

PR-S3 = entities + CRUD projects + mapper
PR-S4 = scan + jobs + tasks
PR-S2 = openseo-client MCP wrapper

Liệt kê file sẽ tạo, implement, chạy contract test §10, báo DoD checklist.
```

---

## Gợi ý gắn vào Cursor Rules / AGENTS.md

Thêm 1 dòng vào rules của `ladipage-backend`:

```
Khi implement AI-SEO: đọc docs/Kho-ung-dung/prompt-be-ai-seo-openseo.md —
OpenSEO là microservice qua MCP, không implement DataForSEO trực tiếp trong Nest.
```