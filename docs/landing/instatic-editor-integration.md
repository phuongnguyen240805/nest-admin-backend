# Instatic Landing Editor Integration

Scope: `ladipage-fe-v2` + `liora-monorepo` only.

## Ports (Ladipage side-by-side)

Avoid clashing with Next (`3000`), default Instatic docs (`3001`/`5173`), Nest (`7002`).

| Service | Host port | Env |
|---------|-----------|-----|
| **Instatic CMS (Bun API)** | **8787** | `PORT=8787` when running from repo |
| **Instatic Vite admin (dev)** | **5174** | `VITE_PORT=5174` |
| Nest landing-cms client | → `8787` | Docker: `INSTATIC_BASE_URL=http://host.docker.internal:8787` |
| Next rewrite `/admin/api` | → `8787` | `INSTATIC_REWRITE_TARGET_CMS=http://127.0.0.1:8787` |
| Next rewrite `/admin` SPA | → `5174` | `INSTATIC_REWRITE_TARGET_VITE=http://127.0.0.1:5174` |

### Run Instatic from repo (recommended)

```bash
# from monorepo root
chmod +x liora-monorepo/tools/instatic/run-dev-from-repo.sh
./liora-monorepo/tools/instatic/run-dev-from-repo.sh

# or manually:
cd Instatic
PORT=8787 VITE_PORT=5174 bun run dev
```

- CMS API:  http://127.0.0.1:8787  
- Admin UI: http://127.0.0.1:5174  

### Nest + FE env

```bash
# Nest (Docker → host Instatic)
INSTATIC_MOCK=false
INSTATIC_BASE_URL=http://host.docker.internal:8787
INSTATIC_SSO_SECRET=local-sso-change-me
INSTATIC_PUBLIC_EDITOR_ORIGIN=http://localhost:3000
LADIPAGE_BRIDGE_HMAC_SECRET=...

# FE (browser stays on :3000)
NEXT_PUBLIC_LANDING_EDITOR=instatic
NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN=http://localhost:3000
INSTATIC_REWRITE_TARGET_CMS=http://127.0.0.1:8787
INSTATIC_REWRITE_TARGET_VITE=http://127.0.0.1:5174
```

Change ports anytime: set `PORT` / `VITE_PORT` when starting Instatic, and mirror both rewrite env URLs.

**Probes:** Nest readiness is `GET /api/health/ready` (not `/api/health`). Full chain: `tools/instatic/check-instatic.ps1`.

## Ownership

| Concern | Location |
|---------|----------|
| Port + Instatic adapter | `apps/ladipage-backend/src/modules/landing-cms/` |
| Editor host UI | `ladipage-fe-v2/src/features/landing-editor-host/` |
| Session BFF | `fe-v2/src/app/api/landing-cms/session` → Nest |
| Plugin bridge | `tools/instatic/plugins/ladipage-bridge/` |
| Run from repo | `tools/instatic/run-dev-from-repo.sh` |

## Flags

- `NEXT_PUBLIC_LANDING_EDITOR=legacy|instatic` (default `legacy`)
- `INSTATIC_MOCK=true` (default) — offline adapter
- `INSTATIC_BASE_URL` default `http://127.0.0.1:8787`
- `INSTATIC_REWRITE_TARGET` — Next `/_cms/*` target (dev UI often `:5174`)

## Protocol

`ladipage-instatic@1` — session mint, materialize HTML, artifact fetch, HMAC publish-intent.
