✅ **CHECKLIST TRIỂN KHAI TÍCH HỢP OPEN-SEO → AI-SEO MODULE**  
**(Microservice + Adapter approach – đúng như yêu cầu của bạn: “kết nối vs BE như 1 microservice để gọi 1 số tính năng, tránh nặng BE”)**

OpenSEO sẽ chạy như **microservice riêng** (port 7003 hoặc app Nx riêng), NestJS sẽ chỉ có **client/adapter** gọi API/MCP của nó. FE gọi API Nest sạch sẽ (`/api/ai-seo/...`).

**Tổng thời gian ước tính**: **9–13 ngày** (dễ hơn GADS, tương đương Flowise vì cùng TypeScript stack).

### **Phase 0: Chuẩn bị (0.5–1 ngày)**
- [ ] Đọc docs OpenSEO (Docker, .env, MCP skills, DataForSEO key, Cloudflare option)
- [ ] Xác định scope: Keyword research, rank tracking, competitor, backlink, site audit, MCP cho AI agent trong Liora + Auto SEO cho Landing Page (page ID → keyword cluster + suggestion)
- [ ] Tạo branch `feature/ai-seo-openseo-integration`
- [ ] Quyết định: Chạy OpenSEO Docker hay fork source? (Khuyến nghị Docker + client)
- **Deliverables**: Requirements + data flow diagram (Landing Page ↔ OpenSEO)
- **Responsible**: Tech Lead

### **Phase 1: Infrastructure & Docker (1 ngày)**
- [ ] Thêm OpenSEO vào `docker-compose.yml` (copy từ repo OpenSEO + map port 3001 → 7003)
- [ ] Tạo `.env.openseo` (DATAFORSEO_API_KEY + Liora proxy URL)
- [ ] Setup subdomain `seo.yourdomain.com` hoặc internal network
- [ ] Config DataForSEO key management: per workspace (lưu encrypted trong Supabase) hoặc global + billing pass-through
- [ ] Test `docker compose up -d openseo` + truy cập UI
- **Deliverables**: OpenSEO chạy độc lập, API/MCP accessible từ Liora
- **Responsible**: DevOps

### **Phase 2: Tạo NestJS Client & Adapter (2 ngày)**
- [ ] Tạo lib `@liora/ai-seo` trong Nx monorepo
- [ ] Tạo `AiSeoModule`, `AiSeoService`, `OpenSeoClient` (HttpService + Axios)
- [ ] Implement Adapter: `keywordResearchForPage(pageId)`, `analyzeCompetitor`, `generateBacklinkProspect`, `runSiteAudit`, `callMcpSkill`
- [ ] Thêm caching (Redis) cho kết quả SEO (tránh gọi DataForSEO lặp)
- **Deliverables**: Client test thành công qua Postman (keyword research + MCP call)
- **Responsible**: Backend

### **Phase 3: Business Logic trong Nest (2–3 ngày)**
- [ ] AiSeoService: 
  - Permission + workspace check
  - Map Landing Page entity → SEO project (tự động create project khi publish page)
  - Save result vào Supabase (keywords, suggestions, history)
  - Billing/Quota (tính DataForSEO cost + charge user)
  - Trigger AI agent (gửi MCP request từ Claude/Hermes trong Liora)
- [ ] Tạo DTO + Validation (Zod)
- [ ] Webhook/OpenSEO event handling (nếu có)
- **Deliverables**: Logic hoàn chỉnh, ví dụ: “Optimize SEO” button trên Builder → trả suggestion ngay
- **Responsible**: Backend + Product

### **Phase 4: API & FE Integration (1.5–2 ngày)**
- [ ] Tạo Controller `/api/ai-seo/*` (10–12 endpoint chính)
- [ ] FE: Tab `/ai-seo` trong App Store + Button “AI Optimize” trên Landing Page detail
- [ ] TanStack Query hooks + UI components (KeywordClusterTable, SuggestionCard, MCP Test Console)
- [ ] Hiển thị cost estimate (“100 keywords ≈ $1.2”)
- **Deliverables**: FE gọi API Nest → thấy kết quả SEO cho trang cụ thể
- **Responsible**: Frontend + Backend

### **Phase 5: MCP & AI Agent Integration (1 ngày – optional nhưng rất mạnh)**
- [ ] Expose MCP endpoint từ Liora để Claude/Code agent trong Liora gọi trực tiếp OpenSEO skills
- [ ] Test: “Phân tích competitor của page X” → AI agent gọi MCP → trả kết quả
- **Deliverables**: MCP hoạt động với Liora AI chat
- **Responsible**: Backend (AI team)

### **Phase 6: Testing & Security (1–1.5 ngày)**
- [ ] Unit/Integration test (client + service)
- [ ] E2E: Publish landing page → click AI-SEO → thấy keyword + suggestion
- [ ] Security: Encrypt API key, rate limit, quota per user, data privacy
- [ ] Load test (100 keyword research đồng thời)
- **Deliverables**: Test pass, security audit OK
- **Responsible**: QA

### **Phase 7: Deployment & Monitoring (1 ngày)**
- [ ] Update pipeline + Docker stack
- [ ] Monitoring: Prometheus (API calls), Sentry, Grafana (DataForSEO usage)
- [ ] Feature flag “ai-seo.enabled”
- [ ] Documentation + pricing note (“Chỉ tính phí DataForSEO”)
- **Deliverables**: Staging live
- **Responsible**: DevOps

### **Phase 8: Go-live & Optimize**
- [ ] Soft launch
- [ ] Feedback loop (user có thể request skill MCP mới)
- [ ] Optimize: Cache tier, bulk request, export report

---

**Tóm tắt effort**

| Phase | Thời gian     | Responsible     | Độ khó |
|-------|---------------|-----------------|--------|
| 0–1   | 1.5 ngày      | DevOps          | Thấp   |
| 2–3   | 4–5 ngày      | Backend         | Trung bình |
| 4–5   | 3 ngày        | FE + Backend    | Thấp   |
| 6–7   | 2.5 ngày      | QA + DevOps     | Thấp   |
| **Tổng** | **9–13 ngày** | —               | —      |

