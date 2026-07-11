# ladipage-bridge (Instatic plugin)

Glue between Instatic publish events and Ladipage Nest:

- `POST {LADIPAGE_BFF}/api/internal/landing/publish-intent`
- Headers: `x-lp-timestamp`, `x-lp-signature` (HMAC-SHA256 of `timestamp.rawBody` with `LADIPAGE_BRIDGE_HMAC_SECRET`)

Frontend runtime (optional) posts public forms to Ladipage `/api/public/forms/submit`.

Install on each Instatic site after workspace provision. Source lives in `liora-monorepo` only.
