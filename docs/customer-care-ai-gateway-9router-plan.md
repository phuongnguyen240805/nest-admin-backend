# Kế hoạch AI Gateway 9router cho Customer Care LadiPage

## Mục tiêu

Đưa một lớp AI độc lập vào luồng CSKH để tự động phân loại hội thoại, gợi ý nhãn, tóm tắt, ưu tiên và hỗ trợ trả lời. 9router/OmniRoute là OpenAI-compatible gateway; LibreDesk và backend LadiPage không gọi trực tiếp từng nhà cung cấp model.

## Kiến trúc đích

`Zalo/Facebook -> Connector -> Nest Customer Care -> LibreDesk -> Outbox AI -> AI Worker -> 9router -> Model`

- NestJS là nguồn sự thật về tenant, contact, liên kết CRM/đơn hàng và audit.
- LibreDesk lưu hội thoại/tin nhắn/nhãn và cung cấp thao tác agent.
- AI Worker đọc event bất đồng bộ, gọi `/api/v1/chat/completions` của 9router và ghi kết quả có idempotency.
- 9router quản lý model, credential, fallback, quota và circuit breaker; không để API key model ở frontend.

## Hợp đồng phân loại v1

Input chỉ gồm các tin nhắn công khai gần nhất, ngôn ngữ, kênh, nhãn hiện có và metadata tối thiểu. Output bắt buộc là JSON schema:

```json
{
  "intent": "mua_hang|cau_hoi|kiem_hang|tra_hang|het_hang|khac",
  "suggestedTags": ["Mua hàng"],
  "priority": "low|normal|high|urgent",
  "sentiment": "negative|neutral|positive",
  "confidence": 0.0,
  "summary": "...",
  "needsHuman": true
}
```

- `confidence >= 0.85`: tự gắn tối đa 3 nhãn trong allow-list.
- `0.60–0.84`: chỉ hiện gợi ý để nhân viên xác nhận.
- `< 0.60`, khiếu nại, hoàn tiền hoặc nội dung nhạy cảm: chuyển người xử lý, không tự trả lời.
- Nhãn do người dùng sửa được khóa khỏi auto-override trong 30 ngày.

## Các giai đoạn

### Giai đoạn 1 — nền tảng và quan sát

- Thêm `cc_ai_jobs`, `cc_ai_results`, `cc_ai_feedback` và outbox event `message.created`.
- Cấu hình tenant-scoped: gateway URL, virtual model/combo, timeout, ngân sách token, tính năng bật/tắt.
- Redact số thẻ, credential, cookie và trường PII không cần thiết trước khi gọi gateway.
- Metrics: latency, token/cost, fallback count, lỗi schema, tỷ lệ agent chấp nhận gợi ý.

### Giai đoạn 2 — phân loại và nhãn

- Chạy classifier sau inbound debounce 3–5 giây để tránh gọi một lần cho từng mảnh tin.
- Validate JSON schema; retry tối đa một lần với model dự phòng qua combo 9router.
- Gắn nhãn qua LibreDesk và phát `conversation.updated` để UI cập nhật realtime.
- UI hiển thị nguồn `AI`, confidence, nút chấp nhận/từ chối; feedback trở thành tập đánh giá.

### Giai đoạn 3 — tóm tắt, routing và SLA

- Tóm tắt hội thoại khi bàn giao hoặc sau mỗi ngưỡng tin nhắn.
- Gợi ý team/agent theo intent, lịch làm việc và tải; rule engine quyết định routing cuối cùng.
- Tự đặt ưu tiên/SLA cho từ khóa khẩn cấp nhưng luôn có audit trail và undo.

### Giai đoạn 4 — trợ lý trả lời và hành động

- Draft reply dựa trên knowledge snippets, sản phẩm và trạng thái đơn LadiPage.
- Tool calls chỉ đọc ở bước đầu: tra sản phẩm, tồn kho, đơn hàng, khách hàng.
- Các hành động ghi như tạo đơn, hoàn tiền, đổi trạng thái phải có xác nhận của nhân viên và idempotency key.

## An toàn và vận hành

- Không gửi cookie Facebook/Zalo, access token hoặc private note sang model.
- Tách dữ liệu theo tenant trong job, cache, log và API key 9router.
- Prompt/model version được lưu cùng từng kết quả để tái hiện quyết định.
- Canary 5% tenant nội bộ, sau đó 25% và 100% khi precision nhãn đạt mục tiêu; có kill switch theo tenant.
- Bộ đánh giá ban đầu tối thiểu 500 hội thoại đã ẩn danh, đo precision/recall từng intent, false escalation và chi phí/hội thoại.

## Tiêu chí hoàn tất v1

- 99% job không mất sự kiện, xử lý idempotent khi retry.
- p95 phân loại dưới 8 giây (không tính thời gian debounce).
- Precision nhãn tự động >= 90% trên nhóm có confidence cao.
- Agent có thể xem lý do ngắn, sửa nhãn và hoàn tác mọi thay đổi AI.
- Gateway/provider lỗi không chặn nhận, hiển thị hoặc gửi tin nhắn CSKH.
