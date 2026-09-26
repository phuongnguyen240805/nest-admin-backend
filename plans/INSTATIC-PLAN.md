# Plan: Fix triệt để Instatic editor + public layout + Save/Publish/Auto-save

## Goal

Làm cho vòng đời landing Instatic trên production chạy end-to-end:

1. Mở editor từ LadiPage → canvas đúng page, Save/Auto-save/Publish **thật sự persist**.
2. Public LadiPage `/p/{slug}` (và custom domain) hiển thị **cùng layout** với canvas (trừ khác biệt viewport thật).
3. Nút Public/Open live mở **trang LadiPage đã publish**, không mở nhầm origin/path.

Không đụng branding Kedi, CSKH, ads, education. Chỉ Instatic ↔ Nest landing-cms ↔ FE landing-editor-host / landing-publish.

## Non-goals (v1)

- Không phục hồi 100% HTML gốc Grapes/Puck/`<link rel="stylesheet">` bên ngoài (import vẫn là tree + CSS registry). Cải thiện import là PR riêng, không chặn control-plane.
- Không biến Cloudflare thành host SPA Instatic. Same-origin rewrite `/admin` trên OpenNext đã chứng minh gãy (`/admin` 403, `/admin/site` 500). Giữ rewrite `/admin/api` chỉ cho **dev local Next**.
- Không raise Supabase pool / không đụng worker khác.

---

## Target architecture

```text
Browser (đã login LadiPage)
  → FE: POST /api/landing-cms/session
  → Nest mint SSO (TTL 120s)
  → Browser MỞ ABSOLUTE URL Instatic:
       https://<INSTATIC_PUBLIC_ORIGIN>/admin/api/cms/auth/ladipage-sso?token=…
  → Cookie Path=/admin trên host Instatic
  → 302 /admin/site?table=pages&row=<canonicalInstaticPageId>
  → PUT/POST /admin/api/cms/* Origin = Instatic origin → CSRF OK

Publish / Auto-save
  → Instatic bake HTML **self-contained** (CSS inline) cho page đang bind
  → HMAC POST Nest /api/internal/landing/{draft-saved|publish-intent}
  → lookup mapping bền (landing_pages.external_page_id), không in-memory Map
  → Nest ghi editor_data / published_html

Public
  → GET /p/{slug} serve published_html nguyên document
  → không phụ thuộc /_instatic/css trên CF/CDN
```

Editor origin canonical: Instatic Dokploy  
`https://instatic-app-sr5zak-96373a-158-220-105-203.sslip.io`  
(sau này CNAME `editor.<product-domain>` — chỉ đổi env).

Public origin canonical: LadiPage `/p/{slug}` + custom domain.

---

## Key decisions

1. **Editor = origin Instatic, không same-origin CF.**  
   Probe: CF rewrite `/admin/api/*` OK, SPA `/admin` 403/500. Cookie + CSRF + Vite graph không đáng tin qua OpenNext. Local Next rewrite giữ cho `bun run dev`.

2. **Artifact gửi Nest phải self-contained (CSS inline).**  
   Instatic public trên sslip.io vẫn hashed `/_instatic/css`. Payload HMAC / artifact LadiPage dùng `cssEmission: 'inline'` + absolutize `/uploads` và media. `/p/{slug}` không cần proxy CSS. `LANDING_ASSET_BASE_URL` (CDN) **không** được rewrite `/_instatic/*`.

3. **SSO binding bền, không process memory.**  
   `ssoBindingsByUserId` mất khi restart/replica → HMAC skip. Mapping: `landing_pages.external_page_id` + `external_site_id` (đã có migration). HMAC body luôn mang `pageId` LadiPage. Fallback: Nest lookup by `external_page_id`.

4. **Một Instatic page id canonical.**  
   Dùng `page_<ladipageUuid>` (hoặc uuid ổn định ghi registry) cho cả `ensure-page`, SSO `row=`, import-html. Cấm `pageKey = raw uuid` lệch `page_${id}`.

5. **Desktop breakpoint: min-width, không max-width 1440.**  
   Canvas iframe = 1440px nên `(max-width: 1440px)` luôn khớp; public >1440 mất style. Desktop query → `(min-width: 769px)` (sau tablet). Mobile/tablet giữ max-width.

6. **Live canvas không rewrite `vh`.**  
   Design mode giữ pin 800px (tránh iframe nổ). Live mode dùng viewport thật của iframe. Public không đổi.

7. **Publish UI phải phản ánh cầu LadiPage.**  
   Toolbar Publish fail/warn nếu HMAC không 200. Open live → `/p/{slug}` (FE origin) hoặc `published_url`, không `window.open('/about')` trên origin hiện tại.

---

## Workstream A — Control plane (mở editor + Save/Auto-save/Publish)

### A1. Nest mint absolute editor URL

Repo: `liora-monorepo`

- `instatic-sso.service.ts` `mint()`: `editorUrl = ${publicEditorOrigin}/admin/api/cms/auth/ladipage-sso?token=...`  
  `publicEditorOrigin` = `INSTATIC_PUBLIC_EDITOR_ORIGIN` (Dokploy sslip.io), **không** `NEXT_PUBLIC_APP_URL`.
- `cmsPath` giữ relative cho dev rewrite.
- Claims: `pageId` (LadiPage), `instaticPageId` (canonical), `siteId`.
- `openEditorSession`: luôn `ensurePage` với canonical id **trước** mint; import HTML chỉ khi page tree trống (không class-name skip đè CSS đã edit).
- Health: `publishSource` đọc `LANDING_PUBLISH_SOURCE`; Dokploy set `instatic-artifact`.
- Code default `INSTATIC_MOCK`: giữ true cho CI; compose/Dokploy **bắt buộc** `INSTATIC_MOCK=false` (đã đúng trên live probe).

### A2. FE mở origin Instatic, không strip về CF

Repo: `ladipage-fe-v2`

- `editor-url.ts`: production dùng `editorUrl` absolute Instatic. Chỉ rewrite `:5174/:8787` → same-origin khi **dev**.
- `EditorHostPage` / `openInstaticEditor`: `window.open(absoluteSsoUrl)` tab mới trên Instatic origin. Không `location.replace` sang `workers.dev/admin/...`.
- Middleware: không cần `/admin` SPA trên CF. Có thể 404/403 — không còn trên happy path.
- Tests: `editor-url.test.ts` — prod absolute sslip.io; dev relative `/admin`.

### A3. Instatic CSRF + cookie trên origin editor

Repo: `Instatic`

- Dokploy `PUBLIC_ORIGIN=https://instatic-app-….sslip.io` (và custom editor domain sau này).
- Không cần workers.dev trong CSRF nếu browser Origin = sslip.io.
- Cookie `Path=/admin; SameSite=Lax; Secure` khớp https Instatic.
- SSO 302 Location **cùng host** `/admin/site?table=pages&row=<canonicalId>`.
- Dev: giữ `DEV_ORIGIN_ALLOWLIST` localhost:3000 + `PUBLIC_ORIGIN` comma-list.

### A4. HMAC durable + fail visibly

Repo: `Instatic` + `liora-monorepo`

Instatic `ladipageNotify.ts`:

- Bỏ phụ thuộc `ssoBindingsByUserId` như source of truth.
- Body HMAC luôn: `{ pageId: ladipageUuid, externalPageId, html, seoTitle }`.
- Persist binding: cookie/session claim hoặc row Instatic metadata; tối thiểu claims SSO → session; đọc lại lúc publish.
- `notifyLadipagePublishIntent` / `draft-saved`:
  - Thiếu `LADIPAGE_BFF_BASE` / secret → **error**, không `{ok:true, skipped}`.
  - HTTP không 200 → PublishButton error (không “N pages published”).
- Artifact cho Nest: `publishPage(..., { cssEmission: 'inline' })` + rewrite `src`/`url(/uploads` → `${INSTATIC_PUBLIC_ORIGIN}/uploads...`.
- Không gửi disk artefact có `<link href="/_instatic/css/...">` sang LadiPage.

Nest `acceptPublishIntent` / `acceptDraftSaved`:

- Verify HMAC (giữ).
- Upsert `external_page_id` / `external_site_id`.
- Persist `published_html` / `editor_data.html` **throw** nếu Supabase update fail (hiện chỉ `logger.warn`).
- Lookup: `pageId` LadiPage; fallback `external_page_id = dto.externalPageId`.

Dokploy Instatic env (bắt buộc):

```text
PUBLIC_ORIGIN=https://instatic-app-sr5zak-96373a-158-220-105-203.sslip.io
INSTATIC_SSO_SECRET=<khớp Nest>
LADIPAGE_BFF_BASE=https://ladipage-backend-23sqjd-d087f6-158-220-105-203.sslip.io
LADIPAGE_BRIDGE_HMAC_SECRET=<khớp Nest>
```

`LADIPAGE_BFF_BASE` **không** có suffix `/api` (code append `/api/internal/landing/...`).

Dokploy Nest:

```text
INSTATIC_MOCK=false
INSTATIC_BASE_URL=https://instatic-app-sr5zak-96373a-158-220-105-203.sslip.io
INSTATIC_PUBLIC_EDITOR_ORIGIN=<cùng Instatic origin>
INSTATIC_SSO_SECRET=<khớp>
LADIPAGE_BRIDGE_HMAC_SECRET=<khớp>
LANDING_PUBLISH_SOURCE=instatic-artifact
```

Xóa/override `.env.production` `INSTATIC_BASE_URL=onrender.com` — không còn host thứ 3.

### A5. Auto-save / Save UX

Repo: `Instatic`

- Giữ debounce 30s + single-flight (`usePersistence`) — không đổi protocol.
- Surface HMAC draft-saved failure trên pill (optional field từ `site-document` response). Instatic DB save vẫn 200; LadiPage sync fail → “Saved locally, LadiPage sync failed”.
- Không disable Auto-save khi CSRF fail; CSRF không còn trên happy path (cùng origin).

---

## Workstream B — Public layout LadiPage

### B1. `/p/{slug}` không rewrite `/_instatic` sang CDN

Repo: `ladipage-fe-v2`

`rewriteRootRelativeAssets` (`public-landing-html.server.ts`):

- **Không** prefix `/_instatic/`, `/admin/`, `/runtime/`.
- Self-contained HTML (inline `<style>`) không cần prefix CSS.
- Media `/uploads/...` nếu còn relative: prefix **Instatic origin** (`NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN`), không `LANDING_ASSET_BASE_URL`.
- Giữ prefix CDN chỉ cho `/images/` platform.

Tests hiện expect rewrite mọi `href="/..."` — cập nhật.

### B2. Nút Public / Open live

Repo: `Instatic` + `ladipage-fe-v2`

- Open live trong editor Instatic: URL LadiPage public = `{LADIPAGE_PUBLIC_ORIGIN}/p/{ladipageSlug}` (plugin setting / env `LADIPAGE_PUBLIC_PAGES_BASE`). Fallback: Instatic public path **chỉ** khi đang preview trên chính origin Instatic **và** artefact Layer A tồn tại.
- Toolbar Publish: đọc `result.ladipage`; fail → error 5s, không `state=published` giả.
- FE list “Publish”: `fetchInstaticArtifactHtml` bắt buộc khi `render_engine=instatic`; từ chối persist stub “Draft page (publish…)” / mock HTML.

### B3. Stub artifact

Repo: `Instatic` `ladipageBridge.ts` `buildArtifactHtml`

- Unpublished: **404/null**, không stub HTML. Nest/FE không publish nhầm placeholder.
- Published snapshot: render **inline CSS** khi `?inline=1` hoặc khi user-agent là Nest artifact fetch.

---

## Workstream C — JSON tree + layout engine

### C1. Canonical page mapping + import một lần

Repo: Nest + Instatic

- Canonical `instaticPageId = page_${ladipageUuid}` (một hàm shared / cùng convention hai phía).
- `ensureLadipagePage` + SSO `row=` + import-html cùng id.
- Import HTML **chỉ khi** page chưa có node ngoài `base.body` rỗng. Tái mở editor không `mergeImportedStyleRules` skip/đè.
- `extractHtml`: chỉ HTML string. Grapes/Puck JSON không import giả — mở blank Instatic page (document rõ). Migration HTML từ `ai_source_html` / `published_html` giữ.

### C2. Desktop / viewport

Repo: `Instatic`

- `DEFAULT_BREAKPOINTS` desktop `mediaQuery: '(min-width: 769px)'` (tablet max 768). Existing sites: migrate desktop context query khi load nếu còn `(max-width: 1440px)`.
- Live canvas: **không** gọi `resolveViewportUnits` (hoặc height = iframe clientHeight thật). Design giữ 800px pin.
- Document: Design ≈ device frame; Live/public = viewport thật.

### C3. Import CSS (sau control-plane)

Không chặn A/B. Khi làm:

- Import-html: merge class CSS khi rule mới **có declarations** và existing `styles` rỗng (sửa `if (byName.has(rule.name)) continue`).
- Không fetch `<link rel="stylesheet">` arbitrary URL (SSRF). Chỉ Super Import / `ai_source_html` đã inline.
- Reset publisher giữ (canvas = public). Không tắt reset.

---

## PR order (mergeable độc lập)

| PR | Repo | Phụ thuộc | Việc |
|---|---|---|---|
| **PR1** | `liora-monorepo` | — | Absolute SSO URL; canonical page id; ensure-page trước mint; `LANDING_PUBLISH_SOURCE`; persist mapping throw on fail |
| **PR2** | `Instatic` | PR1 env | CSRF/PUBLIC_ORIGIN docs; HMAC không skip; binding từ claims; artifact inline CSS; PublishButton đọc `ladipage`; Open live → LadiPage `/p/{slug}`; desktop min-width; live canvas bỏ vh pin; artifact unpublished = miss |
| **PR3** | `ladipage-fe-v2` | PR1 | `editor-url` absolute prod; open tab Instatic; `/p` không rewrite `/_instatic` sang CDN; reject stub artifact; tests |
| **PR4** | Nest + Instatic | PR1–3 | Import-once; class-merge rỗng; (optional) desktop query migrate |

Ops (không PR code): set Dokploy env A4; restart Instatic + Nest; xác nhận không còn onrender.

---

## Verification (bắt buộc trước khi gọi xong)

Sau deploy:

1. Nest `GET /api/landing-cms/health` → `mock:false`, `baseUrl` = sslip.io Instatic, `publishSource=instatic-artifact`.
2. Từ LadiPage đã login: Open editor → URL **sslip.io** `/admin/site?table=pages&row=page_<uuid>` (không `workers.dev/admin/site` 500).
3. DevTools: `PUT site-document` **200**, Origin = sslip.io. Auto-save 30s 200.
4. Publish toolbar 200 và `ladipage.ok=true`. Network Nest `publish-intent` 200.
5. `landing_pages.published_html` chứa `<style>` (inline), **không** `<link href="/_instatic/css`.
6. `GET /p/{slug}` layout = canvas Live (desktop >1440 vẫn giữ style desktop). Network **không** 404 `/_instatic/css`.
7. Open live → `/p/{slug}` trên FE origin, 200 HTML đầy đủ.
8. CF `/admin/site` 500 **không còn** trên happy path (không đi path đó).

Tests:

- Nest: `landing-page.service.spec.ts` — editorUrl absolute; canonical id; persist throw.
- Instatic: HMAC notify không skip thiếu binding nếu claims có pageId; inline artifact; desktop mediaQuery; unpublished artifact null.
- FE: `editor-url.test.ts` prod absolute; `public-landing-html.server.test.ts` không prefix `/_instatic`; publish reject stub.

---

## Risks

- User bookmark `/admin` trên CF: vẫn 500. Copy trong UI “editor mở tab Instatic”.
- Cookie Instatic không share LadiPage session — đúng; mỗi lần mở mint SSO mới (TTL 120s). Tab editor đã mở giữ session Instatic đến expiry.
- Inline CSS làm `published_html` lớn hơn hashed bundles — chấp nhận để public không phụ thuộc proxy. Có thể tách R2/CDN Instatic sau.
- Đổi desktop min-width: site đã style theo max-width 1440 cần migrate query (PR2/PR4).
- HMAC `LADIPAGE_BFF_BASE` trỏ nhầm CF worker → 404. Phải là Nest sslip.io.

---

## Files (điểm sửa chính)

**Nest**  
`apps/ladipage-backend/src/modules/landing-cms/instatic/instatic-sso.service.ts`  
`.../application/landing-page.service.ts`  
`.../application/page-registry.store.ts`  
`.../instatic/instatic-import.service.ts`  
`.../landing-cms.config.ts`  
`.../internal-publish.controller.ts`

**Instatic**  
`server/handlers/cms/ladipageSso.ts`  
`server/handlers/cms/ladipageNotify.ts`  
`server/handlers/cms/ladipageBridge.ts`  
`server/handlers/cms/publish.ts`  
`server/handlers/cms/siteDocument.ts`  
`server/auth/security.ts`  
`src/admin/pages/site/toolbar/PublishButton.tsx`  
`src/admin/shared/OpenLivePageButton/OpenLivePageButton.tsx`  
`src/core/page-tree/breakpoint.ts`  
`src/admin/pages/site/canvas/IframeFrameSurface.tsx`  
`src/admin/pages/site/store/slices/site/importLinking.ts`

**FE**  
`src/features/landing-editor-host/editor-url.ts`  
`src/features/landing-editor-host/EditorHostPage.tsx`  
`src/features/landing-editor-host/open-editor-session.ts`  
`src/features/landing-publish/services/public-landing-html.server.ts`  
`src/features/landing-publish/services/landing-publish.service.ts`

Không sửa `next.config.ts` rewrite như “fix CF SPA” — dead end. Dev rewrite giữ nguyên.
