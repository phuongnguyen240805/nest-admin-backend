✅ **CHECKLIST TRIỂN KHAI TÍCH HỢP GADS → CLOUD PHONE MODULE**  
**(Phiên bản chi tiết, theo mô hình BE-first + Business Logic)**

Tôi chia thành **8 phase** rõ ràng, có **thời gian ước tính**, **người chịu trách nhiệm**, **deliverables**, **dependencies** và **rủi ro/mitigation**.  
Tổng thời gian thực tế: **14–21 ngày** (2–3 dev full-time, tùy kinh nghiệm với Nest & Go).

### **Phase 0: Chuẩn bị (1–2 ngày)**
- [ ] Đọc lại toàn bộ docs GADS (hub.md, provider.md, secret-keys.md, appium-credentials.md) + release notes gần nhất (v5.7.0)
- [ ] Tạo branch `feature/cloud-phone-gads-integration` trong monorepo
- [ ] Liệt kê yêu cầu business (danh sách API FE cần, quyền RBAC, billing model, integration với Landing Page Builder)
- [ ] Setup môi trường local: Node 20+, pnpm 9, Docker Desktop, Go 1.22+, MongoDB 6+, 2–3 điện thoại thật (Android + iOS test)
- **Deliverables**: Notion/Excel requirements + architecture diagram (mermaid)
- **Responsible**: Tech Lead / Bạn

### **Phase 1: Infrastructure & Docker (2 ngày)**
- [ ] Tạo folder `docker/gads/` → viết `docker-compose.gads.yml` (Hub + Provider + Mongo + Redis adapter)
- [ ] Build/custom GADS binary nếu cần (thêm flag `--auth=true`, expose port 10000, 4723 grid)
- [ ] Kết nối network internal với Liora stack (Traefik/Nginx proxy)
- [ ] Thêm volume cho provider logs + device supervision profiles
- [ ] Test chạy GADS standalone (`pnpm docker:up:gads`)
- **Deliverables**: Docker compose chạy ổn, GADS Hub accessible từ localhost:10000
- **Responsible**: DevOps / Backend

### **Phase 2: Tạo NestJS Module cơ bản (2–3 ngày)**
- [ ] Tạo lib `@liora/cloud-phone` trong Nx monorepo
- [ ] Tạo `CloudPhoneModule`, `CloudPhoneService`, `CloudPhoneController`, `GadsAdapter`
- [ ] Import module vào `ladipage-backend` (hoặc app riêng `cloud-phone-service`)
- [ ] Thêm TypeORM entity `CloudPhoneSession`, `CloudPhoneBooking`
- [ ] Setup DTOs + ValidationPipe (Zod + class-validator)
- **Deliverables**: Module compile thành công, Swagger xuất hiện `/docs/cloudphone`
- **Responsible**: Backend

### **Phase 3: Adapter & Client (2–3 ngày)**
- [ ] Viết `GadsHttpClient` (axios instance + interceptor)
- [ ] Implement `GadsAdapter` (bookDevice, releaseDevice, startSession, takeScreenshot, runAppium, sendAction)
- [ ] Xử lý auth mapping: Supabase JWT → GADS JWT / OAuth2 client credentials
- [ ] Thêm WebSocket Gateway cho realtime control (tap/swipe/stream)
- [ ] Xử lý Appium Grid proxy (`/grid` endpoint)
- **Deliverables**: Adapter test thành công trên Postman (book device + start session)
- **Responsible**: Backend

### **Phase 4: Business Logic & Integration (3–4 ngày)**
- [ ] CloudPhoneService: RBAC, quota check, workspace mapping, billing (per minute), audit log, event emit
- [ ] Tích hợp Landing Page: API `run-landing-test` (lấy published_html → install app → test trên device)
- [ ] Webhook + SSE: device ready → notify FE, session ended → save recording
- [ ] Thêm guard `CloudPhoneAccessGuard` + feature flag
- **Deliverables**: 8–10 endpoint chính hoạt động + business rules hoàn chỉnh
- **Responsible**: Backend + Product

### **Phase 5: Frontend Integration (2 ngày)**
- [ ] Tạo tab `/cloudphone` trong App Store + Sidebar
- [ ] Viết TanStack Query hooks (`useBookDevice`, `useStartSession`)
- [ ] Component DeviceList, SessionPanel, RemoteControlViewer (WebSocket + video stream)
- [ ] Permission UI + loading state + error handling
- **Deliverables**: FE gọi API Nest thành công, UI cơ bản hoạt động
- **Responsible**: Frontend

### **Phase 6: Testing & Security (2 ngày)**
- [ ] Unit test Adapter + Service (Jest)
- [ ] E2E test (Cypress + real device)
- [ ] Security audit: CORS, rate limit, JWT validation, network isolation, data encryption
- [ ] Load test (10 concurrent sessions)
- [ ] Penetration test cơ bản (auth bypass, device hijack)
- **Deliverables**: Test pass ≥ 90%, security report
- **Responsible**: QA + Security

### **Phase 7: Deployment & Monitoring (1–2 ngày)**
- [ ] Update main `docker-compose.yml` + CI/CD pipeline (GitHub Actions)
- [ ] Deploy GADS + CloudPhoneModule lên staging
- [ ] Setup monitoring: Prometheus (GADS metrics) + Sentry + LogRocket + Grafana dashboard
- [ ] Feature flag toggle (Unleash hoặc Supabase)
- [ ] Documentation API + user guide
- **Deliverables**: Staging live, rollback plan sẵn sàng
- **Responsible**: DevOps

### **Phase 8: Go-live & Post-launch (ongoing)**
- [ ] Soft launch cho 10 user test
- [ ] Thu thập feedback → iterate (UI stream, recording storage, multi-device parallel)
- [ ] Tối ưu cost (device utilization report)
- [ ] Backup/restore strategy cho GADS Mongo + sessions

---

**Tóm tắt effort & chi phí ước tính**

| Phase          | Thời gian | Người thực hiện     | Ước tính chi phí (server/hardware) |
|----------------|-----------|---------------------|------------------------------------|
| 0–1            | 3 ngày    | DevOps              | ~$50 (test phones + VPS)          |
| 2–4            | 7–10 ngày | Backend (2 người)   | -                                  |
| 5–6            | 4 ngày    | FE + QA             | -                                  |
| 7–8            | 3 ngày    | DevOps + All        | +$150/tháng (prod servers)         |

**Tổng**: 14–21 ngày → MVP có thể dùng được.
