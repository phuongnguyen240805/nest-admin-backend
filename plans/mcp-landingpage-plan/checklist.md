**✅ CHECKLIST: Xây dựng luồng tương tự MCP cho LadiPage (appv6.ladipage.com/settings/api) bằng 4 dự án AI**
https://github.com/Lyang77/chatgpt2api, 
https://github.com/Sophomoresty/gemini-web2api,
 https://github.com/XianYuDaXian/grok2api,
https://github.com/diegosouzapw/OmniRoute.git

Dưới đây là checklist chi tiết, thực tế và có thứ tự để bạn dựng được hệ thống **Agent-Ready** cho LadiPage, tận dụng:

- `chatgpt2api`
- `gemini-web2api`
- `grok2api`
- **OmniRoute** (làm gateway trung tâm)

### **Phase 1: Chuẩn bị Backend LadiPage (Bắt buộc)**

- [ ] Trong `nest-admin-backend` (đặc biệt `ladipage-backend`), đảm bảo đã có các API endpoint cần thiết cho Agent:
  - Tạo landing page / draft
  - Publish page
  - Lấy danh sách lead / order
  - Update funnel / offer
  - Upload ảnh/video (nếu cần)
- [ ] Thiết kế **Tool definitions** rõ ràng (tên tool + input schema) để sau này map vào MCP.
- [ ] Hoàn thiện hệ thống **API Key** trong `/settings/api` (hiện tại bạn đã có).
  - Hỗ trợ phân quyền (read-only, full access…)
  - Lưu trữ an toàn + rotate key
- [ ] Thêm logging + rate limit cho các API sẽ được Agent gọi.

### **Phase 2: Triển khai 3 Web2API Projects**

- [ ] Deploy `gemini-web2api` (dùng cho reasoning + nội dung)
- [ ] Deploy `chatgpt2api` (dùng cho image generation + editing mạnh)
- [ ] Deploy `grok2api` (dùng cho image + video generation)
- [ ] Cấu hình **account pool + proxy** cho từng dự án (đặc biệt chatgpt2api và grok2api) để ổn định.
- [ ] Test từng web2api độc lập trước (gọi `/v1/chat/completions` và image endpoint).

### **Phase 3: Triển khai OmniRoute (Quan trọng nhất)**

- [ ] Deploy **OmniRoute** (khuyến nghị dùng Docker)
- [ ] Thêm 3 web2api làm **Custom Provider** trong OmniRoute dashboard:
  - Gemini-web2api
  - chatgpt2api
  - grok2api
- [ ] Cấu hình **Routing Strategy**:
  - Dùng `auto/fast` hoặc `auto/cheap` cho nội dung
  - Dùng routing theo capability (image → chatgpt2api/grok2api)
  - Dùng **Fusion** hoặc **Pipeline** strategy khi cần kết hợp nhiều model
- [ ] Bật **Token Compression** (RTK + Caveman) để tiết kiệm chi phí
- [ ] Tạo **API Key** trong OmniRoute để Agent gọi (chỉ cần 1 key duy nhất)

### **Phase 4: Xây dựng / Kết nối MCP Server**

Có 2 hướng:

**Hướng A (Khuyến nghị ban đầu):** Dùng MCP Server bên thứ 3 + kết nối qua OmniRoute
- [ ] Deploy `ladipage-mcp` (hoặc MCP server chính thức của LadiPage nếu có)
- [ ] Cấu hình `LADISALES_API_KEY` (lấy từ LadiPage Settings/API)
- [ ] Thêm MCP Server của LadiPage vào OmniRoute (nếu OmniRoute hỗ trợ MCP gateway) hoặc để Agent gọi trực tiếp

**Hướng B (Nâng cao):** Tự build MCP Server
- [ ] Xây dựng MCP Server (dùng FastMCP hoặc framework tương tự)
- [ ] Map các Tool với API của `ladipage-backend`
- [ ] Xác thực bằng API Key của LadiPage

### **Phase 5: Cấu hình Agent (Claude / Cursor)**

- [ ] Cấu hình Claude Desktop / Cursor trỏ vào **OmniRoute endpoint** (`/v1`)
- [ ] Thêm MCP Server của LadiPage (hoặc qua OmniRoute)
- [ ] Viết **System Prompt** tốt cho Agent:
  - Hướng dẫn Agent khi nào nên dùng model nào
  - Khi nào nên gọi LadiPage MCP tool
- [ ] Test prompt tạo landing page end-to-end

### **Phase 6: Test & Debugging**

- [ ] Test từng phần riêng lẻ:
  - Gọi model qua OmniRoute
  - Gọi MCP tool tạo/publish page
- [ ] Test luồng kết hợp (Agent tự động chọn model + gọi MCP)
- [ ] Kiểm tra logging, error handling, fallback
- [ ] Đo token usage + chi phí

### **Phase 7: Production & Tối ưu**

- [ ] Deploy tất cả lên server ổn định (Docker + reverse proxy)
- [ ] Thiết lập monitoring (health check, quota, lỗi)
- [ ] Cấu hình **auto-fallback** và **cost optimization** trong OmniRoute
- [ ] Thêm guardrail / permission cho Agent (tránh Agent làm hỏng dữ liệu)
- [ ] Document hóa toàn bộ luồng cho team

### **Tóm tắt kiến trúc khuyến nghị**

```
Agent (Claude / Cursor)
        ↓
OmniRoute (1 endpoint duy nhất)
        ├──→ gemini-web2api     (nội dung + reasoning)
        ├──→ chatgpt2api        (hình ảnh)
        ├──→ grok2api           (hình ảnh + video)
        └──→ LadiPage MCP       (tạo page, publish, lead…)
                ↓
        ladipage-backend (NestJS)
```

