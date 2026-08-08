# Báo cáo triển khai Ads Platform foundation

Cập nhật: 2026-08-08

## Kết quả đã đạt

- Tạo `@liora/ads-contracts` dùng chung cho provider, capability, operation context, snapshot và
  workflow publish.
- Tạo module NestJS `ads-platform` cho API và worker, tích hợp TenantGuard/RBAC, TypeORM và BullMQ.
- Tạo migration cho connection, secret, account, OAuth state, snapshot, job và audit event.
- Meta adapter có OAuth, account discovery, campaign/performance sync và publish theo bốn checkpoint;
  mọi entity mới mặc định `PAUSED`.
- TikTok adapter có OAuth, advertiser discovery, sync và publish theo ba checkpoint; quảng cáo mới
  mặc định `DISABLE`.
- Shopee adapter chỉ mở partner read/write khi có cấu hình và feature flag rõ ràng. Chế độ mặc định
  chỉ nhận browser snapshot bổ trợ, không giả định private Seller Centre API là API chính thức.
- Credential được mã hóa AES-256-GCM; snapshot có provenance/confidence/fingerprint và TTL.
- Job kiểm tra ownership đầy đủ theo tenant/connection/account/provider trước khi enqueue; publish có
  idempotency, checkpoint, resume guard và reconciliation.
- Extension có Ads Runtime dùng registry theo URL cho Meta/TikTok/Shopee, payload sanitizer, sender
  validation, extension session hash-at-rest/TTL và endpoint cố định; không có generic fetch/proxy.
- Frontend có repository trung lập nền tảng để gọi provider, OAuth, account, sync, publish và job API.

## Kiểm chứng

- Backend TypeScript: đạt.
- `ads-contracts` build: đạt.
- Backend Ads unit tests: 5 suites, 15 tests đạt.
- Frontend repository tests: 1 suite, 2 tests đạt.
- Extension Ads Runtime isolated TypeScript: đạt.

Kiểm tra TypeScript toàn extension hiện bị chặn bởi lỗi dependency/type có sẵn trong module
`e-commmer` và `keyword-tools`, không phát sinh từ Ads Runtime. TypeScript toàn frontend hiện bị chặn
bởi lỗi Apex marker có sẵn tại `StatisticsPrimitives.tsx`. Backend webpack build bị môi trường gọi
`webpack-cli` không đúng PATH; kiểm tra TypeScript trực tiếp đã đạt.

## Việc cần có trước khi chạy quảng cáo thật

Đây là các điều kiện vận hành bên ngoài mã nguồn, không thể tự tạo trong repository:

1. Apply migration, cấu hình PostgreSQL/Redis/BullMQ và gán các quyền `ads:*` cho role pilot.
2. Cấp Meta app/TikTok app đã review, redirect URI, scope và tài khoản sandbox/pilot.
3. Cấu hình secret vault trong secret manager; không commit secret vào `.env`.
4. Với Shopee, phải có hợp đồng/API partner đã duyệt và xác nhận schema; giữ publish flag tắt cho tới
   khi contract test với sandbox đạt.
5. Kết nối các màn hình Facebook Ads mock hiện tại sang `adsPlatformRepository`; UI TikTok/Shopee có
   thể tái sử dụng repository/workflow này nhưng vẫn cần mapper và form business riêng.
6. Chạy E2E OAuth → discover → sync → publish paused trong sandbox từng provider trước rollout pilot.

Không nên bật publish production chỉ dựa trên unit/typecheck. Gate cuối là sandbox E2E với credential
thật, kiểm tra tài nguyên tạo ra ở trạng thái tắt và đối soát audit/checkpoint.
