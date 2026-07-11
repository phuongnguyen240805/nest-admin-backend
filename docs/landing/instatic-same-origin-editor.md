# Same-origin Instatic editor (customer stays on Ladipage port)

## Goal

- Login **only** Ladipage
- Open editor in **new tab**
- URL stays **same host:port** as Ladipage (e.g. `http://localhost:3000/admin/...`)
- No visible jump to `:5174` / `:8787`

## How

```text
Browser → http://localhost:3000/admin/api/cms/auth/ladipage-sso?token=...
       → Next rewrite → Instatic CMS :8787 (SSO + Set-Cookie Path=/admin)
       → 302 /admin/site
       → Next rewrite → Vite :5174 SPA
Cookie Path=/admin works because path is still /admin on :3000
```

## FE env

```env
NEXT_PUBLIC_LANDING_EDITOR=instatic
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN=http://localhost:3000
INSTATIC_REWRITE_TARGET_CMS=http://127.0.0.1:8787
INSTATIC_REWRITE_TARGET_VITE=http://127.0.0.1:5174
```

## Nest env

```env
INSTATIC_SSO_SECRET=local-sso-change-me
INSTATIC_PUBLIC_EDITOR_ORIGIN=http://localhost:3000
INSTATIC_BASE_URL=http://host.docker.internal:8787
INSTATIC_MOCK=false
```

## Instatic env

```env
INSTATIC_SSO_SECRET=local-sso-change-me
```

Owner is auto-bootstrapped on first SSO (no customer setup UI).

## Diagnose "Not found"

Do **not** treat these as product failures:

| URL | Expected |
|-----|----------|
| `GET :7002/api/health` | Nest **404** — use `/api/health/ready` |
| `GET :7002/api/landing-cms/health` | `ok: true` when Nest reaches Instatic |
| `GET :8787/admin` | "Admin UI not served" — use FE `:3000/admin` |
| `GET :3000/admin/api/cms/setup/status` | Instatic JSON via rewrite |

```powershell
.\liora-monorepo\tools\instatic\check-instatic.ps1
```

## Diagnose "Failed to fetch dynamically imported module"

Browser error like:

```text
Failed to fetch dynamically imported module:
http://localhost:3000/src/admin/layouts/.../AdminCanvasEditorBody.tsx
```

Means Next did not proxy the Vite module graph correctly (HTML 404 / JWT redirect).

**Checks:**

```powershell
# Must be text/javascript, NOT Next HTML
Invoke-WebRequest http://localhost:3000/src/admin/main.tsx | Select StatusCode, Headers
Invoke-WebRequest http://localhost:3000/runtime/react.js | Select StatusCode, Headers
```

**Fix stack:**

1. `next.config.ts` `beforeFiles` rewrites: `/src`, `/runtime`, `/@vite`, `/node_modules`, …
2. Middleware must not redirect `/src/*` or `/@vite/*` to `/signin`
3. Instatic `.env`: `PUBLIC_ORIGIN=http://localhost:3000` (Vite HMR behind proxy)
4. **Restart both FE and Instatic** after config change
