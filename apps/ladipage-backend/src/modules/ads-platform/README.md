# Ads Platform module

Reusable orchestration shell for Meta Ads, TikTok Ads and an approved Shopee Ads partner API.
The backend owns OAuth credentials, tenant authorization, canonical synchronization and publish
operations. Browser extension snapshots are supplemental only and can never be used as publish
credentials.

## Runtime prerequisites

- Apply migration `1762000000000-ads-platform-core`.
- Enable API queueing and the worker with the existing BullMQ configuration.
- Assign the new `ads:*` permissions to the intended roles; the migration creates permissions but
  deliberately does not broaden any role automatically.
- Generate a vault key with `openssl rand -base64 32` and keep it in a secret manager.

Core configuration:

```dotenv
ADS_VAULT_MASTER_KEY=<32-byte-base64-secret>
ADS_VAULT_KEY_VERSION=v1
ADS_OAUTH_RETURN_ORIGINS=https://app.example.com
ADS_EXTENSION_SESSION_TTL_SECONDS=600
BULLMQ_ENABLED=true
BULLMQ_RUN_WORKERS=true
```

Meta:

```dotenv
META_APP_ID=
META_APP_SECRET=
META_API_VERSION=vXX.X
META_REDIRECT_URI=https://api.example.com/api/ads-platform/connections/meta/oauth/callback
META_ADS_SCOPES=ads_management,ads_read,business_management,pages_read_engagement
```

TikTok:

```dotenv
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_API_VERSION=vX.X
TIKTOK_API_BASE_URL=https://business-api.tiktok.com/open_api/vX.X
TIKTOK_AUTH_URL=https://business-api.tiktok.com/portal/auth
TIKTOK_REDIRECT_URI=https://api.example.com/api/ads-platform/connections/tiktok/oauth/callback
```

Shopee is disabled by default. Enable it only for an approved partner contract whose paths and
response schema match the configured adapter:

```dotenv
SHOPEE_ADS_PARTNER_ENABLED=false
SHOPEE_ADS_PUBLISH_ENABLED=false
SHOPEE_ADS_ALLOWED_HOSTS=partner-api.example.com
SHOPEE_ADS_API_BASE_URL=https://partner-api.example.com/v1
SHOPEE_ADS_API_VERSION=v1
SHOPEE_ADS_AUTH_URL=https://partner-api.example.com/oauth/authorize
SHOPEE_ADS_TOKEN_PATH=/oauth/token
SHOPEE_ADS_CLIENT_ID=
SHOPEE_ADS_CLIENT_SECRET=
SHOPEE_ADS_REDIRECT_URI=https://api.example.com/api/ads-platform/connections/shopee/oauth/callback
SHOPEE_ADS_EXTERNAL_USER_ID_FIELD=shop_id
SHOPEE_ADS_ACCOUNTS_PATH=/ads/accounts
SHOPEE_ADS_CAMPAIGNS_PATH=/ads/campaigns
SHOPEE_ADS_PERFORMANCE_PATH=/ads/performance
SHOPEE_ADS_CAMPAIGN_CREATE_PATH=/ads/campaigns
SHOPEE_ADS_CAMPAIGN_GET_PATH=/ads/campaigns/{campaignId}
SHOPEE_ADS_CAMPAIGN_ID_FIELD=campaign_id
SHOPEE_ADS_PAUSED_STATUS=PAUSED
```

Do not substitute undocumented Seller Centre endpoints, browser cookies, private GraphQL, DTSG,
`msToken`, `X-Bogus`, or other session material for these partner settings.

## Safe operating sequence

1. `GET /ads-platform/providers` and verify the capability is enabled.
2. `POST /ads-platform/connections/:provider/oauth/start`, navigate to returned `url`, then let the
   provider return to the public one-time callback.
3. `POST /ads-platform/connections/:connectionId/discover-accounts`.
4. Create a sync job and poll `GET /ads-platform/jobs/:jobId` until terminal.
5. Create a publish job with a stable business idempotency key and immutable `revision`/`draft`.
6. The worker validates and creates resources in dependency order, checkpointing every external ID.
   New campaigns remain `PAUSED`/`DISABLE`; activation is intentionally a separate future action.

The API process must not run live publishing unless a worker is enabled and provider sandbox/pilot
credentials have been verified.

For the extension, an authenticated LadiPage page issues a short-lived, snapshot-only token through
`POST /ads-platform/extension/sessions`. The extension keeps it in `chrome.storage.session`; only that
token is accepted by `POST /ads-platform/extension/snapshots`. It cannot call connection, sync, job or
publish endpoints.
