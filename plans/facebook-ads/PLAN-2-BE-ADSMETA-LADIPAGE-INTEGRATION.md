# Plan 2 — Backend Facebook Ads chặt chẽ với AdsMeta, extension và LadiPage FE

> Trạng thái: kế hoạch triển khai, chưa code  
> Cập nhật: 2026-08-01  
> Backend đích: `D:\monorepo-project-workspace\liora-monorepo\apps\ladipage-backend`  
> Frontend tích hợp: `D:\monorepo-project-workspace\ladipage-fe-v2`

## Nguồn đối chiếu

- `plans/facebook-ads/PLAN-BE.md`, `PLAN-FE.md` và `REPORT-FE-MOCK.md`.
- `plans/extentions/facebook-ads-extension-pilot-plan.md`.
- Nền tảng thật trong `apps/ladipage-backend`: App/Worker module, BullMQ config, `TenantScopedService`, AI SEO module và contract tests.
- `extension marketing seo và ads/AdsMeta — Facebook Ads Manager`: MAIN/isolated bridge, session/context, normalization, overlay và remote capability patterns.
- `extensionpromax`: iframe mini-app, origin/path allowlist, side panel và extension build.
- `ladipage-fe-v2/src/features/facebook-ads`: UI state, mock services và các đường direct Graph/token cần migration.
- Phân tích cuộc chat AdsMeta đã cung cấp: official Meta OAuth là canonical production path; action-ticket chỉ dành cho browser-only capability đã duyệt.

## 1. Mục tiêu

Xây dựng backend Facebook Ads production-grade cho LadiPage bằng Meta OAuth và Marketing API chính thức; đồng thời chọn lọc các pattern tốt từ:

- `extension marketing seo và ads/AdsMeta — Facebook Ads Manager`;
- extension SEO/ExtensionProMax;
- logic, route, state và service đang có trong `ladipage-fe-v2`;
- nền tảng tenant, auth, BullMQ, TypeORM, Swagger, SSE/Socket và idempotency của `liora-monorepo`.

Backend phải là nguồn sự thật cho connection, quyền, tài sản, campaign hierarchy, insights, draft, publish, rules, report và audit. Extension chỉ bổ sung browser context/snapshot trong phạm vi cho phép; không trở thành nơi cấp credential cho backend.

## 2. Quyết định nền tảng

### 2.1 Hai nguồn dữ liệu, một nguồn sự thật

| Nguồn | Vai trò | Được phép write Meta | Độ tin cậy |
|---|---|---:|---|
| `META_MARKETING_API` | Nguồn chuẩn cho production, sync và publish | Có, qua worker | Canonical |
| `BROWSER_EXTENSION` | Context tab, account đang mở, snapshot/diagnostic đã chuẩn hóa | Không ở MVP; action ticket ở giai đoạn sau | Supplemental |
| `DEV_FIXTURE` | Test/dev preview | Không | Non-production |

Không merge dữ liệu âm thầm. Mọi snapshot/projection có `source`, `observedAt`, `syncedAt`, `staleAt`, `connectionId`, `adAccountId`, `apiVersion` và `confidence` khi cần.

### 2.2 Ba loại phiên độc lập

1. **LadiPage user session:** xác thực người dùng, tenant/workspace, RBAC và entitlement.
2. **Meta OAuth connection:** backend-only credential để gọi Marketing API.
3. **Extension device/embed session:** xác thực instance extension và iframe; không chứa Meta token.

UI phải hiển thị ba trạng thái này tách biệt. “Đã đăng nhập Facebook trên tab” không đồng nghĩa “LadiPage đã có Meta OAuth connection hợp lệ”.

### 2.3 Pattern lấy từ AdsMeta, không bê nguyên logic

| Pattern tham khảo | Áp dụng | Không áp dụng |
|---|---|---|
| MAIN world ↔ isolated world | Tách executor/DOM observer khỏi extension UI | Đẩy raw token/DTSG ra web |
| Account switch detection | Tạo browser context event có debounce/version | Tự đổi ad account backend không xác nhận |
| Typed action/message | Contract version hóa, allowlist command | `FB_FETCH` hoặc `GQL_IN_TAB` tùy ý |
| Overlay/route observer | Read-only overlay và context snapshot | Scrape DOM làm nguồn campaign canonical |
| Remote config/kill switch | Capability flag theo version/tenant/action | Remote code hoặc URL/body/header tùy ý |
| Normalize response/error | Error taxonomy và remediation thống nhất | Che mất raw error cần lưu bảo mật trong audit |

Các pattern bị cấm: token lấy từ `window.__accessToken`, cookie Facebook, DTSG/private GraphQL, long-lived token trong `chrome.storage.local`, headless service-worker token fetch và cầu nối dashboard nhận generic request.

## 3. Kiến trúc đích

```text
ladipage-fe-v2 / Next.js BFF
                │ LadiPage JWT + tenant + idempotency key
                ▼
        FacebookAds API Module (NestJS)
        ├─ connection + OAuth
        ├─ asset/catalog sync
        ├─ manager projections + insights
        ├─ draft + validation
        ├─ publish/action orchestration
        ├─ reports/rules/policy
        ├─ extension session/snapshot/tickets
        └─ audit + capability policy
                │
        PostgreSQL + Redis/BullMQ
                │
        FacebookAds Worker
        ├─ Meta Marketing API adapter (canonical)
        ├─ sync/reconciliation
        ├─ publish state machine
        ├─ safe mutation executor
        └─ webhook reconciliation

extensionpromax
├─ iframe mini-app (ladipage-fe-v2)
├─ typed context bridge
├─ browser-only executor (future, allowlist)
└─ overlay/read-only snapshot
```

## 4. Bám vào nền tảng hiện có của liora-monorepo

Không dựng hạ tầng riêng cho Facebook Ads:

- Auth/RBAC: dùng global `JwtAuthGuard`, `RbacGuard` và `TenantGuard`.
- Tenant isolation: service kế thừa `TenantScopedService`, mọi index/query có `tenant_id`.
- Queue: dùng `BullMqModule`, API process chỉ enqueue; worker process tiêu thụ khi tách worker.
- Idempotency: dùng `IdempotenceInterceptor` cho request và business idempotency riêng cho publish/action.
- Realtime: dùng SSE làm đường chuẩn cho job events; polling là fallback, Socket chỉ khi thật sự cần.
- Contract: DTO class-validator + Swagger/OpenAPI; FE generate/use shared API types, không tự viết type lệch.
- Database: TypeORM entity và migration trong `libs/database/src/migrations` theo prefix `lp_facebook_ads_*`.
- Observability: correlation ID xuyên API → queue → Meta request → audit event.

## 5. Module và source tree đề xuất

```text
apps/ladipage-backend/src/modules/facebook-ads/
├─ facebook-ads.module.ts
├─ facebook-ads-worker.module.ts
├─ controllers/
│  ├─ connections.controller.ts
│  ├─ assets.controller.ts
│  ├─ manager.controller.ts
│  ├─ drafts.controller.ts
│  ├─ publish-jobs.controller.ts
│  ├─ actions.controller.ts
│  ├─ reports.controller.ts
│  ├─ rules.controller.ts
│  ├─ webhooks.controller.ts
│  └─ extension.controller.ts
├─ dto/
├─ entities/
├─ mappers/
├─ policies/
├─ ports/
│  ├─ meta-ads.port.ts
│  ├─ credential-vault.port.ts
│  └─ extension-context.port.ts
├─ adapters/meta/
│  ├─ meta-oauth.client.ts
│  ├─ meta-marketing-api.client.ts
│  ├─ meta-error.normalizer.ts
│  └─ meta-version.policy.ts
├─ services/
│  ├─ connection.service.ts
│  ├─ asset-sync.service.ts
│  ├─ manager-query.service.ts
│  ├─ insights.service.ts
│  ├─ draft.service.ts
│  ├─ validation.service.ts
│  ├─ publish.service.ts
│  ├─ action.service.ts
│  ├─ capability-policy.service.ts
│  ├─ reconciliation.service.ts
│  └─ audit.service.ts
├─ queues/
│  ├─ constants.ts
│  └─ payloads.ts
└─ processors/
   ├─ asset-sync.processor.ts
   ├─ insights-sync.processor.ts
   ├─ publish.processor.ts
   ├─ action.processor.ts
   └─ reconcile.processor.ts

libs/api-types/src/facebook-ads.ts
```

Extension auth/device lifecycle có thể tách thành module `extension`; riêng snapshot/ticket có liên hệ trực tiếp Facebook Ads vẫn nằm sau facade/policy của `facebook-ads` để không tạo hai nguồn quyền.

## 6. Mô hình dữ liệu

### 6.1 Bảng lõi

| Bảng | Dữ liệu chính | Constraint/index bắt buộc |
|---|---|---|
| `lp_facebook_ads_connection` | tenant, owner, Meta user/app, scopes, status, expiry | unique `(tenant_id, meta_user_id, app_id)` |
| `lp_facebook_ads_secret` | ciphertext, key version, token metadata | 1:1 connection; không expose qua ORM mapper |
| `lp_facebook_ads_ad_account` | account, BM, currency, timezone, status, permissions | unique `(tenant_id, connection_id, external_id)` |
| `lp_facebook_ads_page` | page metadata và permission snapshot | unique theo connection/external ID |
| `lp_facebook_ads_asset` | IG/pixel/dataset/audience/custom conversion | `(tenant_id, account_id, type, external_id)` |
| `lp_facebook_ads_campaign` | canonical campaign projection | `(tenant_id, account_id, external_id)` |
| `lp_facebook_ads_adset` | ad set projection, campaign FK | external unique + hierarchy index |
| `lp_facebook_ads_ad` | ad/creative projection, ad set FK | external unique + hierarchy index |
| `lp_facebook_ads_insight_daily` | level/entity/date/breakdown/metrics | composite unique theo dimension hash |
| `lp_facebook_ads_draft` | versioned canonical draft JSONB | tenant/account/revision/status |
| `lp_facebook_ads_publish_job` | state, checkpoint, idempotency, result | unique `(tenant_id, idempotency_key)` |
| `lp_facebook_ads_job_event` | append-only timeline | `(job_id, sequence)` unique |
| `lp_facebook_ads_action_job` | pause/resume/budget/rename/duplicate | idempotency + per-entity result |
| `lp_facebook_ads_sync_cursor` | cursor/watermark/last success | unique theo resource scope |
| `lp_facebook_ads_browser_snapshot` | normalized extension context | TTL, source, device/session, account |
| `lp_facebook_ads_action_ticket` | one-time typed browser ticket | hashed token, expiry, consumed_at |
| `lp_facebook_ads_audit_event` | actor, target, before/after, outcome | tenant/time/action indexes |

### 6.2 Quy tắc dữ liệu

- External Meta ID lưu dạng string, không ép number.
- Tiền lưu minor unit hoặc decimal có currency rõ ràng; không dùng floating point.
- Timezone lấy từ ad account và được lưu cùng schedule/rule.
- Mọi JSONB có `schemaVersion`; dữ liệu cần query/filter phải có column riêng.
- Soft delete/disconnect không xóa audit hoặc publish history.
- Token chỉ tồn tại dạng encrypted-at-rest; plaintext chỉ nằm ngắn hạn trong memory của backend/worker.
- Browser snapshot có TTL ngắn và không được dùng để publish.

## 7. API contract với ladipage-fe-v2

Prefix chuẩn: `/api/facebook-ads`.

### 7.1 Bootstrap và connection

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/bootstrap` | workspace capability, connection summary, selected account, flags |
| `POST` | `/connections/oauth/start` | tạo state/PKCE flow và URL OAuth |
| `GET` | `/connections/oauth/callback` | verify state, exchange code, lưu vault |
| `GET` | `/connections` | danh sách trạng thái connection đã redact |
| `POST` | `/connections/:id/reauthorize` | tạo flow cấp lại quyền |
| `DELETE` | `/connections/:id` | revoke/disconnect có audit |
| `GET` | `/connections/:id/permissions` | granted/missing/expired scopes |

OAuth callback không đi qua iframe nếu cookie/browser policy không đảm bảo; mở tab bảo mật, hoàn tất rồi trả one-time result về session LadiPage. Do backend hiện dùng global `JwtAuthGuard`, callback là public endpoint có chủ đích và chỉ được miễn JWT sau khi có guard riêng kiểm tra state/nonce một lần, TTL, redirect binding và replay. Các endpoint connection còn lại vẫn yêu cầu LadiPage JWT + tenant guard.

### 7.2 Assets và manager

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/ad-accounts` | ad account được phép cho tenant/user |
| `POST` | `/ad-accounts/:id/sync` | enqueue sync, không giữ HTTP chờ Meta |
| `GET` | `/ad-accounts/:id/assets` | page/IG/pixel/audience/media theo type |
| `GET` | `/ad-accounts/:id/manager` | hierarchy/projection theo level/filter/cursor |
| `GET` | `/ad-accounts/:id/insights` | metrics/date/breakdown/attribution |
| `GET` | `/ad-accounts/:id/sync-status` | freshness/cursor/error cuối |
| `GET` | `/entities/:level/:id` | chi tiết entity đã authorize |

List response dùng cursor ổn định, không offset với account lớn. Payload có `data`, `pageInfo`, `freshness`, `partialErrors`, `requestId`.

### 7.3 Draft, validate và publish

| Method | Endpoint | Mục đích |
|---|---|---|
| `POST` | `/drafts` | tạo draft canonical |
| `GET` | `/drafts/:id` | lấy draft + revision |
| `PATCH` | `/drafts/:id` | update với `If-Match`/revision |
| `POST` | `/drafts/:id/validate` | validation local + capability + optional Meta preflight |
| `POST` | `/drafts/:id/publish` | tạo publish job idempotent |
| `GET` | `/publish-jobs/:id` | trạng thái/checkpoint/result |
| `GET` | `/publish-jobs/:id/events` | SSE timeline, polling fallback |
| `POST` | `/publish-jobs/:id/retry` | retry từ checkpoint an toàn |
| `POST` | `/publish-jobs/:id/cancel` | best-effort nếu chưa qua irreversible step |

### 7.4 Safe actions

- `POST /actions/status`
- `POST /actions/budget`
- `POST /actions/rename`
- `POST /actions/duplicate`
- `GET /action-jobs/:id`

Mỗi action nhận typed payload, `Idempotency-Key`, `expectedVersion` và `reason`; backend trả kết quả từng entity. Không có endpoint kiểu `/proxy`, `/fetch`, `/graphql` hoặc `/execute` nhận lệnh tùy ý.

## 8. Mapping chặt với state FE

| FE hiện có | Backend contract cần thay mock | Ghi chú migration |
|---|---|---|
| Account/BM/Page services | `/connections`, `/ad-accounts`, `/assets` | Giữ UI model qua mapper tạm thời |
| `AdsManagerPage` mock hierarchy | `/manager` + `/insights` | Cursor và freshness bắt buộc |
| Wizard local state | `/drafts` + `/validate` | Backend draft là source of truth |
| Publish giả | `/drafts/:id/publish` + job events | Không set timeout giả |
| Permissions bulk timer | typed action job | Per-item outcome, audit |
| Reports local | report definition + async export | Reuse insight query grammar |
| Rules local | rule CRUD/evaluate/history | Không chạy rule trong FE |
| Settings claim “no token” | connection status đã redact | Xóa IndexedDB token implementation |
| `facebook-api.client.ts` | Next BFF/LadiPage API client | Cấm direct Graph request |

FE và BE thống nhất enum: connection status, entity status, effective status, job state, validation severity, source provenance, action outcome và normalized error code. Không map bằng string tự phát trong component.

## 9. Meta OAuth và credential vault

### 9.1 Flow

1. FE yêu cầu `/oauth/start` trong tenant hiện tại.
2. Backend tạo state một lần, nonce, requested scopes, return target allowlisted và expiry.
3. Người dùng authorize trên Meta.
4. Callback verify state/nonce/app/redirect URI, exchange code server-to-server.
5. Backend lấy metadata/scopes, mã hóa token, tạo connection và enqueue initial sync.
6. FE chỉ nhận connection ID/status/scope summary; không nhận token.

### 9.2 Vault

- Envelope encryption, key version và rotation plan.
- Chỉ Meta adapter trong API/worker được decrypt.
- Redaction ở logger, exception, tracing và audit payload.
- Revoke token khi disconnect nếu Meta hỗ trợ; vẫn xóa khả năng decrypt local.
- Cảnh báo trước expiry, reauthorize state và sync suspension rõ ràng.
- App secret/config nằm ở secret manager/env bảo mật, không ở DB hoặc FE.

## 10. Sync, webhook và reconciliation

### 10.1 Sync strategy

- Initial sync: connection → businesses/ad accounts → assets → campaign hierarchy → recent insights.
- Incremental sync theo cursor/watermark; ưu tiên entity được người dùng đang xem.
- Insights partition theo account/level/date/breakdown để tránh payload lớn.
- Scheduler làm background refresh; user-triggered refresh chỉ enqueue và có cooldown.
- Redis lock theo connection/account/resource để chống sync trùng.
- Rate-limit budget theo Meta app + tenant + ad account; backoff có jitter và respect retry hints.

### 10.2 Webhook

- Verify signature/challenge, lưu event envelope tối thiểu và dedupe event.
- Webhook là tín hiệu cần reconcile, không phải dữ liệu canonical cuối cùng.
- Worker fetch lại entity qua Marketing API trước khi cập nhật projection.
- Event out-of-order được xử lý bằng observed time/version và fetch-latest.

### 10.3 Freshness policy

| Dữ liệu | Fresh | Stale-but-usable | Hành động |
|---|---:|---:|---|
| Connection/scopes | 5 phút | 30 phút | refresh trước mutation |
| Campaign hierarchy | 2 phút | 15 phút | background sync |
| Daily insights | 15 phút | 2 giờ | hiển thị timestamp |
| Assets | 15 phút | 24 giờ | refresh khi mở picker |
| Browser snapshot | 30 giây | 2 phút | không dùng publish |

Các giá trị là baseline, hiệu chỉnh bằng telemetry và Meta rate limit.

## 11. Draft và validation pipeline

Validation có bốn lớp và trả lỗi theo JSON Pointer/field path để FE focus đúng control:

1. **Schema:** type, required, range, money, schedule.
2. **Cross-field:** objective/conversion/optimization/placement/budget compatibility.
3. **Capability:** scope, account role, asset ownership, entitlement/quota, policy flag.
4. **Meta preflight:** asset existence/effective status và API validation có thể thực hiện an toàn.

Response mẫu logic:

```text
valid: false
revision: 12
issues[]:
  code, severity, path, message, remediation, source
warningsRequireAck[]
resolvedAssets[]: id, type, name, source, observedAt
```

Không publish từ payload UI trực tiếp. Publish luôn lấy snapshot draft theo `revision` đã validate và lưu `draftHash` trong job.

## 12. Publish state machine

### 12.1 Trạng thái job

```text
QUEUED
  -> VALIDATING
  -> CREATING_CAMPAIGN_PAUSED
  -> CREATING_ADSET_PAUSED
  -> UPLOADING_MEDIA
  -> CREATING_CREATIVE
  -> CREATING_AD_PAUSED
  -> VERIFYING
  -> SUCCEEDED_PAUSED

Mỗi bước có thể -> RETRY_WAIT -> bước hiện tại
                 -> NEEDS_USER_ACTION
                 -> FAILED
                 -> CANCELLED (nếu còn an toàn)
```

### 12.2 Bảo đảm

- Campaign, Ad Set và Ad mới tạo ở `PAUSED`; activate là action riêng.
- Idempotency ở API, job và từng external create step.
- Sau mỗi external success, lưu checkpoint/external ID trước khi sang bước tiếp.
- Retry kiểm tra checkpoint và query Meta trước khi tạo lại.
- Không hứa transaction cross-system. Dùng saga/compensation guide và audit.
- Partial resources được hiển thị cho người dùng với link/remediation; không tự xóa nếu có rủi ro.
- Job giữ immutable input snapshot, actor, tenant, connection, account, API version và policy version.

## 13. Extension bridge và action ticket

### 13.1 MVP read-only

Extension được phép gửi typed event:

- `FACEBOOK_CONTEXT_CHANGED`
- `FACEBOOK_ACCOUNT_OBSERVED`
- `FACEBOOK_ROUTE_CHANGED`
- `FACEBOOK_SESSION_AVAILABLE` — boolean/metadata, không credential
- `FACEBOOK_OVERLAY_HEALTH`

Backend nhận snapshot đã normalize, kiểm tra device/embed session, origin, schema version, account binding và TTL. FE dùng snapshot để gợi ý context hoặc cảnh báo mismatch; không tự chuyển account canonical.

### 13.2 Write qua browser executor — chỉ sau pilot

Chỉ dùng khi API chính thức không cung cấp capability cần thiết và đã qua security review. Flow:

1. FE tạo yêu cầu typed action tới backend.
2. Backend authorize tenant/user/account, quota, policy và risk.
3. Backend phát ticket một lần: command allowlisted, target IDs, payload hash, nonce, expiry ngắn, extension instance và confirmation requirement.
4. Extension verify chữ ký/binding rồi thực thi command cụ thể.
5. Extension trả normalized result không kèm credential.
6. Backend consume ticket đúng một lần, audit và reconcile qua nguồn chính thức khi có thể.

Thứ tự mở capability: rename → pause/resume → budget → duplicate → creation. BM/permission action là track riêng, không gộp vào MVP.

## 14. Capability policy và kill switch

Policy key tối thiểu:

```text
tenantId + userRole + plan + connectionStatus + grantedScopes
+ adAccountRole + action + entityType + surface + extensionVersion
+ backendPolicyVersion
```

Kết quả policy: `allowed`, `reasonCode`, `requiredConfirmation`, `limit`, `fallback`, `remediation`.

Kill switch hỗ trợ:

- toàn feature;
- Meta API version/adapter;
- connection hoặc ad account;
- action type;
- extension version;
- tenant cohort.

Kill switch chỉ vô hiệu capability; không tải hoặc thực thi remote code.

## 15. Error taxonomy

Chuẩn hóa lỗi để FE không phụ thuộc message Meta:

- `AUTH_REAUTH_REQUIRED`
- `AUTH_SCOPE_MISSING`
- `TENANT_ACCESS_DENIED`
- `ACCOUNT_PERMISSION_MISSING`
- `ACCOUNT_DISABLED`
- `ASSET_NOT_FOUND_OR_INACCESSIBLE`
- `VALIDATION_OBJECTIVE_INCOMPATIBLE`
- `RATE_LIMITED`
- `META_TRANSIENT_ERROR`
- `META_POLICY_REJECTED`
- `CONFLICT_REVISION`
- `CONTEXT_ACCOUNT_MISMATCH`
- `EXTENSION_VERSION_UNSUPPORTED`
- `JOB_PARTIAL_FAILURE`
- `INTERNAL_RETRYABLE`

Public response có normalized code, safe message, retryability, remediation, field path, request ID. Raw Meta error/subcode/request trace chỉ lưu encrypted/redacted trong operational log/audit theo retention.

## 16. Security và compliance checklist

- Tenant guard ở controller và tenant filter ở mọi repository query.
- Kiểm tra ownership: tenant → connection → ad account → entity, không chỉ tin external ID.
- OAuth state/nonce one-time, TTL, redirect allowlist và PKCE nếu flow hỗ trợ.
- Secret encryption, rotation, revoke và không serialize entity secret.
- CSRF/origin checks cho cookie-based Next BFF và callback flow.
- Rate limit riêng cho auth, sync, publish, action ticket và export.
- SSRF guard: Meta client có fixed base URL/version/path builder, không nhận absolute URL.
- DTO whitelist/forbid unknown field và giới hạn batch/page/date range/breakdown.
- Audit immutable cho connect/disconnect/publish/activate/budget/permission.
- Không log creative body, targeting chi tiết hoặc PII nếu không cần.
- Data retention cho insights, snapshots, job payload và raw errors được định nghĩa trước launch.
- Dependency/API-version review khi Meta đổi Marketing API.

## 17. Observability và SLO

### 17.1 Metrics

- OAuth success/failure/reauthorize rate.
- Meta requests theo endpoint/code/subcode, latency và rate-limit consumption.
- Sync lag, entities synced, partial failures và stale account count.
- Queue depth/age/retry/dead-letter theo processor.
- Publish success, median/p95 duration, failure theo step và orphan resource count.
- Draft validation error theo code/path.
- Extension handshake/context mismatch/ticket issue-consume-fail.
- FE BFF cache hit và backend request correlation.

### 17.2 SLO ban đầu

- API projection read availability: 99.9%.
- 95% manager read từ projection dưới 800 ms, không tính initial sync.
- 95% user-triggered sync được enqueue dưới 500 ms.
- 95% publish job bắt đầu xử lý dưới 60 giây khi queue khỏe.
- 100% publish/action có audit event và correlation ID.
- Không có credential Meta trong log/trace/FE response: zero tolerance.

## 18. Test strategy

| Lớp | Nội dung |
|---|---|
| Unit | mapper, money/timezone, error normalizer, permission/capability, state transition |
| Repository | tenant isolation, unique/idempotency, cursor, migration up/down |
| Contract | OpenAPI fixtures tương thích `ladipage-fe-v2`; enum/error schema |
| Adapter | Meta API mocked theo version, pagination, rate limit, partial error |
| Queue | retry/checkpoint/dedup/dead-letter, worker restart giữa bước |
| OAuth | state replay, wrong tenant, scope missing, disconnect/revoke |
| Publish integration | success, each-step failure, timeout-after-create, resume, partial resource |
| Extension | signed snapshot, expired/replayed ticket, account mismatch, unsupported version |
| Security | IDOR cross-tenant, SSRF, mass assignment, token/log leakage, CSRF |
| E2E | FE web/iframe → BFF → Nest → queue → Meta sandbox/mock → SSE |

## 19. Lộ trình triển khai

### BE-0 — Contract, threat model và migration khỏi client Graph (4–6 ngày)

- ADR chốt canonical Meta OAuth và vai trò supplemental của extension.
- Inventory toàn bộ request Graph/token/cookie trong FE/AdsMeta.
- Shared enums, error envelope, provenance, pagination và capability contract.
- Feature flag chặn direct Graph/client credential path.
- Thiết kế schema/migration và secret vault abstraction.

**Gate:** không còn endpoint/contract generic; threat model được review.

### BE-1 — Connection/OAuth/token vault (6–9 ngày)

- OAuth start/callback/reauthorize/disconnect.
- Encrypted secret storage, scope inspection, connection status.
- Tenant/RBAC/entitlement và audit.
- Bootstrap API cho Plan 1.

**Gate:** FE kết nối được mà browser không nhìn thấy token.

### BE-2 — Assets, hierarchy và sync projection (8–12 ngày)

- Meta adapter versioned, error normalizer, rate-limit coordinator.
- Initial/incremental sync, cursor, locks và freshness.
- Ad account/Page/IG/pixel/audience/campaign/adset/ad projection.
- Manager/assets APIs và SSE/poll sync status.

**Gate:** Ads Manager read-only thay mock hoàn toàn cho một account pilot.

### BE-3 — Insights, reports foundation (6–9 ngày)

- Insights query grammar allowlisted, daily fact table và breakdown guard.
- Summary/compare API, async export foundation.
- Saved view/report schema nếu P1 yêu cầu.

**Gate:** số liệu đối soát với Meta UI trong tolerance/attribution đã ghi rõ.

### BE-4 — Draft và validation (7–10 ngày)

- Draft CRUD/revision/conflict, schema version và autosave contract.
- Validation bốn lớp, asset resolution và readiness.
- Freeze validated draft snapshot/hash.

**Gate:** wizard FE không còn source-of-truth local.

### BE-5 — Publish queue/state machine (10–15 ngày)

- Worker module, checkpoint/idempotency/saga.
- Campaign → Ad Set → media/creative → Ad ở PAUSED.
- SSE timeline, retry/resume/cancel và audit.
- Chaos tests tại mọi external boundary.

**Gate:** restart worker/network timeout không tạo duplicate ngoài kiểm soát.

### BE-6 — Safe actions và reconciliation (7–10 ngày)

- Status, budget, rename, duplicate với per-item result.
- Webhook signal + fetch-latest reconciliation.
- Account quality/policy read models và activity feed.

**Gate:** activate là action riêng có confirmation và audit.

### BE-7 — Extension pilot read-only (6–9 ngày)

- Device/embed session, versioned bridge contract và signed snapshots.
- Account/route/session context, TTL, mismatch warning.
- Remote capability flags/kill switch, telemetry và store review checklist.

**Gate:** extension không gửi credential và không làm thay đổi Meta.

### BE-8 — Rules/reports/extension write (sau MVP, theo nhu cầu)

- Rule scheduler/evaluator/history và scheduled reports.
- Action ticket one-time cho capability browser-only đã được duyệt.
- Mở từng command theo cohort, kill switch và security review riêng.

## 20. Cutover/rollout

1. **Shadow read:** sync backend song song, FE vẫn mock nhưng đối soát dữ liệu nội bộ.
2. **Pilot read-only:** một số tenant/account dùng manager/assets thật.
3. **Draft live:** backend draft thật, publish vẫn disabled.
4. **Publish sandbox/pilot:** allowlist tenant, PAUSED only, manual monitoring.
5. **Actions pilot:** pause/resume rồi budget/rename; bulk giới hạn nhỏ.
6. **General availability:** tăng cohort theo SLO, error rate và Meta review.
7. **Extension read-only:** bật sau khi web/backend ổn định; browser write là rollout riêng.

Rollback luôn bằng capability flag; dữ liệu/job đã tạo không bị xóa. Worker phải drain/pause có kiểm soát và job đang chạy tiếp tục đọc policy snapshot phù hợp.

## 21. Rủi ro và kiểm soát

| Rủi ro | Kiểm soát |
|---|---|
| Meta API/version thay đổi | Version adapter, contract tests, deprecation calendar |
| Rate limit toàn app | Budget coordinator, cache/projection, queue priority, backoff jitter |
| Duplicate khi timeout | Idempotency, checkpoint trước bước tiếp, fetch-before-retry |
| Cross-tenant IDOR | TenantGuard + repository scope + ownership chain tests |
| Extension bị khai thác thành proxy | Typed command, allowlist, signed one-time ticket, no generic request |
| Snapshot lệch nguồn chính | Provenance/TTL; warning mismatch; canonical API wins |
| OAuth/token leak | Vault, redaction, no FE response, zero-tolerance security tests |
| FE/BE contract drift | OpenAPI/shared types, consumer-driven contract CI |
| Publish partial | Saga state, PAUSED default, visible remediation/audit |
| Backend quá tải bởi UI polling | Projection, ETag, SSE, adaptive refetch và rate-limit theo route |

## 22. Definition of Done Plan 2

- Meta OAuth/token vault hoạt động server-side; FE và extension không nhận raw credential.
- Ad account/assets/hierarchy/insights được sync và truy vấn tenant-safe với freshness/provenance.
- Toàn bộ mock P0 trong `ladipage-fe-v2` có API contract thay thế rõ ràng.
- Draft có revision, validation bốn lớp và canonical snapshot.
- Publish chạy BullMQ theo state machine, idempotent, checkpointed và mặc định `PAUSED`.
- Safe actions có per-entity result, confirm policy, audit và reconciliation.
- Error taxonomy, metrics, correlation ID, kill switch và SLO có dashboard/runbook.
- Extension MVP chỉ gửi typed context/snapshot, không token/cookie/private GraphQL.
- Bất kỳ browser write action nào cũng phải qua allowlist + signed one-time ticket + rollout riêng.
- Security, contract, queue chaos và E2E tests đạt gate trước khi general availability.
