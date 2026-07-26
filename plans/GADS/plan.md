Kế hoạch Cloud Phone — bản chốt theo quyết định
Cấu hình đã chọn: Điện thoại Android thật · Automation đầy đủ (gồm bot) · Dùng GADS nguyên trạng qua API.

Ba lựa chọn này định hình lại kế hoạch như sau — có phần nhẹ đi, có phần nặng thêm.

Lựa chọn	Tác động lên kế hoạch
Máy thật	✅ Bỏ hoàn toàn khối Provisioning orchestrator (P6 cũ) — không cần redroid/container. Đổi lại: khối vận hành vật lý (USB hub, nguồn, mạng, giám sát máy treo). Chống-detect tốt sẵn.
Automation đầy đủ (bot)	⚠️ Khối lớn nhất giờ là Workflow/Bot engine + thư viện script per-app. Rủi ro tuân thủ/pháp lý cao — cần rào chắn (mục E).
GADS as-is, API only	✅ Không fork, không đụng AGPL/hub-ui. GADS chạy như service. Nhưng: bị giới hạn trong API GADS cung cấp — thiếu gì phải bù ở tầng Nest, không sửa GADS được.
A. Kiến trúc chốt

FE /cloudphone ─► ladipage-backend /api/cloudphone/* ─► GADS Hub API─► Provider(s) ─► Điện thoại thật (USB)
                        │
          ┌────────────┼┐
       Rental+Billing  WorkflowEngine  Gateway(WS relay)
       (Nest own DB)   (đẩy /grid)     (stream + broadcast)
GADS = động cơ: điều khiển máy, stream, Appium Grid, reservation. Chạy như binary/service riêng, Nest chỉ gọi API.
NestJS = toàn bộ nghiệp vụ: thuê, tiền, workflow, group sync, audit, proxy binding.
FE không bao giờ chạm GADS.
B. Vận hành máy thật (thay cho Provisioning)
Vì chọn máy thật, thay vì viết orchestrator cấp máy, bạn cần quy trình đưa máy vào farm:

Máy Android thật cắm USB vào host provider (Linux/Windows/macOS). Một host gánh được nhiều máy qua USB hub có nguồn.
Chạy GADS provider --nickname X --hub http://hub:port → provider tự phát hiện máy, cài Appium/agent, báo lên Hub.
Admin gán máy vào Workspace/tenant tương ứng qua GADS admin API (POST /admin/device, set WorkspaceID).
Nest đọc danh sách máy khả dụng qua Hub, ánh xạ thành "kho cho thuê".
→ Không có "cấp máy theo yêu cầu" tự động — kho là cố định theo số máy vật lý. stock trong UI = số máy rảnh thật. Đây là khác biệt với gemphonefarm (họ scale emulator); mô hình của bạn giống cho thuê máy thật theo lô.

Cần chuẩn bị vật lý: USB hub có nguồn, tản nhiệt, mạng ổn định per-host, script giám sát máy rớt/treo (health check qua /device/:udid/health), quy trình cắm lại khi mất kết nối.

C. Tầng nghiệp vụ NestJS (source-of-truth)
C.1 Dữ liệu (persist — GADS không lưu)
| Bảng | Vai trò |
|---|
| lp_cloud_phone_plan | Gói thuê: giá ngày/tuần/tháng, map tới nhóm máy (theo model/OS) |
| lp_cloud_phone_booking | Lượt thuê: tenant, user, gads_udid, plan, status, thuê→hết hạn, proxy_id |
| lp_cloud_phone_session | Phiên điều khiển: booking_id, gads_session_id, thời lượng |
| lp_cloud_phone_proxy | Proxy gắn máy: host/port/cred/region |
| lp_cloud_phone_workflow | Template + lịch chạy bot |
| lp_cloud_phone_workflow_run | Log mỗi lần chạy workflow (kết quả, screnshot) |
| lp_cloud_phone_action_log | Audit mọi tap/swipe/install/script — bắt buộc cho use-case bot |

C.2 API /api/cloudphone/* (JWT + Tenant + CloudPhoneAccessGuard)
Kho/gói: GET /plans, GET /devices (ánh xạ máy GADS rảnh)
Thuê: POST /bookings, GET /bookings, DELETE /bookings/:id
Phiên: POST /sessions, DELETE /sessions/:id, POST /sessions/:id/actions, POST /sessions/:id/screnshot
Nhóm (đồng bộ): POST /groups/:id/broadcast (Nest fan-out tới N udid)
Proxy: POST /bookings/:id/proxy
Workflow: GET /workflows, POST /workflows/:id/run, GET /workflow-runs/:id
C.3 Auth bridge
Dùng OAuth2 client-credentials của GADS: Nest giữ GADS_CLIENT_ID/SECRET, gọi POST /oauth/token lấy Bearer 1h, cache+refresh. Mọi call GADS dùng token máy này. Không expose secret ra FE. Không dùng user CRUD của GADS (password plaintext).

C.4 Billing
Tái dùng modules/credit + modules/plan sẵn có. Trừ theo gói lúc thuê (đơn giản) hoặc theo phút (chính xác hơn). Cron auto-release booking hết hạn → POST /devices/:udid/unlock + đóng session. Bật app: đổi CloudPhone.statusActive từ false→true trong sed catalog, giữ minTier: pro.

D. Workflow/Bot engine (khối nặng nhất)
Vì GADS as-is chỉ cho Appium Grid (/grid) + custom-action, engine bot phải xây ở Nest:

Cơ chế thực thi: Nest tạo job → gọi /grid/session (kèm gads:clientSecret trong capabilities) → chạy chuỗi lệnh Appium theo template. Hoặc ghép custom-action (tap/swipe/type theo tọa độ) cho thao tác đơn giản.
Thư viện script per-app: mỗi loại bot (Facebook share, TikTok, Shopee bump, Telegram, Zalo…) là 1 template riêng — đây là phần tốn công và dễ vỡ khi app đích cập nhật UI. Cần cơ chế versioning + cập nhật template.
Scheduler: job định kỳ (nuôi nick delay ngẫu nhiên để tránh giới hạn). Dùng que (BullMQ/Redis) — kiểm tra Liora đã có Redis chưa.
Group sync/broadcast: Nest nhận 1 lệnh → fan-out song tới nhiều máy trong nhóm, gom kết quả. GADS không biết khái niệm nhóm.
E. Rủi ro tuân thủ (BẮT BUỘC lưu ý — do chọn bot đầy đủ)
Đây là lựa chọn rủi ro cao nhất, tôi phải nêu rõ dù bạn đã chốt:

Vi phạm ToS nền tảng: bot nuôi nick/spam/tương tác ảo vi phạm điều khoản Facebook/TikTok/Shopee/Telegram/Zalo. Rủi ro: tài khoản người dùng bị khóa, IP/proxy bị blacklist, và rủi ro pháp lý cho chính dịch vụ nếu bị xem là tiếp tay gian lận/spam.
Rào chắn tối thiểu cần có: điều khoản sử dụng rõ ràng (đã có mầm trong StoreView), audit log đầy đủ (action_log), giới hạn tốc độ, cơ chế chặn nội dung cấm (mã độc, lừa đảo), KYC người thuê nếu cần.
Không giúp được các mục đích bất hợp pháp cụ thể (phát tán mã độc, lừa đảo, tấn công) — đây là ranh giới tôi không hỗ trợ vượt qua, kể cả khi đóng gói vào workflow.
→ Khuyến nghị vận hành: tách automation hợp pháp (kiểm thử app của chính người dùng, QA) khỏi bot tương tác social; với nhóm sau cần chính sách + pháp lý duyệt trước khi go-live. Kỹ thuật thì cùng engine, khác template.

F. Lộ trình chốt (đã bỏ Provisioning, thêm Bot)
| Phase | Nội dung | Ước tính |
|---|---|
| P0 | Dựng 1 GADS Hub + 1 Provider + vài máy Android thật (staging). Setup USB hub, mạng, MongoDB. Chính sách tuân thủ. | 2–3 ngày |
| P1 | Đưa GADS Hub + Mongo vào docker/gads/ (Hub containerized; provider chạy trên host có cắm máy). Mạng nội b. | 2 ngày |
| P2 | modules/cloud-phone/ skeleton + entities + migration + GadsAuthService (OAuth2 client-credentials) | 2–3 ngày |
| P3 | GadsAdapter + GET /devices + POST/DELETE /bookings + lease lock + persist | 2–3 ngày |
| P4 | Session + action relay + screenshot + stream relay qua Gateway (WS Nest↔Hub) | 3ngày |
| P5 | Billing + quota + cron auto-release, nối credit/plan, bật statusActive | 2 ngày |
| P6 | Proxy binding (gắn proxy từng máy) | 2 ngày |
| P7 | Group sync / broadcast (fan-out) | 2 ngày |
| P8 | Workflow/Bot engine: queue + template đầu tiên (1–2 app) + scheduler + audit | 5–8 ngày (mở rộng theo số app) |
| P9 | FE wire: React Query, DeviceData.id number→string, WS qua Nest, bỏ mock | 3 ngày (FE) |

Tổng lõi (P1–P7, P9):~4–5 tuần / 2 dev. P8 (bot) là khối co giãn — mỗi app đích thêm ~2–4 ngày và cần bảo trì liên tục.

G. Điểm khác biệt so với gemphonefarm (do chọn máy thật)
Kho cố định theo số máy vật lý, không auto-scale. stock = máy rảnh thật.
Không cấp máy tức thì vô hạn — hết máy phải chờ trả hoặc cắm thêm.
Chống detect tốt hơn emulator → phù hợp use-case bot social hơn.
Vận hành nghiêng về quản lý phần cứng thay vì DevOps container.
Kế hoạch giờ đã khớp 3 quyết định của bạn, không có code. Bước tiếp theo khi bạn muốn triển khai: tôi sẽ bắt đầu từ P1(dockerize GADS) hoặc P2 (module skeleton NestJS) tùy bạn muốn dựng hạ tầng trước hay code khung trước. Bạn muốn tôi đi sâu vào phần nào — thiết kế chi tiết DB/DTO, thiết kế Gateway stream relay, hay thiết kế workflow engine?