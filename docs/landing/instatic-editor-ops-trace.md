# Trace: Save / Publish / editor_data (Instatic editor)

## Symptom

SSO opens Instatic canvas, but **Save**, **Publish**, and Ladipage **`editor_data`** look broken.

## Root cause A — Save & Publish (fixed GĐ CSRF)

Browser is on `http://localhost:3000` (Ladipage + rewrite).  
State-changing CMS calls send:

```http
Origin: http://localhost:3000
PUT /admin/api/cms/site-document
POST /admin/api/cms/publish
```

Next rewrites to Bun `:8787`. Instatic CSRF (`originAllowed`) only trusted Vite `:5173/:5174` (and `PUBLIC_ORIGIN` if set).  
Result:

```json
{"error":"Forbidden: invalid origin"}  // HTTP 403
```

**Fix (Instatic):**

- `DEV_ORIGIN_ALLOWLIST` includes `http://localhost:3000` / `127.0.0.1:3000`
- `.env`: `PUBLIC_ORIGIN=http://localhost:3000` and `LADIPAGE_PUBLIC_ORIGIN=http://localhost:3000`
- **Restart Instatic** after change

**Verify (PowerShell / curl after SSO cookie):**

```text
PUT /admin/api/cms/site-document  →  not 403
POST /admin/api/cms/publish       →  not 403
```

In browser DevTools Network: filter `site-document` / `publish` — expect **200** (or validation 400), never **403 invalid origin**.

---

## Root cause B — `editor_data` (architecture gap, not CSRF)

Ladipage Supabase column `landing_pages.editor_data` is **not** loaded into Instatic on open.

| Layer | What actually happens today |
|-------|-----------------------------|
| Nest `openEditorSession` | Mints SSO only; provisional `site_*` / `page_*` ids; **no** ensure-page of real content; **no** read of `editor_data` |
| Instatic SSO | Session cookie + redirect `/admin/site`; claims `pageId` **unused** for canvas open |
| Instatic draft | Own SQLite/Postgres pages (`site-document`), bootstrap Home page |
| Ladipage bridge `import-html` / `artifact` | **Stubs** (echo ids / stub HTML) — not real DB import / not real published artefact |
| `ladipage-bridge` plugin | Pseudocode only — does **not** push Instatic publish → Nest `publish-intent` yet |

So:

1. **Save in Instatic** (after CSRF fix) persists **Instatic** draft, **not** Supabase `editor_data`.
2. **Publish in Instatic** publishes Instatic public site; does **not** update Ladipage `/p/{slug}` unless FE publish pipeline fetches artifact (stub today).
3. **Opening editor** shows Instatic site (often empty Home), **not** historical Ladipage Grapes/Puck `editor_data`.

### Product path for `editor_data` (next work)

1. **Open:** Nest loads `landing_pages` → if HTML/artifact exists, call real `import-html` / map `external_page_id` → SSO redirect to that page.
2. **Save draft (optional):** Instatic save hook or periodic sync → Nest updates `editor_data` / mapping.
3. **Publish to Ladipage:** Wire plugin or Nest pull of real published HTML → `landing_pages.published_html` + status.
4. Set `render_engine=instatic` + `LANDING_PUBLISH_SOURCE=instatic-artifact` when using this path.

---

## Quick decision tree

```text
Save/Publish fail?
  Network 403 invalid origin  → CSRF (restart Instatic with PUBLIC_ORIGIN + allowlist)
  Network 401 Unauthorized    → cookie Path=/admin lost (open via :3000 not :5174)
  Network 200 but Ladipage list unchanged → expected until editor_data / publish bridge

editor_data empty on Ladipage after edit?
  → Expected: draft lives in Instatic until sync (GĐ above)
```

## Related files

- CSRF: `Instatic/server/auth/security.ts`, `Instatic/server/handlers/cms/index.ts`
- Save: `Instatic/server/handlers/cms/siteDocument.ts` (`PUT …/site-document`)
- Publish: `Instatic/server/handlers/cms/publish.ts` (`POST …/publish`)
- SSO: `Instatic/server/handlers/cms/ladipageSso.ts`
- Stubs: `Instatic/server/handlers/cms/ladipageBridge.ts`
- Nest session: `landing-cms/application/landing-page.service.ts` `openEditorSession`
- Ladipage publish: `ladipage-fe-v2/.../landing-publish.service.ts` (artifact fetch)
