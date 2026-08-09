# Hướng dẫn lấy và cấu hình biến Ads Platform

Cập nhật: 2026-08-09

## 1. `.env.ads-platforms` được dùng như thế nào

File `.env.ads-platforms` hiện là checklist/template cấu hình, không được NestJS hoặc Docker Compose
tự động load. Docker local đang load `liora-monorepo/.env` qua `env_file`, vì vậy:

- local development: điền biến không nhạy cảm vào `.env`; secret có thể inject từ terminal hoặc secret
  file qua biến `ADS_VAULT_MASTER_KEY_FILE`;
- staging/production: tạo cùng tên biến trong secret manager của nền tảng deploy;
- không commit `.env`, `.env.ads-platforms` có giá trị thật, App Secret, Partner Key hoặc vault key.

Lệnh kiểm tra chỉ báo `READY/EMPTY/PLACEHOLDER`, không in secret:

```bash
pnpm ads:config:validate .env.ads-platforms
```

Trạng thái kiểm tra ngày 2026-08-09:

| Nhóm | Trạng thái | Thiếu |
|---|---|---|
| Core | Chưa sẵn sàng | vault key và OAuth return origin còn placeholder |
| Meta | Chưa sẵn sàng | App ID, App Secret, redirect URI thật |
| TikTok | Chưa sẵn sàng | App ID, App Secret, redirect URI thật |
| Shopee | Safe/read-only | partner và publish đang tắt; chưa có partner contract |

## 2. Core, PostgreSQL, Redis và BullMQ

### `ADS_VAULT_MASTER_KEY`

Đây không phải secret lấy từ Meta/TikTok/Shopee. Tự sinh một key ngẫu nhiên 32 byte:

```bash
openssl rand -base64 32
```

Đưa kết quả vào AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, HashiCorp Vault, Docker/K8s
Secret hoặc secret store của hệ thống deploy. Backend cũng hỗ trợ:

```dotenv
ADS_VAULT_MASTER_KEY_FILE=/run/secrets/ads_vault_master_key
```

File secret chỉ chứa chuỗi base64 32 byte. Không đổi key tùy ý sau khi đã có connection; cần quy trình
rotation/re-encrypt trước khi tăng `ADS_VAULT_KEY_VERSION`.

### Các biến core còn lại

| Biến | Lấy/đặt ở đâu | Giá trị/ý nghĩa |
|---|---|---|
| `ADS_VAULT_KEY_VERSION` | nội bộ | bắt đầu `v1`; metadata phục vụ rotation |
| `ADS_OAUTH_RETURN_ORIGINS` | domain frontend đã deploy | danh sách origin HTTPS phân tách dấu phẩy, ví dụ `https://app.domain.tld` |
| `ADS_EXTENSION_SESSION_TTL_SECONDS` | nội bộ | 60–900 giây; đề xuất `600` |
| `BULLMQ_ENABLED` | nội bộ | `true` để API enqueue job |
| `BULLMQ_RUN_WORKERS` | nội bộ | API container thường `false`, worker container `true` |
| `BULLMQ_PREFIX` | nội bộ | prefix Redis chung của API/worker, mặc định `liora:ladipage` |
| `DB_*`/`DATABASE_URL` | PostgreSQL deployment | database chứa migration và projection Ads |
| `REDIS_URL` | Redis deployment | API và worker phải dùng cùng Redis/database/prefix |

Local Docker đã xác nhận PostgreSQL, Redis, API và worker healthy. Migration
`AdsPlatformCore1762000000000` đã được apply ngày 2026-08-09.

## 3. Meta Ads

1. Đăng nhập [Meta for Developers](https://developers.facebook.com/apps/) và tạo/chọn Business app.
2. Thêm sản phẩm/use case liên quan Marketing API và Facebook Login for Business.
3. Trong **App settings → Basic**, lấy:
   - App ID → `META_APP_ID`;
   - App Secret → `META_APP_SECRET` (secret manager only).
4. Khai báo callback chính xác trong Valid OAuth Redirect URIs:
   `https://<backend-public>/api/ads-platform/connections/meta/oauth/callback`.
   Dùng đúng URL này cho `META_REDIRECT_URI`.
5. Xin App Review/Advanced Access cho các permission thực sự dùng:
   `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`.
6. Hoàn tất Business Verification và thêm user/ad account pilot vào Business/App roles khi Meta yêu cầu.
7. Chọn Marketing API version còn được Meta hỗ trợ cho app, điền cả tiền tố `v` vào
   `META_API_VERSION`; không hard-code version từ tài liệu cũ.

```dotenv
META_APP_ID=<App ID trong App settings>
META_APP_SECRET=<App Secret từ secret manager>
META_API_VERSION=vXX.X
META_REDIRECT_URI=https://api.domain.tld/api/ads-platform/connections/meta/oauth/callback
META_ADS_SCOPES=ads_management,ads_read,business_management,pages_read_engagement
```

Tham khảo chính thức:
[Marketing API Get Started](https://developers.facebook.com/docs/marketing-api/get-started),
[Facebook Login manual flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow),
[App Review](https://developers.facebook.com/docs/app-review/).

Không lấy Facebook access token từ Graph Explorer rồi đặt vào env. Token user/page/ad account phải sinh
qua OAuth của backend và được mã hóa trong `lp_ads_secret`.

## 4. TikTok Ads

1. Đăng ký developer tại [TikTok API for Business](https://business-api.tiktok.com/portal).
2. Tạo app, chọn Marketing API/Campaign Management và khai báo use case.
3. Trong **My Apps → App Detail → Basic Information**, lấy App ID và Secret sau khi app được duyệt:
   - App ID → `TIKTOK_APP_ID`;
   - Secret → `TIKTOK_APP_SECRET`.
4. Cấu hình callback công khai:
   `https://<backend-public>/api/ads-platform/connections/tiktok/oauth/callback`.
5. Callback trong portal và `TIKTOK_REDIRECT_URI` phải giống tuyệt đối.
6. Authorize advertiser pilot; backend dùng `/oauth2/advertiser/get/` để khám phá advertiser đã cấp quyền.

```dotenv
TIKTOK_APP_ID=<My Apps / Basic Information>
TIKTOK_APP_SECRET=<secret manager>
TIKTOK_API_VERSION=v1.3
TIKTOK_API_BASE_URL=https://business-api.tiktok.com/open_api/v1.3
TIKTOK_AUTH_URL=https://ads.tiktok.com/marketing_api/auth/
TIKTOK_REDIRECT_URI=https://api.domain.tld/api/ads-platform/connections/tiktok/oauth/callback
```

TikTok xác nhận App ID/Secret nằm ở My Apps → App Detail → Basic Information và callback phải khớp
redirect đã đăng ký. Xem [Authorization](https://business-api.tiktok.com/gateway/docs/index?doc_id=1738928364967937&language=ENGLISH)
và [TikTok API for Business portal](https://business-api.tiktok.com/portal).

## 5. Shopee Ads

Shopee Open Platform công khai không đồng nghĩa mọi partner đều có Ads Campaign API. Các biến
`SHOPEE_ADS_*` chỉ được điền từ tài liệu/hợp đồng partner đã được Shopee cấp cho chính tài khoản của
doanh nghiệp.

1. Đăng ký partner tại [Shopee Open Platform](https://open.shopee.com/).
2. Tạo app và hoàn tất review/authorization cho shop pilot.
3. Yêu cầu Shopee/partner manager xác nhận bằng văn bản:
   - có quyền Ads Campaign create/read/report hay không;
   - production/sandbox host;
   - cơ chế ký request (Partner ID/Partner Key/HMAC hay OAuth bearer);
   - schema campaign, budget, product IDs, paused status và error format.
4. Chỉ sau khi adapter/contract test khớp tài liệu được cấp mới đặt:
   `SHOPEE_ADS_PARTNER_ENABLED=true`.
5. Giữ `SHOPEE_ADS_PUBLISH_ENABLED=false` cho tới khi sandbox create + get/reconcile đạt và campaign
   được xác nhận không phân phối.

Các tên `SHOPEE_ADS_CLIENT_ID/CLIENT_SECRET` trong code là abstraction cho credential của contract
partner, không được tự suy diễn là Partner ID/Partner Key. Nếu contract dùng HMAC/signature, phải viết
adapter ký request tương ứng trước khi bật flag.

## 6. Sau khi điền cấu hình

1. Validate file cấu hình.
2. Inject secret vào API và worker, rồi recreate cả hai container để nhận env mới.
3. Kiểm tra `GET /api/ads-platform/providers`; version không được là `UNCONFIGURED`.
4. Gán `ads:*` cho role pilot được phê duyệt bằng:
   `ADS_PILOT_ROLE_IDS=<id> pnpm ads:permissions:pilot`.
5. Bật frontend `NEXT_PUBLIC_ADS_PLATFORM_MODE=live` và restart Next.js.
6. Chạy OAuth → discover account → sync → publish. Chỉ dùng account pilot và xác nhận kết quả
   `PAUSED`/`DISABLE` trước khi cho phép người dùng khác.

