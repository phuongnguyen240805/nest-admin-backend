# Báo cáo chức năng từng file Ads Platform

Cập nhật: 2026-08-09

## 1. Module và wiring

| File | Chức năng |
|---|---|
| `ads-platform.module.ts` | Module HTTP/API: controller, provider plugin, queue producer và processor khi API được cấu hình chạy worker. |
| `ads-platform.shared.module.ts` | Đăng ký toàn bộ entity/core service dùng chung cho API và worker; bảo đảm registry, vault, job store cùng contract. |
| `ads-platform-worker.module.ts` | Module riêng cho worker process; đăng ký queue consumer và ba provider plugin, không expose controller. |
| `README.md` | Runbook cấu hình, migration, OAuth và trình tự vận hành an toàn. |

## 2. Controller và guard

| File | Chức năng |
|---|---|
| `controllers/ads-platform.controller.ts` | Facade tenant-safe cho provider manifest, connection, OAuth start, account discovery, sync/publish job, job status, extension session và snapshot query. Áp permission `ads:*`. |
| `controllers/ads-oauth-callback.controller.ts` | Callback public có kiểm tra provider/code/state; complete OAuth rồi redirect về frontend allowlisted. Không phụ thuộc JWT browser tại callback. |
| `controllers/ads-extension.controller.ts` | Endpoint public duy nhất nhận browser snapshot nhưng bắt buộc extension-session guard; không nhận token provider. |
| `guards/ads-extension-session.guard.ts` | Xác thực bearer token ngắn hạn + device ID, phục hồi tenant/actor context; token này không đi qua publish endpoints. |
| `dto/ads-platform.dto.ts` | DTO whitelist và validation cho OAuth, sync, publish, extension session/snapshot và snapshot query. |

## 3. Core security và cross-cutting logic

| File | Chức năng |
|---|---|
| `core/ads-provider-registry.service.ts` | Registry plugin theo provider, chống đăng ký trùng và kiểm tra capability trước khi gọi. |
| `core/ads-operation-context.factory.ts` | Tạo operation/trace context thống nhất xuyên API → worker → provider → audit. |
| `core/ads-oauth-state.service.ts` | Sinh state ngẫu nhiên, lưu hash, TTL 10 phút, consume trong transaction có pessimistic lock chống replay; validate return URL. |
| `core/ads-vault.service.ts` | Mã hóa/decrypt credential bằng AES-256-GCM, AAD là connection ID; hỗ trợ env secret hoặc `ADS_VAULT_MASTER_KEY_FILE`. |
| `core/ads-credential.service.ts` | Chỉ decrypt sau khi chứng minh connection đang `CONNECTED` và khớp tenant/provider. |
| `core/ads-redaction.service.ts` | Redact credential/header/token khỏi audit và structured log. |
| `core/ads-audit.service.ts` | Ghi immutable-style audit event theo tenant, operation, actor, provider, outcome; metadata luôn qua redaction. |
| `core/ads-fingerprint.service.ts` | Stable serialize + SHA-256 để dedupe snapshot/draft độc lập thứ tự object key. |

Các file `*.spec.ts` trong `core/` kiểm tra registry, redaction và fingerprint.

## 4. Persistence entities

| File | Bảng | Chức năng |
|---|---|---|
| `entities/ads-connection.entity.ts` | `lp_ads_connection` | Trạng thái OAuth connection, external user, scopes, expiry; không chứa plaintext token. |
| `entities/ads-secret.entity.ts` | `lp_ads_secret` | Ciphertext, IV, GCM auth tag và key version; quan hệ 1:1 với connection. |
| `entities/ads-account.entity.ts` | `lp_ads_account` | Ad account/shop/advertiser đã discover và ownership theo tenant/connection/provider. |
| `entities/ads-oauth-state.entity.ts` | `lp_ads_oauth_state` | State hash, tenant/actor/provider, return target, expiry và consumed timestamp. |
| `entities/ads-extension-session.entity.ts` | `lp_ads_extension_session` | Token hash, device binding, actor/tenant, TTL/revoke/last seen của extension snapshot session. |
| `entities/ads-snapshot.entity.ts` | `lp_ads_snapshot` | Snapshot có source/confidence/schema/fingerprint/freshness; unique theo account/source. |
| `entities/ads-job.entity.ts` | `lp_ads_job` | Job state, payload, idempotency key, Bull job ID, checkpoint, result và error. |
| `entities/ads-audit-event.entity.ts` | `lp_ads_audit_event` | Timeline bảo mật/audit cho connect, sync, publish và extension ingest. |
| `entities/index.ts` | — | Barrel export entity cho shared module. |

Schema được tạo bởi `libs/database/src/migrations/1762000000000-ads-platform-core.ts`; migration cũng
tạo menu permission `ads:read`, `ads:connection:manage`, `ads:sync`, `ads:publish`, `ads:action` nhưng
không tự mở quyền cho role.

## 5. Services và workflow

| File | Chức năng |
|---|---|
| `services/ads-connection.service.ts` | OAuth start/complete, upsert connection, lưu vault, disconnect, discover/upsert account và audit. |
| `services/ads-extension-session.service.ts` | Issue token ngẫu nhiên chỉ trả một lần, lưu SHA-256 hash, TTL 60–900 giây và authenticate theo device. |
| `services/ads-browser-snapshot.service.ts` | Xác minh account ownership, gọi provider normalizer, persist supplemental snapshot và audit. |
| `services/ads-snapshot.service.ts` | Insert/dedupe snapshot và query latest theo tenant/provider/account. |
| `services/ads-job.service.ts` | Kiểm tra BullMQ, capability và ownership; tạo job idempotent; enqueue và đánh dấu enqueue failure. |
| `services/ads-job-store.service.ts` | Repository + state-transition policy; atomic idempotency race handling và checkpoint persistence. |
| `services/ads-workflow-executor.service.ts` | Worker orchestration: sync pagination tối đa 100 trang; publish validate → dependency steps → checkpoint → reconcile; resume không cho đổi draft hash. |

## 6. Queue

| File | Chức năng |
|---|---|
| `queues/constants.ts` | Tên queue và payload `{ jobId }` dùng chung producer/consumer. |
| `processors/ads-operation.processor.ts` | BullMQ consumer tối giản; chuyển job DB vào workflow executor. |

DB là source of truth cho state/checkpoint; BullMQ chỉ vận chuyển `jobId`, không mang credential hoặc
toàn bộ draft.

## 7. Provider-common utilities

| File | Chức năng |
|---|---|
| `providers/provider-http.util.ts` | HTTP client có fixed base URL, HTTPS host allowlist, relative path only, timeout, no redirect và normalized provider error. |
| `providers/browser-snapshot.util.ts` | Chặn credential/cookie/DTSG/CSRF/msToken/X-Bogus/API key/raw HTML trong snapshot. |
| `providers/browser-snapshot.util.spec.ts` | Test payload sạch và các forbidden fields lồng nhau. |
| `providers/provider-validation.spec.ts` | Contract test validation Meta/TikTok và capability gate Shopee. |

## 8. Meta provider

| File | Chức năng |
|---|---|
| `providers/meta/meta.types.ts` | Business draft shape và Graph page/ID response tối thiểu. |
| `providers/meta/meta.plugin.ts` | Meta OAuth, `/me/adaccounts`, campaign/insight sync, browser snapshot normalize, validation và publish Campaign → Ad Set → Creative → Ad. Mọi create mặc định `PAUSED`, sau đó reconcile Ad qua Graph API. |

Meta-specific business rules nằm trong plugin; vault, queue, audit và checkpoint không bị copy.

## 9. TikTok provider

| File | Chức năng |
|---|---|
| `providers/tiktok/tiktok.types.ts` | TikTok campaign/ad group/ad draft và response envelope. |
| `providers/tiktok/tiktok.plugin.ts` | Marketing API OAuth, advertiser discovery, campaign/report pagination, validation và publish Campaign → Ad Group → Ad. Create mặc định `DISABLE`, dùng `Access-Token` server-side và reconcile bằng `/ad/get/`. |

## 10. Shopee provider

| File | Chức năng |
|---|---|
| `providers/shopee/shopee.types.ts` | Draft campaign/product/budget dành cho contract partner. |
| `providers/shopee/shopee.plugin.ts` | Browser snapshot luôn khả dụng; partner discovery/sync chỉ bật bằng partner flag; publish chỉ bật thêm bằng publish flag. Host/path/ID field/status đều cấu hình theo contract. |

Shopee plugin hiện là adapter contract-driven, không phải tuyên bố tương thích mọi Shopee Open Platform
app. Nếu partner yêu cầu HMAC/Partner Key signing thay bearer OAuth, file này phải có signer tương ứng
và contract test trước khi bật publish.

## 11. Shared library ngoài module

| File | Chức năng |
|---|---|
| `libs/ads-contracts/src/provider.ts` | Provider enum, capability, canonical-source manifest. |
| `libs/ads-contracts/src/operation.ts` | Operation states/context/error/result. |
| `libs/ads-contracts/src/snapshot.ts` | Provenance, confidence, completeness và snapshot envelope. |
| `libs/ads-contracts/src/workflow.ts` | Connection/discovery/sync/publish/browser ports và checkpoint step contract. |
| `libs/ads-contracts/src/index.ts` | Public exports. |

## 12. Luồng thực thi chính

```text
Frontend
  → OAuth start
  → provider consent
  → OAuth callback/state consume
  → encrypted connection
  → account discovery
  → create sync/publish job
  → BullMQ {jobId}
  → worker loads DB job
  → provider validate/execute step
  → save checkpoint after each external ID
  → reconcile
  → terminal job + audit + authoritative snapshot
```

Extension đi theo nhánh riêng: authenticated web user issue extension session → extension giữ token trong
session storage → observer gửi credential-free snapshot → extension guard → account ownership →
supplemental snapshot. Nhánh này không thể publish.
