# Plan 1 — Hoàn thiện UI Facebook Ads và khai thác Next.js fullstack

> Trạng thái: kế hoạch triển khai, chưa code  
> Cập nhật: 2026-08-01  
> Repo thực thi chính: `D:\monorepo-project-workspace\ladipage-fe-v2`  
> Bề mặt nhúng: `D:\monorepo-project-workspace\extensionpromax`

## Nguồn đối chiếu

- `plans/facebook-ads/PLAN-FE.md`, `PLAN-BE.md`, `REPORT-FE-MOCK.md`.
- `plans/extentions/facebook-ads-extension-pilot-plan.md`.
- `ladipage-fe-v2/src/features/facebook-ads` và các route App Router liên quan.
- `extensionpromax/packages/extension/src/mini-apps/facebook-ads` và frame nhúng hiện tại.
- `clone-UI-adsmeta` chỉ để kiểm kê luồng/trạng thái UI; không sao chép bundle.
- Phân tích cuộc chat AdsMeta đã cung cấp: ưu tiên official backend cho production, extension là context bổ sung.

## 1. Mục tiêu

Hoàn thiện các phần UI/UX còn thiếu của `facebook-ads` dựa trên hành vi quan sát được từ AdsMeta, nhưng triển khai lại bằng component, design system và kiến trúc của LadiPage. Tận dụng Next.js 16 như một lớp fullstack dành cho giao diện: server rendering, BFF/view-model, route handler nội bộ, feature flag và dữ liệu giả lập ở môi trường dev.

Kết quả cuối phải dùng chung một feature cho ba bề mặt:

1. Web app đầy đủ tại `/facebook-ads/*`.
2. Extension side panel tại `/facebook-ads/manager?embedded=1&source=extensionpromax&client=chromex&shell=adsmeta`.
3. Preview/devtool tại `/extension-preview/facebook-ads`, chỉ phục vụ phát triển và kiểm thử.

Không sao chép bundle minify, branding, CSS hoặc mã nguồn của `clone-UI-adsmeta`. Chỉ dùng nó làm inventory về luồng, trạng thái và mật độ thông tin.

## 2. Quyết định kiến trúc bắt buộc

### 2.1 Logic nào được giữ trong Next.js

| Nhóm logic | Vị trí | Ghi chú |
|---|---|---|
| Routing, layout, responsive, embed mode | Next.js App Router | Một cây route và một feature, không nhân đôi `facebook-ads-v2` |
| Render view-model, format metrics, column presets | Server/client module của FE | Pure function, kiểm thử được |
| Filter, sort, selection, drawer/modal, wizard UI state | Client component/Zustand | Không coi Zustand là nguồn dữ liệu server |
| Fetch và tổng hợp nhiều API LadiPage | Next.js server-side BFF | Chỉ gọi LadiPage Backend, không gọi Meta trực tiếp |
| Session LadiPage, CSRF, tenant/workspace forwarding | Next.js server boundary | Cookie `httpOnly`; không đưa credential nhạy cảm xuống client |
| Dev fixtures, scenario selector, preview data | Dev-only route handlers | Không được lọt vào production build/runtime |
| Autosave orchestration, validate form trước request | FE + backend draft API | Backend vẫn là nguồn draft chuẩn |
| CSV/export nhỏ | FE | Export lớn hoặc async chuyển về backend job |

### 2.2 Logic tuyệt đối không đặt ở Next.js frontend

- Meta OAuth token vault, refresh token và mã hóa credential.
- Gọi `graph.facebook.com` bằng token người dùng từ browser.
- Đọc Facebook cookie, `window.__accessToken`, DTSG hoặc private GraphQL.
- Publish Campaign/Ad Set/Creative/Ad và retry nghiệp vụ.
- Webhook verification, scheduled sync, reconciliation và audit chuẩn.
- Generic proxy nhận URL/header/body tùy ý từ client.

Next.js BFF là lớp chống coupling và tối ưu render, không phải backend Meta thứ hai.

## 3. Hiện trạng và khoảng trống

### 3.1 Phần đã có thể tái sử dụng

- Shell Facebook Ads, header, navigation drawer/sidebar và theme riêng.
- Ads Manager table, hierarchy Campaign/Ad Set/Ad, summary cards và overlays.
- Wizard tạo campaign, draft, reports, rules, tools, account/BM/fanpage, policy, permissions, guide, support và settings.
- Các service thật bước đầu cho ad account, Business Manager và fanpage.
- React Query, Zod, Zustand, Next.js App Router và route preview extension.
- `extensionpromax` đã có iframe shell, allowlist origin/path, loading/timeout/retry và route chính `/facebook-ads/manager`.

### 3.2 Nợ kiến trúc cần xử lý trước khi clone tiếp

- UI phần lớn đang dùng mock/local state; manager và wizard chưa dựa trên API production.
- `facebook-auth.service.ts` và `facebook-api.client.ts` đi ngược nguyên tắc: lưu Facebook auth/token ở IndexedDB và gọi Graph API từ client.
- Còn route/cây file `facebook-ads-v2` trong quá trình hợp nhất; không được tạo thêm bản sao thứ ba.
- Preview cũ tự render/navigation bằng local state, trong khi extension route chính đã trỏ vào manager thật. Hai đường chạy có nguy cơ lệch chức năng.
- `extensionpromax` còn chỗ gọi legacy preview trong `FacebookAdsEmbeddedPanel`, nhưng frame/config khác lại ưu tiên manager thật.
- Mock, empty state và dữ liệu thật chưa có dấu hiệu provenance rõ ràng.

### 3.3 Inventory UI còn thiếu hoặc chưa đủ sâu

| Cụm | Còn thiếu/cần hoàn thiện | Ưu tiên |
|---|---|---|
| Connections | OAuth state, token expiry/reconnect, permission scope, chọn connection/ad account mặc định | P0 |
| Ads Manager | Pagination/cursor thật, date compare, breakdown, attribution, saved view, search/filter builder, column presets | P0 |
| Hierarchy | Expand/collapse có cache, selection xuyên trang, inline status/budget/name, partial failure | P0 |
| Create flow | Objective-specific fields, conversion location, pixel/event, audience, placement, optimization, creative/media/preview | P0 |
| Draft/publish | Autosave conflict, validation theo field, publish timeline, retry/resume, rollback guidance | P0 |
| Assets | Page, Instagram account, pixel/dataset, custom conversion, audience, media library | P1 |
| Reports | Saved report, schedule/export, breakdown, comparison, chart/table parity | P1 |
| Rules | Condition builder, preview impacted entities, schedule/timezone, run history | P1 |
| Account ops | Billing/currency/timezone read-only, quality/policy, permissions, activity/audit | P1 |
| Collaboration | Notifications, comment/activity, team ownership, support context | P2 |
| Advanced tools | Duplicate, bulk rename, Super Share-equivalent workflow, recommendations/AI có guardrail | P2 |
| UX states | Skeleton, empty, stale, permission denied, rate limited, disconnected, partial data | P0 |

## 4. Kiến trúc bề mặt UI

```text
Next.js App Router
├─ /facebook-ads/*                         full web workspace
├─ /facebook-ads/*?embedded=1              extension side-panel profile
└─ /extension-preview/facebook-ads         dev/test harness only
          │
          ├─ shared feature components
          ├─ shared query keys + API contracts
          ├─ surface capability policy
          └─ Next BFF /api/_bff/facebook-ads/*
                         │
                         └─ LadiPage Backend /api/facebook-ads/*
```

### 4.1 Không tạo UI riêng cho extension

Mỗi màn hình nhận `surface` từ server-derived context thay vì đọc query tùy ý ở nhiều component:

```ts
type FacebookAdsSurface = 'workspace' | 'extension' | 'dev-preview'
```

`surface` quyết định bố cục/capability, không quyết định quyền backend. Backend vẫn kiểm tra tenant, entitlement và permission cho mọi request.

### 4.2 Ma trận capability theo bề mặt

| Capability | Workspace | Extension | Dev preview |
|---|---:|---:|---:|
| Manager read | Có | Có, tối ưu chiều ngang hẹp | Fixture hoặc API dev |
| Tạo/sửa draft | Có | Có, stepper rút gọn | Fixture |
| Publish/activate | Có xác nhận | Có nếu session app hợp lệ | Luôn giả lập |
| Connection OAuth | Có | Mở tab bảo mật riêng | Giả lập trạng thái |
| Raw diagnostics | Không | Không | Chỉ diagnostics đã redact |
| Dev scenario switcher | Không | Không | Có |
| LadiPage global sidebar | Có theo route shell | Ẩn | Ẩn |

### 4.3 Hợp nhất preview và route thật

- `/facebook-ads/*` là nguồn UI chính duy nhất.
- `/extension-preview/facebook-ads` trở thành dev harness bao quanh chính route/component thật; không tự duy trì router giả và danh sách page riêng.
- `extensionpromax` dùng duy nhất route chính cho production; legacy preview chỉ giữ trong một release rollback rồi xóa.
- Navigation trong iframe dùng App Router; postMessage chỉ dùng cho handshake/capability/context theo contract, không gửi route hoặc command tùy ý.

## 5. Cấu trúc FE đề xuất

```text
src/features/facebook-ads/
├─ api/
│  ├─ facebook-ads.client.ts
│  ├─ query-keys.ts
│  ├─ queries/
│  └─ mutations/
├─ contracts/
│  ├─ view-models.ts
│  └─ schemas.ts
├─ domain/
│  ├─ metrics.ts
│  ├─ validation.ts
│  ├─ permissions.ts
│  └─ surface-policy.ts
├─ connections/
├─ manager/
├─ create-campaign/
├─ drafts/
├─ assets/
├─ reports/
├─ rules/
├─ policy/
├─ activity/
├─ navigation/
├─ shared/
└─ dev-fixtures/               # không import từ production modules

src/app/
├─ (admin)/facebook-ads/...    # route thật
├─ (extension-preview)/extension-preview/facebook-ads/...
└─ api/_bff/facebook-ads/...   # route handler server-only
```

Quy tắc dependency:

- `domain` không import React, browser API hoặc fixture.
- Page/component không tự `fetch`; tất cả đi qua `api`.
- `dev-fixtures` chỉ được load bằng dynamic import sau server-side environment guard.
- Không còn import từ `features/facebook-ads-v2` sau giai đoạn hợp nhất.

## 6. Hợp đồng Next.js BFF

### 6.1 Vai trò

BFF cung cấp payload đúng nhu cầu render, giảm số request từ iframe và giấu chi tiết topology backend. Endpoint gợi ý:

- `GET /api/_bff/facebook-ads/bootstrap`
- `GET /api/_bff/facebook-ads/manager`
- `GET /api/_bff/facebook-ads/assets`
- `GET /api/_bff/facebook-ads/drafts/:id`
- `POST /api/_bff/facebook-ads/drafts/:id/validate`
- `GET /api/_bff/facebook-ads/jobs/:id`

`bootstrap` trả về workspace, entitlement, connection summary, selected ad account, feature flags, surface capability và server time; không trả token Meta.

### 6.2 Yêu cầu an toàn

- Chỉ forward tới origin backend được cấu hình; không nhận URL đích từ request.
- Chuyển tiếp tenant/workspace từ session đã xác minh, không tin `tenantId` ở body/query.
- Mutations dùng CSRF/origin validation và `Idempotency-Key`.
- Timeout ngắn, abort propagation, error mapping ổn định và correlation ID.
- Không cache public response chứa dữ liệu quảng cáo; cache theo tenant/user/ad-account/date-range.
- Redact request/response log; tuyệt đối không log authorization header hoặc Meta payload nhạy cảm.

## 7. Devtool/dev build profile

Trong kế hoạch này, “devtool” được chuẩn hóa thành chế độ phát triển/kiểm thử UI chạy trong web hoặc extension side panel, không phải quyền truy cập Chrome DevTools tùy ý.

### 7.1 Cấu hình

| Biến | Mục đích | Production |
|---|---|---|
| `FACEBOOK_ADS_DEV_PREVIEW_ENABLED` | Cho phép route preview | `false` bắt buộc |
| `FACEBOOK_ADS_FIXTURE_MODE` | `off`, `scenario`, `recorded` | `off` bắt buộc |
| `FACEBOOK_ADS_BFF_ENABLED` | Bật lớp BFF | theo rollout |
| `NEXT_PUBLIC_FACEBOOK_ADS_UI_VERSION` | Theo dõi shell/contract | được phép |

Không dùng biến `NEXT_PUBLIC_*` cho secret, backend token hoặc quyền thực thi.

### 7.2 Scenario cần có

- Chưa kết nối Meta.
- Kết nối hết hạn/cần reauthorize.
- Không có ad account hoặc thiếu quyền.
- Account bình thường có Campaign/Ad Set/Ad.
- Account lớn, cursor pagination và dữ liệu stale.
- Rate limit, partial insights, Meta error có remediation.
- Draft hợp lệ/không hợp lệ.
- Publish đang chạy/thất bại một bước/hoàn thành PAUSED.
- Extension offline, handshake timeout và account context mismatch.

### 7.3 Guard chống lọt mock

- Production build fail nếu `FACEBOOK_ADS_FIXTURE_MODE != off`.
- ESLint/import-boundary cấm production code import `dev-fixtures`.
- UI luôn gắn badge `Dữ liệu mô phỏng` khi provenance là fixture.
- Smoke test production xác nhận preview route trả 404/disabled và bundle không chứa fixture catalog.

## 8. Trình tự triển khai

### FE-0 — Baseline và hợp nhất (3–5 ngày)

- Chốt inventory route/component và tạo ảnh baseline cho desktop, tablet, side panel.
- Hoàn tất xóa cây `facebook-ads-v2`, sửa toàn bộ import/route còn sót.
- Chốt route chính và legacy route với `extensionpromax`.
- Xóa/khóa đường lưu token ở IndexedDB và Graph client trực tiếp bằng feature flag trước khi gỡ hẳn.
- Định nghĩa surface context, shared query keys và error model.

**Gate:** một feature tree; không có màn hình nào phụ thuộc đồng thời mock service và production service mà không có adapter/provenance.

### FE-1 — Shell, embed và dev harness (4–6 ngày)

- Server-derived surface context và capability policy.
- Responsive shell cho 360–480 px, 768 px, 1280 px và full width.
- Hợp nhất preview với route thật; handshake iframe có origin allowlist, nonce và version.
- Dev scenario selector, fixture loader và production build guard.
- Loading/timeout/retry/offline/access denied cho iframe.

**Gate:** cùng một manager render được ở web, side panel và preview; không có navigation local giả.

### FE-2 — Connections và Manager read-only (7–10 ngày)

- Connection state, ad-account selector và provenance/staleness indicator.
- Campaign/Ad Set/Ad hierarchy thật, cursor pagination, filters, date range, compare.
- Column presets, saved views, summary, breakdown, row details và empty/error states.
- URL đồng bộ filter/date/view để deep link được.

**Gate:** dữ liệu API thay được fixture mà component không đổi contract.

### FE-3 — Assets và create/draft (8–12 ngày)

- Asset picker: Page, Instagram, pixel/dataset, event, audience, media.
- Wizard theo objective với schema điều kiện; preview và validation map đúng field.
- Autosave debounced có revision/ETag; xử lý conflict; phục hồi draft.
- Readiness checklist trước publish.

**Gate:** reload/browser crash không mất draft đã sync; không thể publish nếu validation chưa đạt.

### FE-4 — Publish progress và safe mutations (6–9 ngày)

- Publish confirmation, idempotency key, timeline checkpoint và retry/resume.
- Entity mới luôn hiển thị trạng thái `PAUSED`; activation là action riêng có confirm.
- Inline edit status/budget/name, bulk actions và kết quả từng dòng.
- Optimistic UI chỉ dùng cho action có rollback rõ; publish không optimistic.

**Gate:** partial failure không làm UI báo thành công toàn bộ; reload vẫn xem được job.

### FE-5 — Reports, rules, policy và operations (8–12 ngày)

- Saved reports/export, chart/table parity và scheduled report state.
- Rule builder, impact preview, timezone/schedule và history.
- Policy/account quality, permission matrix, activity/audit, notifications/support context.
- Hoàn thiện accessibility, virtualized table và performance budget.

### FE-6 — Clone-gap hardening (liên tục, theo flag)

- Đối chiếu inventory AdsMeta theo luồng, không theo pixel.
- Chỉ triển khai P2 advanced tools sau telemetry cho thấy nhu cầu và backend có policy.
- Mỗi tool phải có owner, API contract, entitlement, audit và kill switch trước khi xuất hiện production.

## 9. Test strategy

| Lớp | Bắt buộc |
|---|---|
| Unit | format metric, permission, validation, filter serialization, surface policy |
| Contract | Zod/OpenAPI fixtures giữa Next BFF và Nest backend |
| Component | table state, wizard conditional field, errors, draft conflict |
| E2E web | connect → manager → draft → validate → publish progress |
| E2E extension | allowlisted iframe, handshake, responsive nav, timeout, account mismatch |
| Visual regression | manager/wizard/connections ở 4 viewport và light/dark nếu hỗ trợ |
| Security | no token in storage/network response, blocked hostile origin/postMessage, CSRF |
| Build | production excludes preview fixtures và legacy route sau cutover |

## 10. Chỉ số chấp nhận

- Không còn request browser trực tiếp tới Meta Graph cho feature Facebook Ads.
- Không còn token/cookie Facebook trong localStorage, sessionStorage hoặc IndexedDB.
- Web và extension dùng chung ít nhất 90% component/domain/API client.
- Route extension tải interactive dưới 3 giây ở p75 sau khi bootstrap đã cache; skeleton hiện dưới 300 ms.
- Manager xử lý account lớn bằng cursor/virtualization, không tải toàn bộ hierarchy một lần.
- 100% mutation có idempotency/correlation ID và trạng thái thành công/thất bại từng entity.
- 100% màn hình P0 có loading, empty, stale, permission denied, rate limit và generic error.
- Production không chứa fixture catalog, scenario selector hoặc mock notice giả mạo dữ liệu thật.

## 11. Rủi ro và cách giảm thiểu

| Rủi ro | Kiểm soát |
|---|---|
| Clone UI kéo theo logic không an toàn | Review theo capability; cấm port generic fetch/private GraphQL |
| Web/extension lệch UI | Một route/feature tree; contract test và visual regression chung |
| Next BFF thành backend thứ hai | Ghi rõ boundary; không credential/queue/webhook; ADR và code ownership |
| Mock lọt production | Build-time guard, import boundary, smoke test |
| Account lớn làm UI treo | Cursor, virtualization, lazy hierarchy, abort stale request |
| Query param giả mạo surface | Surface do server xác lập; query chỉ là hint, backend vẫn authorize |
| Extension CSP/cookie/iframe thay đổi | PKCE/embed session, origin allowlist, timeout/fallback và compatibility matrix |

## 12. Definition of Done Plan 1

- UI gaps P0 và P1 có component thật, contract và trạng thái lỗi đầy đủ.
- `facebook-ads-v2` và router preview giả đã được loại bỏ.
- Next.js fullstack chỉ làm BFF/view-model/SSR/dev harness theo boundary đã chốt.
- Web, extension side panel và dev preview hiển thị cùng feature, khác nhau bằng capability profile.
- Mọi màn hình chuyển được từ fixture sang backend qua adapter mà không viết lại component.
- Không có mã/credential Meta ở client và không có generic Meta proxy ở Next.js.
- Plan 2 cung cấp đủ API/job/event để thay toàn bộ mock P0/P1 của plan này.
