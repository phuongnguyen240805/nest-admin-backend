# Kế hoạch Backend Facebook Ads

## 1. Mục tiêu

Xây dựng backend chính thức cho Facebook Ads tại:

```text
D:\monorepo-project-workspace\liora-monorepo\apps\ladipage-backend
```

Backend chịu trách nhiệm:

- Meta OAuth và quản lý connection.
- Mã hoá, lưu và làm mới access token.
- Gọi Meta Marketing API.
- Đồng bộ Business Manager, Page, ad account và Pixel.
- Đồng bộ Campaign, Ad Set, Ad, Creative và Insights.
- Lưu campaign draft.
- Validate và publish quảng cáo.
- Job queue, retry, rate limit và idempotency.
- Bulk actions, reports, alerts, scheduled rules và audit log.

Backend không sử dụng:

- Facebook cookie lấy từ trình duyệt.
- `window.__accessToken`.
- Facebook GraphQL nội bộ.
- Cơ chế sửa `Origin` hoặc `Referer`.
- Token do extension trích xuất từ phiên Facebook.

## 2. Cấu trúc module

```text
apps/ladipage-backend/src/modules/facebook-ads/
├── facebook-ads.module.ts
├── connection/
│   ├── meta-connection.controller.ts
│   ├── meta-connection.service.ts
│   ├── meta-oauth.service.ts
│   ├── meta-token-vault.service.ts
│   ├── meta-connection.repository.ts
│   └── dto/
├── accounts/
│   ├── ad-accounts.controller.ts
│   ├── ad-accounts.service.ts
│   ├── business-managers.service.ts
│   ├── fanpages.service.ts
│   ├── pixels.service.ts
│   └── dto/
├── campaigns/
│   ├── campaigns.controller.ts
│   ├── campaigns.service.ts
│   ├── adsets.service.ts
│   ├── ads.service.ts
│   ├── campaign-query.service.ts
│   └── dto/
├── drafts/
│   ├── campaign-drafts.controller.ts
│   ├── campaign-drafts.service.ts
│   ├── campaign-validator.service.ts
│   └── dto/
├── creatives/
│   ├── creatives.controller.ts
│   ├── creatives.service.ts
│   ├── media-upload.service.ts
│   └── dto/
├── audience/
│   ├── audiences.controller.ts
│   ├── audiences.service.ts
│   ├── targeting-search.service.ts
│   └── dto/
├── insights/
│   ├── insights.controller.ts
│   ├── insights.service.ts
│   ├── insights-sync.service.ts
│   ├── metric-calculator.service.ts
│   └── dto/
├── publishing/
│   ├── publishing.controller.ts
│   ├── publishing.service.ts
│   ├── publish.processor.ts
│   ├── publish.queue.ts
│   └── publish-state-machine.ts
├── automation/
│   ├── ads-rules.controller.ts
│   ├── ads-rules.service.ts
│   ├── ads-rules.processor.ts
│   └── rule-evaluator.service.ts
├── reports/
│   ├── ads-reports.controller.ts
│   ├── ads-reports.service.ts
│   └── report-export.service.ts
├── webhooks/
│   ├── meta-webhooks.controller.ts
│   └── meta-webhooks.service.ts
├── meta-api/
│   ├── meta-api.client.ts
│   ├── meta-api-version.service.ts
│   ├── meta-api-errors.ts
│   ├── meta-rate-limit.service.ts
│   └── meta-response.mapper.ts
├── audit/
│   ├── ads-audit.service.ts
│   └── ads-audit.interceptor.ts
└── entities/
    ├── meta-connection.entity.ts
    ├── meta-ad-account.entity.ts
    ├── meta-campaign.entity.ts
    ├── meta-adset.entity.ts
    ├── meta-ad.entity.ts
    ├── meta-creative.entity.ts
    ├── campaign-draft.entity.ts
    ├── insight-snapshot.entity.ts
    ├── publish-job.entity.ts
    ├── ads-rule.entity.ts
    └── ads-audit-log.entity.ts
```

## 3. Database

### 3.1. `meta_connections`

```text
id
organization_id
created_by
meta_user_id
encrypted_access_token
token_expires_at
granted_scopes
status
last_verified_at
created_at
updated_at
```

Yêu cầu:

- Token được mã hoá bằng key từ secret manager/environment.
- Không log token.
- Không đưa token vào API response.
- Mỗi query phải giới hạn theo `organization_id`.

### 3.2. `meta_ad_accounts`

```text
id
organization_id
connection_id
meta_account_id
business_id
name
currency
timezone_name
account_status
disable_reason
spend_cap
last_synced_at
raw_metadata
```

### 3.3. `meta_campaigns`

```text
id
organization_id
ad_account_id
meta_campaign_id
name
objective
status
effective_status
special_ad_categories
daily_budget
lifetime_budget
buying_type
start_time
stop_time
sync_version
last_synced_at
```

### 3.4. `meta_adsets`

```text
id
organization_id
campaign_id
meta_adset_id
name
status
effective_status
daily_budget
lifetime_budget
billing_event
optimization_goal
bid_strategy
targeting
promoted_object
start_time
end_time
last_synced_at
```

### 3.5. `meta_ads`

```text
id
organization_id
adset_id
meta_ad_id
creative_id
name
status
effective_status
review_feedback
issues_info
tracking_specs
last_synced_at
```

### 3.6. `campaign_drafts`

```text
id
organization_id
ad_account_id
created_by
name
current_step
payload_json
validation_errors
status
version
published_job_id
created_at
updated_at
```

### 3.7. `insight_snapshots`

```text
organization_id
ad_account_id
entity_type
entity_id
date_start
date_stop
breakdown_key
impressions
reach
frequency
spend
clicks
inline_link_clicks
results
cost_per_result
revenue
purchase_value
ctr
cpc
cpm
roas
raw_actions
synced_at
```

Tạo unique index theo:

```text
organization_id
entity_type
entity_id
date_start
date_stop
breakdown_key
```

### 3.8. `publish_jobs`

```text
id
organization_id
draft_id
status
current_step
campaign_meta_id
adset_meta_ids
creative_meta_ids
ad_meta_ids
request_id
idempotency_key
error_code
error_message
retry_count
started_at
completed_at
```

## 4. API contract

Prefix:

```text
/api/facebook-ads
```

### 4.1. Connection

```http
GET    /connections
POST   /connections/oauth/start
GET    /connections/oauth/callback
POST   /connections/:id/verify
DELETE /connections/:id
```

### 4.2. Assets

```http
GET  /ad-accounts
POST /ad-accounts/sync
GET  /business-managers
POST /business-managers/sync
GET  /pages
POST /pages/sync
GET  /ad-accounts/:id/pixels
GET  /ad-accounts/:id/custom-audiences
GET  /ad-accounts/:id/instagram-accounts
```

### 4.3. Ads Manager

```http
GET /ad-accounts/:id/campaigns
GET /ad-accounts/:id/adsets
GET /ad-accounts/:id/ads
GET /ad-accounts/:id/insights
GET /ad-accounts/:id/summary
```

List endpoints hỗ trợ:

```text
dateFrom
dateTo
search
status[]
objective[]
campaignId
adsetId
after
limit
sortBy
sortDirection
fields[]
breakdowns[]
```

### 4.4. Draft và publish

```http
POST   /drafts
GET    /drafts
GET    /drafts/:id
PATCH  /drafts/:id
DELETE /drafts/:id
POST   /drafts/:id/validate
POST   /drafts/:id/publish

GET    /publish-jobs/:id
POST   /publish-jobs/:id/retry
POST   /publish-jobs/:id/cancel
```

### 4.5. Actions

```http
POST  /campaigns/:id/status
POST  /adsets/:id/status
POST  /ads/:id/status
POST  /campaigns/bulk-status
POST  /adsets/bulk-status
POST  /ads/bulk-status
POST  /campaigns/:id/duplicate
PATCH /campaigns/:id/budget
PATCH /adsets/:id/budget
```

Mọi mutation phải nhận:

```http
Idempotency-Key: <uuid>
```

## 5. Publish state machine

```text
DRAFT
-> QUEUED
-> VALIDATING
-> CREATING_CAMPAIGN
-> CREATING_ADSETS
-> UPLOADING_MEDIA
-> CREATING_CREATIVES
-> CREATING_ADS
-> SYNCING
-> COMPLETED
```

Trạng thái lỗi:

```text
FAILED_RETRYABLE
FAILED_VALIDATION
FAILED_PERMISSION
FAILED_META_REVIEW
CANCELLED
```

Quy trình:

1. Load draft và kiểm tra organization.
2. Kiểm tra connection và quyền `ads_management`.
3. Validate objective và dependency giữa các field.
4. Kiểm tra Page, Pixel, Instagram và Audience.
5. Kiểm tra currency, budget, timezone và schedule.
6. Tạo Campaign ở trạng thái `PAUSED`.
7. Tạo Ad Set ở trạng thái `PAUSED`.
8. Upload media hoặc tái sử dụng media hash.
9. Tạo Creative.
10. Tạo Ad ở trạng thái `PAUSED`.
11. Lưu toàn bộ Meta ID.
12. Đồng bộ lại từ Meta.
13. Hoàn thành job.

Không tự động xoá tài nguyên đã tạo khi một bước sau bị lỗi. Lưu checkpoint để retry/resume.

## 6. Worker và queue

Queue:

```text
facebook-ads-publish
facebook-ads-sync-assets
facebook-ads-sync-campaigns
facebook-ads-sync-insights
facebook-ads-rule-evaluation
facebook-ads-report-export
facebook-ads-token-health
```

Mỗi job chứa:

```text
organizationId
connectionId
adAccountId
requestId
idempotencyKey
```

Yêu cầu:

- Exponential backoff.
- Phân loại lỗi retryable/non-retryable.
- Lock theo connection/ad account khi publish.
- Rate limit theo connection và ad account.
- Structured log nhưng không log token.
- Dead-letter handling.
- Audit log cho mọi mutation.

## 7. Các phase Backend

### BE-0 — Security foundation

- [ ] Tạo `facebook-ads.module.ts`.
- [ ] Meta OAuth start/callback.
- [ ] Token vault và encryption.
- [ ] Tenant/organization guard.
- [ ] Meta API client.
- [ ] API version từ environment.
- [ ] Error mapper.
- [ ] Audit log.
- [ ] Migration cho connection.

### BE-1 — Read-only

- [ ] Sync ad accounts.
- [ ] Sync BM, Pages, Pixels.
- [ ] Sync Campaign/Ad Set/Ad.
- [ ] Cursor pagination.
- [ ] Cache và incremental sync.
- [ ] Summary và Insights API.

### BE-2 — Draft

- [ ] Draft CRUD.
- [ ] Optimistic version.
- [ ] Objective-specific schemas.
- [ ] Asset validation.
- [ ] Validate endpoint.

### BE-3 — Publish

- [ ] Publish queue.
- [ ] Publish state machine.
- [ ] Media upload.
- [ ] Campaign creation.
- [ ] Ad Set creation.
- [ ] Creative creation.
- [ ] Ad creation.
- [ ] Retry/resume.
- [ ] Reconcile dữ liệu.

### BE-4 — Management

- [ ] Pause/resume.
- [ ] Bulk status.
- [ ] Budget update.
- [ ] Duplicate.
- [ ] Scheduled actions.

### BE-5 — Reports và automation

- [ ] Saved reports.
- [ ] CSV export.
- [ ] Performance alerts.
- [ ] Budget rules.
- [ ] Rule evaluator.
- [ ] Health score.
- [ ] Recommendation engine.

## 8. Kiểm thử Backend

### Unit test

- Token encryption/decryption.
- Objective validation.
- Money unit conversion.
- Meta error mapping.
- Publish state transitions.
- Rule evaluation.

### Integration test

- OAuth callback.
- Tenant isolation.
- Campaign sync/upsert.
- Insights upsert.
- Idempotent publish.
- Retry sau lỗi tạm thời.

### Contract test

- Response types khớp API package.
- Pagination contract.
- Error contract.
- Publish status contract.

### Definition of Done

- Không có cookie/token Meta trong log hoặc response.
- Tất cả query có organization scope.
- Publish lặp lại cùng idempotency key không tạo duplicate.
- Campaign, Ad Set và Ad mặc định là `PAUSED`.
- Có audit log cho mọi mutation.
- Có retry và trạng thái lỗi rõ ràng.
- Có contract test cho endpoint được Frontend sử dụng.

