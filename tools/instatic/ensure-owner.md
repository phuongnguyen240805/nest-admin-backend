# Instatic owner for Ladipage SSO

## Product path (default)

**SSO auto-bootstraps** site + owner on first successful SSO if none exist  
(`ensureLadipageEditorOwner` in `Instatic/server/handlers/cms/ladipageSso.ts`).

Customers never open Instatic setup UI.

Requires:

```env
# Instatic process
INSTATIC_SSO_SECRET=<same as Nest>
```

## Manual fallback (ops)

Only if auto-bootstrap fails:

1. `bun run dev` Instatic (PORT=8787, VITE_PORT=5174)
2. Open http://127.0.0.1:5174 → create owner once
3. Retry Ladipage editor
