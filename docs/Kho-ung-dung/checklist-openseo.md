**✅ Phân tích hoàn chỉnh + Danh sách chức năng OpenSEO có thể dùng cho LadiPage AI-SEO qua Nest Adapter (làm microservice)**

Tôi đã phân tích sâu 3 repo bạn cung cấp + file **plan-be-ai-seo-openseo.md** (đính kèm). Dưới đây là báo cáo chi tiết, có cấu trúc, so sánh đa chiều, phù hợp với kế hoạch triển khai bạn đang làm.

### 1. Tổng quan 3 repo & sự khớp nhau (match 95%)

| Yếu tố | OpenSEO (every-app/open-seo) | LadiPage FE (phuongnguyen240805/ladipage-fe-v2 → AI-SEO) | Nest BE (phuongnguyen240805/nest-admin-backend) + Plan |
|--------|------------------------------|-----------------------------------------------------------|-------------------------------------------------------|
| **Mục đích** | Self-host Semrush/Ahrefs lite + MCP AI Agent (DataForSEO backend) | Dashboard AI-SEO gắn với Landing Page (39 route Next BFF hiện mock/Supabase) | Adapter Nest → OpenSEO :7003 (đúng như plan) |
| **Tech** | Docker + Drizzle + Next.js-like + MCP server (port 3001 default, dễ đổi 7003) | React + `/features/ai-seo/` + `/api/ai-seo/*` (projects, tasks, keywords, audits, GSC/GBP) | Nest monorepo + TenantGuard + Supabase + PublishModule → hoàn hảo làm “proxy + quota + mapper” |
| **Trạng thái** | Đang active (v0.0.22), có Docker, MCP, skills | Đang dùng mockDb + Supabase `landing_pages` | Chưa có module `ai-seo/` → đúng lúc triển khai PR-S1~S8 theo plan |
| **Điểm khớp** | Toàn bộ features FE cần đều có + còn dư (MCP siêu mạnh cho AI) | Gần như 100% map với plan (projects, scan, tasks, integrations) | Plan đã thiết kế đúng: Nest quản tenant/quota/cache, delegate heavy logic sang OpenSEO |

**Kết luận**: OpenSEO là lựa chọn **hoàn hảo** làm microservice cho AI-SEO LadiPage. Nest chỉ cần wrapper + mapper → FE gần như không thay đổi UI.

### 2. Các chức năng của OpenSEO mà LadiPage AI-SEO **nên dùng** (ưu tiên theo Plan + Phase)

Tôi phân loại theo **PR-Sx** trong plan của bạn, kèm **cách call qua Nest**, **gợi ý method trong `OpenSeoClientService`**, và **lợi ích/edge case**.

#### **Phase 1 – Core (PR-S3, S4, S6) – Phải làm ngay (match 100% với FE hiện tại)**

| STT | Chức năng OpenSEO | Cách OpenSEO expose | Gợi ý method Nest Client | FE dùng cho gì? | Ghi chú / Nuance |
|-----|-------------------|---------------------|--------------------------|-----------------|------------------|
| 1 | **SEO Project Setup** | MCP skill `seo-project-setup` + internal project DB | `createProject(hostname, landingPageId?)` → `ensureForLandingPage(pageId)` | Create project khi publish landing | Auto-create theo section 6.1 plan |
| 2 | **Site Audit / Scan** | Lighthouse + DataForSEO On-Page + full/quick mode | `runSiteAudit(projectId, depth: 'quick'\|'full')` | `/projects/:id/scan`, `/landing-pages/:pageId/scan` | Trả `holisticScores`, `siteAudit`, `taskStatus` → mapper giữ shape FE |
| 3 | **Keyword Research** | Full DataForSEO Keywords API + clustering | `keywordResearch(seed, location?, lang?, count?)` + `keywordClustering` | `/keywords`, research flow | Cache Redis + quota (section 5 plan) |
| 4 | **Task Management** | Internal task + MCP | `getTasks(projectId)`, `approve/reject/deploy` | `/seo-tasks/:id/approve`, `/deploy` | Map với `lp_seo_task` table |

#### **Phase 2 – Suite Apps (PR-S6 + phase 2 module)**

| Chức năng OpenSEO | Skills MCP tương ứng | Controller Nest gợi ý | LadiPage suite map |
|-------------------|----------------------|-----------------------|--------------------|
| Competitor Analysis | `competitor-analysis`, `competitive-landscape` | `/ai-seo/competitors` | SiteMetrics + Local |
| Backlinks & Link Building | `link-prospecting` + Backlinks API | `/ai-seo/authority` | Authority (flag off) |
| Rank Tracking | Built-in (MVP + language select) | `/ai-seo/keywords/rank` | Keywords suite |
| Content Assistant | `seo-coach` | `/ai-seo/content` | Content suite |
| Local / GBP | GSC/GBP integration (có sẵn) | `/ai-seo/local` | Local suite |
| Reports | DataForSEO + custom | `/ai-seo/reports` | Reports (khác với analytics) |

#### **Phase AI nâng cao (rất mạnh – nên tận dụng)**

- **MCP Generic**: `callMcpSkill(skill: string, payload: any)` → siêu linh hoạt (có thể mở rộng sau mà không thay OpenSEO).
- Skills đầy đủ: `seo-project-setup`, `seo-coach`, `keyword-research`, `keyword-clustering`, `competitive-landscape`, `competitor-analysis`, `link-prospecting`.
- AI Visibility score, Saved Keywords + refresh metrics.

#### **Integrations (PR-S5)**

- **GSC**: OpenSEO hỗ trợ self-hosted OAuth → Nest có thể forward hoặc sync data.
- **GBP**: Tương tự (Local suite).
- **DataForSEO**: Nest lưu encrypted per-tenant trong `lp_seo_integration` (như plan).

### 3. Gợi ý OpenSeoClientService (Nest) – copy-paste được

```ts
@Injectable()
export class OpenSeoClientService {
  async createProject(dto: CreateSeoProjectDto): Promise<any>;
  async runSiteAudit(projectId: string, depth?: 'quick'|'full'): Promise<SiteAuditResult>;
  async keywordResearch(dto: KeywordResearchDto);
  async analyzeCompetitor(domain: string);
  async executeMcpSkill(skill: string, payload: any); // linh hoạt nhất
  async getJobStatus(jobId: string);
  async connectGsc(projectId: string, code: string); // callback
  // + getBacklinks, getRankTracking, etc.
}
```

**Env cần**: `OPENSEO_BASE_URL=http://openseo:7003`, `DATAFORSEO_API_KEY` (per tenant).

### 4. Lợi ích khi dùng OpenSEO như microservice (nhiều góc nhìn)

- **Technical**: Nest nhẹ, không nhét logic SEO nặng (đúng nguyên tắc 1.1 plan). Cache + Quota + Tenant isolation dễ làm.
- **Business**: FE migrate nhanh (chỉ đổi base URL + thêm hostname field), user có full power Semrush-like mà chi phí chỉ DataForSEO pay-as-you-go.
- **AI**: MCP skills cho phép sau này build “AI SEO Coach” cực mạnh trong LadiPage.
- **Scalability**: Docker OpenSEO riêng, dễ scale, update độc lập.
- **Edge cases được cover**: 
  - Không có landingPageId → vẫn create project thuần hostname.
  - Quota hết → Nest trả 429 + upgrade UI.
  - DataForSEO cost cao → cache `lp_seo_keyword_cache` + TTL Redis.

### 5. Khuyến nghị triển khai ngay (theo lộ trình plan)

1. **PR-S1**: Docker OpenSEO + env `OPENSEO_PORT=7003` + docker-compose stack.
2. **PR-S2**: Tạo `libs/openseo-client` + health check `/health`.
3. **PR-S3**: Entity + CRUD projects + mapper (ưu tiên giữ ≥20 fields `SeoProjectDto`).
4. **Test contract**: Dùng 2 curl bạn đưa trong section 10.

