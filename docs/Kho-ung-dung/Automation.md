✅ **CHECKLIST TRIỂN KHAI TÍCH HỢP FLOWISE → AUTOMATION MODULE**  
**(Phiên bản chi tiết, tập trung WebView + Business Logic Sync)**

Flowise sẽ được tích hợp dưới dạng **module “Automation”** với cách nhúng FE gốc (WebView/iframe) để tái sử dụng 100% UI drag-and-drop, đồng thời thêm **business logic ở BE NestJS** để sync flow với Liora (Campaign, FunnelX, Landing Page trigger, workspace permission, billing…).

**Tổng thời gian ước tính**: **8–12 ngày** (nhẹ hơn GADS vì Flowise embed-friendly).

### **Phase 0: Chuẩn bị (0.5–1 ngày)**
- [ ] Đọc docs Flowise chính thức (self-host, embed, env variables, webhook, SSO)
- [ ] Xác định scope: Nhúng WebView + SSO + Sync flow ID ↔ Liora Campaign + Trigger từ landing page convert + Billing per active flow
- [ ] Tạo branch `feature/automation-flowise-integration`
- [ ] Liệt kê API cần expose cho FE (`/api/automation/create-flow`, `/api/automation/trigger`, `/api/automation/sync`)
- **Deliverables**: Requirements doc + diagram (Flowise ↔ Liora data flow)
- **Responsible**: Tech Lead / Product

### **Phase 1: Infrastructure Flowise (1 ngày)**
- [ ] Thêm Flowise vào `docker-compose.yml` (sử dụng image chính thức hoặc build từ source)
- [ ] Config `.env` Flowise (DATABASE, ENCRYPTION_KEY, NEXT_PUBLIC_API_URL trỏ về Liora proxy)
- [ ] Setup subdomain `automation.yourdomain.com` → proxy đến Flowise port 3000
- [ ] Bật CORS, disable auth mặc định của Flowise (sẽ dùng SSO từ Liora)
- [ ] Test chạy Flowise standalone (`pnpm docker:up:flowise`)
- **Deliverables**: Flowise UI accessible qua subdomain, database kết nối Supabase/Postgres
- **Responsible**: DevOps

### **Phase 2: Tạo NestJS Module & SSO (1.5–2 ngày)**
- [ ] Tạo lib `@liora/automation` trong Nx monorepo
- [ ] Tạo `AutomationModule`, `AutomationService`, `AutomationController`
- [ ] Implement SSO flow: 
  - FE gọi `/api/auth/exchange-flowise` → Nest tạo JWT tạm + redirect/postMessage vào iframe
- [ ] Tạo `FlowiseProxyService` (forward một số API nếu cần, hoặc chỉ dùng webhook)
- [ ] Thêm entity `AutomationFlow` (flowId, workspaceId, campaignId, status)
- **Deliverables**: SSO test thành công (user click “Mở Automation” → vào Flowise với quyền workspace)
- **Responsible**: Backend

### **Phase 3: WebView Wrapper + FE Integration (2 ngày)**
- [ ] Tạo React component `AutomationWebView` (iframe + iframe-resizer + postMessage bridge)
- [ ] Thêm tab `/automation` trong App Store + Sidebar + Permission toggle
- [ ] Xử lý communication: 
  - Flowise → Liora (webhook khi save flow, run flow)
  - Liora → Flowise (postMessage gửi workspaceId, landingPageId)
- [ ] UI: Button “Tạo Flow mới”, “Liên kết với Campaign”, “Test trigger”
- **Deliverables**: WebView nhúng mượt, responsive, có loading + error fallback
- **Responsible**: Frontend

### **Phase 4: Business Logic & Sync (2–3 ngày)**
- [ ] AutomationService: 
  - Save flow ID vào Supabase + map với Liora entities (Campaign, OfferKit, FunnelX)
  - Trigger logic: Landing page convert → gọi Flowise webhook/run flow
  - Billing: Track active flow + usage minutes
  - Audit + History log
- [ ] Webhook endpoint `/api/automation/webhook` nhận event từ Flowise
- [ ] Event-driven: `AutomationFlowSaved`, `FlowExecuted` (Nest EventEmitter)
- **Deliverables**: Sync 2 chiều hoạt động hoàn chỉnh (tạo flow trong Flowise → xuất hiện trong Liora Campaign)
- **Responsible**: Backend + Product

### **Phase 5: Testing & Security (1–1.5 ngày)**
- [ ] Unit + Integration test (SSO, webhook, sync)
- [ ] E2E: Tạo flow → trigger từ landing page → kiểm tra execution
- [ ] Security: CSP cho iframe, JWT short-lived, rate limit webhook, sandbox Flowise
- [ ] Permission test (user chỉ thấy flow của workspace mình)
- **Deliverables**: Test coverage ≥ 85%, security checklist pass
- **Responsible**: QA + Security

### **Phase 6: Deployment & Monitoring (1 ngày)**
- [ ] Update CI/CD pipeline (build + deploy Flowise + Liora)
- [ ] Setup monitoring: Sentry (iframe error), Prometheus (Flowise CPU), Log (webhook)
- [ ] Feature flag “automation.flowise.enabled”
- [ ] Documentation: User guide + API internal
- **Deliverables**: Staging live, rollback plan (tắt flag = quay về dummy automation)
- **Responsible**: DevOps

### **Phase 7: Go-live & Optimize (ongoing)**
- [ ] Soft launch 10–20 user
- [ ] Thu thập feedback (UI smoothness, sync delay, mobile embed)
- [ ] Optimize: Lazy load iframe, recording flow execution, AI suggest flow template
- [ ] Scale plan: Multiple Flowise instance + load balancer

---

**Tóm tắt effort**

| Phase | Thời gian | Responsible       | Độ khó |
|-------|-----------|-------------------|--------|
| 0–1   | 1.5 ngày  | DevOps            | Thấp   |
| 2     | 2 ngày    | Backend           | Trung bình |
| 3     | 2 ngày    | Frontend          | Thấp   |
| 4     | 2–3 ngày  | Backend           | Trung bình |
| 5–7   | 3 ngày    | QA + DevOps       | Thấp   |
| **Tổng** | **8–12 ngày** | —               | —      |
