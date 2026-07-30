# Báo cáo triển khai Facebook Ads FE Mock

Ngày cập nhật: 29/07/2026

## Kết quả

Frontend mock đã được mở rộng từ hai màn hình Ads Manager/Create Campaign thành một workspace Facebook Ads hoàn chỉnh để duyệt UI/UX trước khi nối Backend. Giao diện dùng component, semantic color, typography, border, radius và dark mode của LadiPage; không sao chép bundle minify của AdsMeta và không gọi Meta API.

## Route đã triển khai

| Route | Nội dung |
|---|---|
| `/facebook-ads/manager` | Ads Manager theo Campaign/Ad Set/Ad |
| `/facebook-ads/create` | Wizard tạo Campaign/Ad Set/Ad |
| `/facebook-ads/drafts` | Danh sách draft, tiếp tục, nhân bản, xóa có xác nhận |
| `/facebook-ads/reports` | Metrics, saved reports, tạo/chia sẻ và xuất CSV |
| `/facebook-ads/rules` | Danh sách rule, bật/tắt, tạo và chỉnh sửa |
| `/facebook-ads/tools` | Hub 32 công cụ theo 5 nhóm |
| `/facebook-ads/tools/[slug]` | Dashboard mock dùng chung cho từng công cụ |

## Chức năng tương tác đã có

### Ads Manager

- Chuyển cấp Campaign, Ad Set và Ad.
- Tìm kiếm, lọc trạng thái và bộ lọc nâng cao.
- Chọn khoảng ngày bằng modal và preset.
- Tùy chỉnh các cột hiển thị.
- Chọn từng dòng/chọn tất cả và bật/tạm dừng hàng loạt qua bước xác nhận.
- Bật/tắt từng item trong mock state.
- Drawer chi tiết item.
- Modal hướng dẫn và drawer thông báo.
- Đổi mật độ bảng.
- Xuất CSV UTF-8 từ dữ liệu đang lọc hoặc các dòng đã chọn.

### Wizard tạo chiến dịch

- 4 bước Campaign → Ad Set → Ad → Review.
- Chọn account, objective, budget, conversion, pixel, audience, placement và nội dung.
- Modal tìm/chọn audience.
- Chọn ảnh/video từ máy; ảnh được preview bằng Data URL cục bộ, không upload server.
- Preview quảng cáo thay đổi theo nội dung form.
- Lưu draft timestamp trong state.
- Modal xác nhận hoàn tất, ghi rõ không publish lên Meta.

### Reports, Rules và Drafts

- Reports: tạo saved report trong state, share modal, export CSV.
- Rules: tạo/chỉnh sửa, bật/tắt rule và cấu hình điều kiện/action mock.
- Drafts: tiếp tục wizard, nhân bản UI, xóa có xác nhận.

### Bộ công cụ

Đã tạo catalog và route cho 32 công cụ tham chiếu từ clone AdsMeta, gồm:

- Ngân sách: overview, burndown, waste finder, scheduled rules, forecast.
- Ra mắt: campaign cloner, bulk launcher, launch templates.
- Creative/analytics: live stats, creative analyzer, refresh planner, copy fatigue, rotation, AI copy, winning ad, CTA, A/B test.
- Health/optimization: alerts, troubleshooter, account health, campaign score/lifecycle, CBO, CPA trend, benchmark, smart pause.
- Tracking/funnel: drop-off, cost per milestone, inactive assets, Pixel, CAPI, UTM Builder.

Mỗi route có metrics, chart mock, recommendations, cấu hình và thao tác chạy phân tích cục bộ. Cách này đảm bảo duyệt đủ navigation/IA trước, đồng thời tránh tạo hàng chục màn hình copy-paste khó bảo trì.

## Light/Dark mode và layout

- Workspace Facebook Ads có theme scope riêng dùng màu LadiPage `lime-500`; CTA, focus ring, hover, icon nhấn và navigation active cùng một hệ xanh.
- Chỉ sử dụng token như `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-accent`.
- Status dùng semantic success/warning/error; màu xanh Facebook không chiếm vai trò CTA chính.
- Modal/drawer hỗ trợ đóng bằng `Escape`, backdrop và scroll nội dung.
- Sidebar Facebook Ads có scroll riêng trên desktop và navigation ngang trên màn hình nhỏ.
- Các bảng có horizontal scroll để không phá layout ở viewport hẹp.
- Wizard đặt tiến trình Campaign → Ad Set → Ad → Review thành một thanh ngang phía trên, có progress bar và phần trăm hoàn thành.
- Cột tiến trình bên trái đã được loại bỏ; từ breakpoint `xl`, form và preview nằm ngang thành hai cột. Preview cố định rộng tối đa 320px theo tỷ lệ mobile và thẳng hàng với đầu card thiết lập; trên màn hình hẹp preview tự xuống dưới.

## Kiểm tra kỹ thuật

- ESLint phạm vi toàn bộ phần code Facebook Ads mới: đạt.
- TypeScript `tsc --noEmit`: đạt.
- Production build Next.js 16.2.9: đạt; 233 static pages được tạo và toàn bộ 32 route công cụ được prerender bằng `generateStaticParams`.

## Phần cố ý chưa nối

Những phần sau cần Backend và Meta OAuth/Marketing API, không nên giả lập thành thao tác thật ở Frontend:

- Đăng nhập/kết nối Meta và quản lý access token.
- Đồng bộ ad accounts, pages, pixels, audiences, campaigns và insights.
- Upload media lên Meta.
- Draft persistence, validation server và audit log.
- Publish Campaign/Ad Set/Creative/Ad.
- Queue, idempotency, retry, progress và error mapping.
- Thay đổi status/budget thật, rules engine, notifications thật và scheduled reports.

Chi tiết contract và thứ tự triển khai nằm trong `PLAN-BE.md` và `PLAN-FE.md`.
