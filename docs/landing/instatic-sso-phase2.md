# Phase 2 — Ladipage → Instatic SSO

## Flow

```text
Login Ladipage only
  → Browser opens new tab /ladipage?pageId=...
  → POST /api/landing-cms/session (FE BFF → Nest)
  → Nest mints SSO token (TTL 120s, purpose=ladipage-sso, jti one-time)
  → editorUrl = /admin/api/cms/auth/ladipage-sso?token=...  (same origin)
  → Next rewrite /admin/api/* → Instatic CMS :8787
  → Instatic verifies token, Set-Cookie Path=/admin, auto-bootstrap owner if needed
  → 302 → /admin/site
  → Next rewrite /admin/* → Vite :5174 SPA (canvas)
```

## Shared secret

```env
# Nest (liora-monorepo/.env) AND Instatic (.env) — same value
INSTATIC_SSO_SECRET=local-sso-change-me
# Browser-facing origin is Ladipage, NOT :5174
INSTATIC_PUBLIC_EDITOR_ORIGIN=http://localhost:3000
```

## Owner bootstrap

First successful SSO **auto-creates** site + owner when install is empty  
(`ensureLadipageEditorOwner`). Customers never open Instatic setup UI.

Manual fallback: see `tools/instatic/ensure-owner.md`.

## Run (dev, Windows PowerShell)

```powershell
# 1) Instatic (from Instatic repo)
$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
$env:PORT = "8787"
$env:VITE_PORT = "5174"
# .env already has INSTATIC_SSO_SECRET=local-sso-change-me
bun run dev

# 2) Nest (Docker)
cd liora-monorepo
# .env: INSTATIC_SSO_SECRET=local-sso-change-me
#       INSTATIC_BASE_URL=http://host.docker.internal:8787
#       INSTATIC_MOCK=false
#       INSTATIC_PUBLIC_EDITOR_ORIGIN=http://localhost:3000
pnpm docker:up   # or rebuild restart liora-ladipage

# 3) FE
cd ladipage-fe-v2
# NEXT_PUBLIC_LANDING_EDITOR=instatic
# NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN=http://localhost:3000
# INSTATIC_REWRITE_TARGET_CMS=http://127.0.0.1:8787
# INSTATIC_REWRITE_TARGET_VITE=http://127.0.0.1:5174
pnpm dev
```

## Probe (avoid false "Not found")

```powershell
# Instatic OK
Invoke-RestMethod http://127.0.0.1:8787/health

# Nest OK — NOT /api/health (that path 404s by design)
Invoke-RestMethod http://127.0.0.1:7002/api/health/ready
Invoke-RestMethod http://127.0.0.1:7002/api/landing-cms/health

# FE rewrite OK
Invoke-RestMethod http://localhost:3000/admin/api/cms/setup/status

# Full script
.\liora-monorepo\tools\instatic\check-instatic.ps1
```

| Wrong URL | What you see | Why |
|-----------|--------------|-----|
| `GET :7002/api/health` | Nest `NotFoundException` | Route is `/api/health/ready` |
| `GET :8787/admin` | "Admin UI not served on this port" | SPA is on :5174 / FE rewrite |
| Old Instatic process | `{"error":"Not found"}` on SSO/ensure-page | Restart after ladipageSso/bridge |

## Manual SSO check

Mint session via product UI, or craft token with shared secret.  
Expected: `302 Location: /admin/site` + `Set-Cookie: instatic_admin_session; Path=/admin`.
