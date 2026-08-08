# ADR-002: Credential and browser boundaries

Status: accepted, implemented foundation (2026-08-08)

Provider access tokens are exchanged and encrypted in the backend. AES-256-GCM ciphertext is bound
to its connection ID as authenticated data. OAuth state is random, hashed at rest, expires after ten
minutes and is consumed under a database lock to prevent replay races.

The extension may send only versioned supplemental context. Both extension and backend reject fields
matching credentials, cookies, CSRF/DTSG, TikTok signing/session material, secrets, API keys and raw
HTML. The extension validates the sender tab against a provider allowlist and posts only to the fixed
`/api/ads-platform/extension/snapshots` path. Its backend credential exists in session storage and can
only be configured by an extension page, not a content tab.

Shopee write access is not inferred from an authenticated Seller Centre tab. It requires an approved
partner API, explicit host/path configuration and separate publish enablement.

