# Kế hoạch pilot Facebook Ads trong Ladipage Extension

> **Ngày lập:** 2026-07-30  
> **Trạng thái:** Prototype UI — auth production và web-session handoff chưa triển khai  
> **Phạm vi:** `extensionpromax` + `ladipage-fe-v2` + `liora-monorepo/apps/ladipage-backend`  
> **Ứng dụng pilot:** `FacebookAds`  
> **Tham chiếu hành vi:** `extension marketing seo và ads/AdsMeta — Facebook Ads Manager`  
> **Ngoài phạm vi:** Logic nghiệp vụ production của các ứng dụng Ladipage khác, SEO extension, automation Facebook và thao tác ghi rủi ro cao. Lưới/preview có thể hiển thị app khác nhưng quyền truy cập dữ liệu production vẫn phải qua runtime auth, tenant và entitlement chung.

---

## 0. Quyết định kiến trúc

Facebook Ads là ứng dụng đầu tiên được đưa vào lưới ứng dụng của extensionpromax để kiểm chứng toàn bộ nền tảng mini-app trước khi mở rộng sang các ứng dụng Ladipage khác.

Các quyết định đã chốt:

1. Backend Ladipage là nguồn sự thật cho auth, tenant, entitlement, quota, policy, action ticket, chuẩn hóa dữ liệu, snapshot và audit.
2. UI Facebook Ads được hiển thị bên trong cửa sổ ứng dụng thống nhất của extensionpromax.
3. Phần UI nghiệp vụ có thể nhúng từ một route riêng của `ladipage-fe-v2`.
4. Extension giữ phần bắt buộc phải chạy trong trình duyệt: nhận biết tab Facebook, đọc phiên Facebook, thực thi request được cho phép và render contextual overlay.
5. Facebook token, cookie, DTSG và các thông tin xác thực tương đương không được gửi sang Ladipage FE hoặc backend.
6. Web UI không được gọi Chrome API trực tiếp và không được điều khiển extension bằng request tổng quát.
7. Mọi command nhạy cảm phải có action ticket ngắn hạn do backend phát hành.
8. Pilot chỉ read-only. Chỉ mở thao tác ghi sau khi pilot vượt qua các cổng nghiệm thu.
9. Không sao chép nguyên mã build/minify của AdsMeta; chỉ tham khảo hành vi và pattern kỹ thuật.
10. Facebook Ads là app đầu tiên dùng runtime auth production. Có thể tiếp tục hiển thị tile/preview của app Ladipage khác, nhưng chưa cho phép dữ liệu production hoặc phát hành rộng app thứ hai cho đến khi luồng auth, tenant, entitlement và revoke của pilot đạt cổng Go.

### Giải thích ranh giới “logic quan trọng nằm ở backend”

Không thể đưa toàn bộ logic Facebook vào backend khi sử dụng phiên Facebook đang đăng nhập trong trình duyệt, vì backend không có cookie và ngữ cảnh tab của người dùng.

Ranh giới đúng là:

- Backend quyết định ai được làm gì, với tenant nào, command nào, quota bao nhiêu và kết quả nào được chấp nhận.
- Extension chỉ thực thi command hẹp trong môi trường trình duyệt.
- Content script chỉ thu thập context cần thiết và render overlay.
- UI chỉ trình bày dữ liệu và thu nhận thao tác người dùng.

Backend là policy owner và business owner; extension là browser executor.

---

## 1. Mục tiêu pilot

Pilot phải chứng minh được một vertical slice hoàn chỉnh:

1. `Facebook Ads` xuất hiện trong lưới ứng dụng extension theo catalog Ladipage.
2. User đăng nhập Ladipage một lần và extension nhận đúng workspace.
3. User có entitlement mới mở được Facebook Ads.
4. Cửa sổ Facebook Ads có UI đồng nhất với extensionpromax.
5. UI nhúng giao tiếp an toàn với extension host.
6. Extension phát hiện được phiên Facebook hiện tại.
7. Backend phát action ticket cho yêu cầu lấy account snapshot.
8. Extension dùng phiên Facebook trong tab để lấy dữ liệu.
9. Dữ liệu nhạy cảm được loại bỏ trước khi rời extension.
10. Backend validate, normalize, persist snapshot và ghi audit.
11. UI hiển thị view model do backend trả về.
12. Contextual overlay xuất hiện đúng trên Ads Manager và Billing.
13. Feature có kill switch độc lập.
14. Extension mất context hoặc Facebook thay đổi không làm hỏng app shell.

### Kết quả cần đạt

Pilot hoàn thành không đồng nghĩa Facebook Ads đã hoàn thiện toàn bộ tính năng. Kết quả mong muốn là xác nhận kiến trúc đủ an toàn và đủ ổn định để tiếp tục:

- Thay dữ liệu mẫu của Facebook Ads bằng dữ liệu thật.
- Bổ sung campaign/ad set/ad read-only.
- Mở từng thao tác ghi có kiểm soát.
- Dùng cùng mini-app runtime cho các ứng dụng Ladipage tiếp theo.

---

## 2. Hiện trạng liên quan

### 2.1. Extensionpromax

Đã có:

- Dock kéo thả.
- Mega menu.
- Cửa sổ tool có minimize/maximize.
- Facebook Tools panel.
- Platform registrar.
- Side panel.

Chưa đáp ứng mini-app runtime:

- Lưới ứng dụng hard-code trong `packages/extension/src/components/dock/MegaMenuPanel.tsx`.
- Ánh xạ tool → component hard-code trong `DraggableDockBar.tsx`.
- `PlatformModuleConfig` chỉ có `id`, `name`, `onInitializeBackground`, `onInitializeContent`.
- Tất cả platform được khởi động đồng loạt.
- Chưa có catalog Ladipage, entitlement, embed session, action ticket hoặc command policy.
- Có nhiều điểm khởi tạo/build cần hợp nhất trước production.
- Manifest đang có quyền rộng hơn nhu cầu của pilot.

### 2.2. Ladipage Facebook Ads

Đã có:

- App registry code `FacebookAds`.
- Các route tài khoản quảng cáo, BM, Fanpage, Manager, Reports, Rules và Tools.
- Service lấy account, BM và Fanpage.
- UI Ads Manager tương đối đầy đủ.

Khoảng trống:

- Ads Manager vẫn dùng dữ liệu mẫu.
- Web client đang trực tiếp làm việc với Facebook access token.
- Facebook auth record cho phép lưu cookie, access token, DTSG và LSD trong IndexedDB.
- Chưa có API extension chuyên biệt.
- Chưa có server-side snapshot chuẩn hóa cho Facebook Ads.

### 2.3. AdsMeta

Các pattern có giá trị:

- Content script isolated world kết hợp MAIN-world injection.
- Phát hiện Facebook session và account switch.
- Thực thi fetch trong tab Facebook thật.
- Contextual sidebar trên Ads Manager/Billing.
- Remote config, version gate và kill switch.
- Xử lý Facebook SPA không reload toàn trang.
- Account snapshot gồm balance, threshold, limits, spend, currency, payment, role, BM và billing date.

Các pattern không được mang sang:

- Generic `FB_FETCH`.
- Generic `GQL_IN_TAB`.
- Cho dashboard web gửi URL/body/header Facebook tùy ý.
- Lưu Facebook token dài hạn trong `chrome.storage.local`.
- Trộn UI, Facebook parsing và business logic trong một file lớn.
- Gửi access token trong URL hoặc message bridge.
- Dùng nguyên packaged/minified source làm source chính.

---

## 3. Phạm vi chức năng

### 3.1. Trong lưới ứng dụng

Tile Facebook Ads hiển thị:

- Tên và icon lấy từ App Store catalog.
- Trạng thái đã cài.
- Trạng thái entitlement.
- Trạng thái kết nối Ladipage.
- Trạng thái phát hiện phiên Facebook.
- Badge contextual khi tab hiện tại là Ads Manager.
- Nút mở mini-app.
- Nút mở Facebook Ads đầy đủ trên Ladipage.

### 3.2. Trong mini-app Facebook Ads

Màn hình Home:

- Ladipage user/workspace.
- Trạng thái extension device session.
- Facebook UID hiện tại.
- Trạng thái Facebook session.
- Tài khoản quảng cáo hiện tại.
- Thời điểm snapshot gần nhất.
- Trạng thái fresh/stale/offline.
- Nút làm mới.
- Nút bật/tắt overlay.
- Nút mở Ads Manager.
- Nút mở full Ladipage Facebook Ads.

Màn hình account snapshot:

- Account name và account ID.
- Account status.
- Balance/dư nợ.
- Billing threshold.
- Daily spending limit.
- Account spending limit.
- Spend today.
- Total spend.
- Currency.
- Timezone.
- Payment method summary.
- Prepay/postpay.
- Owner Business Manager.
- Current user role.
- Created date.
- Next bill date.

### 3.3. Contextual overlay

Overlay xuất hiện tại:

- Ads Manager campaigns.
- Ads Manager ad sets.
- Ads Manager ads.
- Billing account details.
- Billing payment settings.

Overlay không xuất hiện trên các trang Facebook khác trong pilot.

Overlay có:

- Trạng thái account.
- Balance.
- Threshold.
- Limits.
- Spend today/total spend.
- Currency.
- Last updated.
- Refresh.
- Open mini-app.
- Hide overlay.

### 3.4. Ngoài phạm vi pilot

- Account rename.
- Campaign create/duplicate.
- Campaign pause/resume.
- Budget update.
- Media upload.
- BM permission update.
- Share account/page.
- Automation.
- Scheduled background Facebook polling.
- Background action khi không có user intent.
- Telegram/notification assistant.
- Arbitrary Graph API explorer.
- CAPTCHA hoặc account checkpoint automation.

---

## 4. Kiến trúc mục tiêu

```text
┌─────────────────────────────────────────────────────────────┐
│ extensionpromax                                             │
│                                                             │
│ App Grid → App Window → Embedded Facebook Ads UI            │
│                         │                                   │
│                         ├─ iframe bridge                     │
│                         ├─ command router                    │
│                         └─ action ticket verifier            │
│                                                             │
│ Facebook mini-app                                           │
│ background executor ↔ isolated content ↔ MAIN-world probe   │
│                                      │                      │
│                                      └─ contextual overlay  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Ladipage JWT + signed ticket
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ladipage-backend                                            │
│                                                             │
│ Auth · Tenant · App entitlement · Quota · Policy            │
│ Action ticket · Result validation · Normalization           │
│ Snapshot · Audit · Feature flag · Kill switch               │
└──────────────────────────────┬──────────────────────────────┘
                               │ normalized view model
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ladipage-fe-v2                                              │
│                                                             │
│ /extension/facebook-ads                                     │
│ Responsive embedded UI · no desktop shell · no Chrome API   │
└─────────────────────────────────────────────────────────────┘
```

### 4.1. Các surface

| Surface | Owner | Vai trò |
|---|---|---|
| App grid | Extension | Discovery, install state, contextual badge |
| App window/header | Extension | Navigation, theme, close/minimize/fullscreen |
| Embedded content | Ladipage FE | Facebook Ads presentation và user input |
| Native fallback UI | Extension | Connection, permission và fatal error |
| Context overlay | Extension content script | Thông tin nhanh trong Facebook |
| Full application | Ladipage FE | Workflow dài và màn hình desktop |

---

## 5. Luồng xác thực

### 5.1. Ladipage extension session

1. User mở app cần tài khoản Ladipage hoặc chọn “Kết nối Ladipage” trong extension.
2. Extension ưu tiên web authorization bằng Authorization Code + PKCE; device authorization chỉ là fallback.
3. Backend xác thực web session, user và workspace.
4. Backend đăng ký `extension_device`.
5. Extension nhận access token ngắn hạn và refresh mechanism phù hợp.
6. Extension gọi `/api/ext/v1/bootstrap`.
7. Backend trả catalog, entitlement, feature flags và policy version.

Yêu cầu:

- Token Ladipage không dùng chung với Facebook token.
- Logout/revoke trên Ladipage phải vô hiệu extension session.
- Device session gắn với extension install/device ID.
- Workspace switch phải tạo context mới.

### 5.2. Embedded session

Không truyền JWT dài hạn trong URL iframe.

Luồng:

1. Extension tải route `/extension/facebook-ads`.
2. Iframe gửi `APP_READY` kèm nonce.
3. Extension yêu cầu backend cấp embed session.
4. Backend cấp token ngắn hạn, scope `FacebookAds + tenant + device`.
5. Extension gửi token qua `postMessage` tới exact Ladipage origin.
6. Iframe giữ token trong memory.
7. Token hết hạn được refresh thông qua host.

### 5.3. Nguyên tắc dùng cùng tài khoản Ladipage giữa web và extension

Mục tiêu trải nghiệm:

- Người dùng đã đăng nhập Ladipage trên web: mở app trong extension và tiếp tục bằng đúng tài khoản/workspace đó, không phải nhập lại mật khẩu.
- Người dùng chưa đăng nhập: extension mở trang đăng nhập Ladipage ở ngữ cảnh top-level; đăng nhập xong tự quay lại đúng app đang định mở.
- App nhúng chỉ nhận session ngắn hạn đúng `applicationCode + user + tenant + device`, không nhận JWT web.

Không dùng cookie hoặc `localStorage` của iframe làm hợp đồng chia sẻ đăng nhập. Iframe Ladipage chạy dưới extension là cross-site context; third-party cookie blocking và storage partitioning có thể làm trạng thái đăng nhập khác tab web. Token web cũng không được gắn vào URL, query string, `postMessage` hoặc sao chép sang `chrome.storage`.

Hợp đồng production là:

```text
Web session Ladipage (first-party)
  → Authorization Code + PKCE
Extension device session
  → app-scoped embed session
Embedded app
  → Ladipage backend/application services
```

Như vậy dữ liệu trong app nhúng vẫn thuộc cùng `userId/tenantId` đã được backend xác nhận, nhưng ba loại session có phạm vi và vòng đời độc lập.

### 5.4. Luồng đã đăng nhập web nhưng extension chưa có session

1. User mở Facebook Ads từ app grid.
2. Extension không tìm thấy extension device session hợp lệ.
3. Extension tạo:
   - `state` ngẫu nhiên.
   - Nonce.
   - PKCE verifier và `S256 code_challenge`.
   - Install/device ID.
   - `applicationCode`.
   - In-extension return state, ví dụ `FacebookAds/accounts`.
4. Extension gọi `chrome.identity.launchWebAuthFlow` tới route first-party `/extension/authorize`.
5. Route `/extension/authorize` kiểm tra web session Ladipage hiện có.
6. Nếu web session hợp lệ, backend xác nhận user, workspace, entitlement và extension ID; có thể bỏ qua màn hình nhập credential. Nếu user có nhiều workspace thì yêu cầu chọn workspace hoặc xác nhận workspace gần nhất.
7. Backend phát authorization code dùng một lần, TTL 30–60 giây, bind với:
   - Extension ID và redirect URI.
   - PKCE challenge.
   - Install/device ID.
   - User ID và tenant/workspace ID.
   - Application scopes được yêu cầu.
8. Web redirect tới callback đã đăng ký `https://<extension-id>.chromiumapp.org/...`.
9. Extension kiểm tra `state`, sau đó đổi `code + code_verifier` lấy extension device session.
10. Extension gọi `/api/ext/v1/bootstrap`, đối chiếu `subjectId`, `tenantId`, entitlement và `sessionContextVersion`.
11. Extension tạo embed session riêng cho Facebook Ads rồi mới load dữ liệu app.

Kết quả: người dùng đang đăng nhập web không phải nhập lại mật khẩu, nhưng extension không bao giờ đọc hoặc giữ JWT/cookie của web.

### 5.5. Luồng chưa đăng nhập web

1. `/extension/authorize` không tìm thấy web session hợp lệ.
2. Web chuyển sang `/signin` bằng một continuation ID ngắn hạn do backend phát hành.
3. Không truyền raw return URL do client cung cấp. Continuation phải được ký hoặc lưu server-side và bind với `state`, extension ID, redirect URI, PKCE challenge và thời hạn.
4. User đăng nhập trên trang Ladipage top-level như luồng web bình thường.
5. Sau đăng nhập, server tiếp tục đúng authorization request ban đầu.
6. Backend phát authorization code một lần và redirect lại extension callback.
7. Extension đổi code lấy device session, bootstrap đúng tài khoản/workspace và mở lại app user đã chọn.

Không render form đăng nhập trong iframe app vì:

- Có thể bị CSP/X-Frame-Options và chính sách cookie bên thứ ba chặn.
- Captcha/SSO khó hoạt động ổn định trong iframe.
- Khó chứng minh user đang đăng nhập trên origin Ladipage thật.
- Tăng nguy cơ phishing và rò credential.

Nếu user đóng/cancel trang login, extension giữ app ở native state `Đăng nhập Ladipage để tiếp tục` và cho phép thử lại; không tự retry vô hạn.

### 5.6. Fallback device authorization

`chrome.identity.launchWebAuthFlow` là luồng ưu tiên. Với Chromium variant không hỗ trợ ổn định hoặc callback bị chặn, dùng device authorization:

1. Extension gọi `/api/ext/v1/device/start` và nhận `device_code`, `user_code`, verification URL, TTL, polling interval.
2. Extension mở `/extension/connect?user_code=...` ở tab Ladipage top-level.
3. Web dùng session hiện có; nếu chưa có thì login rồi tiếp tục.
4. User xác nhận extension, workspace và scope.
5. Extension poll `/api/ext/v1/device/poll` theo interval cho đến khi được cấp session hoặc hết hạn.

Fallback không gửi web token cho extension và không cho phép polling nhanh hơn server policy.

### 5.7. Token và storage policy

| Thành phần | Lưu ở đâu | TTL/rotation | Điều cấm |
|---|---|---|---|
| Web session | First-party Ladipage session | Theo web auth policy | Không copy sang extension |
| Authorization code | Backend, one-time | 30–60 giây | Không log, không reuse |
| Extension access token | Memory hoặc `chrome.storage.session` | Ngắn hạn, ví dụ 10–15 phút | Không đưa vào URL/iframe |
| Extension refresh credential | `chrome.storage.local` chỉ khi cần duy trì đăng nhập | Opaque, rotating, device-bound, server-revocable | Không dùng JWT web làm refresh token |
| Embed token | Memory của iframe | 5–10 phút hoặc ngắn hơn | Không persist, không chia sẻ app khác |

Mọi refresh phải kiểm tra device status, user status, tenant membership, entitlement, minimum extension version và `sessionContextVersion`.

### 5.8. Đồng bộ account, workspace, logout và revoke

- `bootstrap` là nguồn sự thật của extension cho `subjectId`, `tenantId`, workspace, entitlement và context version.
- Mỗi lần mở app, extension focus lại sau khoảng nghỉ dài hoặc refresh session phải kiểm tra bootstrap/context version.
- Khi workspace đổi:
  1. Backend tăng context version hoặc cấp session family mới.
  2. Extension hủy embed session cũ và cache dữ liệu tenant cũ.
  3. Iframe nhận `WORKSPACE_CHANGED`, dừng request và handshake lại.
  4. Chỉ render dữ liệu sau khi backend xác nhận tenant mới.
- Khi account web đổi, extension so sánh `subjectId + tenantId + sessionContextVersion`. Nếu khác, clear cache app và yêu cầu hoàn tất web authorization lại; không im lặng trộn dữ liệu hai tài khoản.
- Logout/revoke Ladipage làm refresh extension thất bại hoặc thu hồi session family; extension phát `SESSION_EXPIRED` tới iframe và chuyển về native login state.
- “Ngắt kết nối extension” chỉ revoke device hiện tại; không bắt buộc logout toàn bộ web.
- Backend phải có màn hình/dịch vụ quản lý thiết bị để user xem và revoke extension session.

### 5.9. Dùng cùng dữ liệu tài khoản trong app nhúng

Embed token không chứa hoặc cho phép client tự chọn tenant tùy ý. Backend lấy `userId`, `tenantId`, device và app scope từ claims/server session, sau đó gọi lại application service hiện có của Ladipage.

Mỗi API của app nhúng phải kiểm tra:

- Authentication và session status.
- User còn thuộc tenant/workspace.
- `applicationCode` đúng app đang mở.
- Entitlement/quota/feature flag.
- Device và minimum extension version nếu endpoint chỉ dành cho extension.
- Resource thuộc cùng tenant.

Không sao chép business logic của Facebook Ads hoặc app Ladipage khác sang extension. Extension/iframe chỉ có presentation, browser executor cần thiết và adapter; logic nghiệp vụ, phân quyền và dữ liệu vẫn ở backend Ladipage.

### 5.10. Ghi chú chuyển tiếp từ auth hiện tại

Auth hiện tại của `ladipage-fe-v2` rehydrate phần lớn trạng thái từ `localStorage` và dùng cookie `ladipage-session` để hỗ trợ server requests. Cách này có thể tiếp tục cho web top-level trong giai đoạn đầu, nhưng không được xem là cơ chế chia sẻ session với extension.

Việc build production cần:

1. Tạo first-party authorization route có thể xác nhận web session hiện tại và gọi backend phát code.
2. Dùng continuation ID ký/lưu server-side thay vì tin vào raw `redirect` query.
3. Allowlist chính xác extension ID, callback URI và Ladipage origins theo môi trường.
4. Ưu tiên backend-set cookie `HttpOnly + Secure + SameSite=Lax` hoặc server session tương đương cho web session production.
5. Không chuyển token từ Zustand/localStorage sang extension, kể cả qua `window.postMessage`.
6. Viết migration/compatibility path để user web đang có session hợp lệ không bị buộc logout hàng loạt khi rollout.

---

## 6. Luồng action ticket

### 6.1. Read snapshot

```text
Embedded UI
  → POST create action intent
Backend
  → validate auth/tenant/entitlement/quota/command
  → issue signed one-time ticket
Embedded UI
  → REQUEST_ACTION(ticket) qua iframe bridge
Extension host
  → validate schema, origin, nonce
  → verify ticket với backend hoặc local signature contract
Facebook executor
  → find eligible Facebook tab
  → execute allowlisted request
  → remove token/cookie/DTSG/headers/private fields
Extension
  → POST action result
Backend
  → validate result
  → normalize
  → persist snapshot
  → write audit
Embedded UI
  → fetch/render normalized view model
```

### 6.2. Ticket properties

- One-time use.
- TTL 30–60 giây.
- Gắn `userId`.
- Gắn `tenantId`.
- Gắn `deviceId`.
- Gắn `applicationCode = FacebookAds`.
- Gắn command cụ thể.
- Gắn allowed arguments.
- Có nonce.
- Có idempotency key.
- Không chứa Facebook credential.
- Không chấp nhận đổi URL, HTTP method hoặc body sau khi phát hành.

### 6.3. Pilot command allowlist

- `facebook.session.status`
- `facebook.account.current`
- `facebook.account.list`
- `facebook.account.snapshot`
- `facebook.overlay.enable`
- `facebook.overlay.disable`

Command dự kiến cho phase sau, chưa kích hoạt:

- `facebook.account.rename`
- `facebook.campaign.list`
- `facebook.campaign.status.set`
- `facebook.campaign.budget.set`
- `facebook.campaign.duplicate`

---

## 7. Data security

### 7.1. Dữ liệu không được rời extension

- Facebook cookie.
- Access token.
- DTSG.
- LSD.
- `c_user` cookie raw.
- Request headers chứa credential.
- HTML Facebook nguyên bản.
- Raw response chưa lọc có trường nhạy cảm.

### 7.2. Dữ liệu được phép gửi backend

- Facebook user ID đã chuẩn hóa nếu có user consent.
- Ad account ID.
- Account name.
- Account status.
- Currency/timezone.
- Balance/threshold/limit.
- Spend aggregates.
- Payment method summary không chứa số thẻ đầy đủ.
- Owner business ID/name.
- Role summary.
- Snapshot timestamp.
- Adapter version.
- Error code đã chuẩn hóa.

### 7.3. Nguyên tắc lưu trữ

- Facebook credential chỉ ở memory hoặc session-scoped storage.
- Không dùng `localStorage`/IndexedDB của web để lưu Facebook credential.
- Không dùng `chrome.storage.local` để giữ Facebook token dài hạn.
- Khi service worker mất state, extension reacquire từ tab Facebook theo user intent.
- Snapshot backend có retention policy.
- Audit không log raw payload hoặc token.

---

## 8. UI hòa làm một

### 8.1. Extension sở hữu

- App window.
- Header.
- Back/close/minimize/maximize.
- App icon và title.
- Workspace context.
- Theme.
- Locale.
- Loading/error boundary.
- Connection banner.
- Open full app.

### 8.2. Ladipage embedded UI sở hữu

- Account selector.
- Snapshot cards.
- Billing summary.
- Empty state.
- Refresh intent.
- Detail presentation.
- Link sang các màn hình full app được cho phép.

### 8.3. Extension layout contract

Route nhúng phải:

- Không render Ladipage global sidebar.
- Không render Ladipage desktop header.
- Không tự render close/minimize/fullscreen.
- Responsive từ 380px đến 600px.
- Dùng một scroll container.
- Không tạo modal vượt khỏi frame.
- Hỗ trợ light/dark theme.
- Hỗ trợ locale từ extension.
- Hỗ trợ reduced motion.
- Có skeleton riêng.
- Không tự điều hướng top window.

### 8.4. Bridge message allowlist

- `APP_READY`
- `SET_THEME`
- `SET_LOCALE`
- `RESIZE`
- `OPEN_FULL_APP`
- `REQUEST_ACTION`
- `ACTION_ACCEPTED`
- `ACTION_PROGRESS`
- `ACTION_RESULT`
- `ACTIVE_TAB_CHANGED`
- `FACEBOOK_SESSION_CHANGED`
- `AUTH_REQUIRED`
- `AUTH_RESOLVED`
- `WORKSPACE_CHANGED`
- `SESSION_EXPIRED`

Mỗi message phải validate:

- `event.origin`.
- `event.source`.
- `applicationCode`.
- Bridge version.
- Session nonce.
- Payload schema.
- Capability.

---

## 9. API dự kiến

### 9.1. Extension platform API

| Method | Endpoint | Vai trò |
|---|---|---|
| GET | `/extension/authorize` | First-party web route kiểm tra web session và tiếp tục authorization |
| POST | `/api/ext/v1/oauth/token` | Đổi one-time code + PKCE verifier lấy extension device session |
| POST | `/api/ext/v1/device/start` | Khởi tạo device authorization fallback |
| POST | `/api/ext/v1/device/poll` | Poll trạng thái device authorization theo server interval |
| POST | `/api/ext/v1/device/refresh` | Refresh extension session |
| POST | `/api/ext/v1/device/revoke` | Thu hồi device session |
| GET | `/api/ext/v1/bootstrap` | User, workspace, catalog, entitlement, flags |
| POST | `/api/ext/v1/embed-sessions` | Cấp embedded UI session ngắn hạn |
| POST | `/api/ext/v1/action-tickets` | Phát one-time action ticket |
| POST | `/api/ext/v1/actions/:ticketId/result` | Nhận executor result |
| GET | `/api/ext/v1/actions/:ticketId` | UI lấy trạng thái action |
| POST | `/api/ext/v1/events` | Telemetry đã lọc |

### 9.2. Facebook Ads API

| Method | Endpoint | Vai trò |
|---|---|---|
| GET | `/api/ext/v1/facebook/session-status` | Trạng thái kết nối đã chuẩn hóa |
| GET | `/api/ext/v1/facebook/accounts` | Account list từ snapshot |
| GET | `/api/ext/v1/facebook/accounts/:id/snapshot` | Snapshot gần nhất |
| GET | `/api/ext/v1/facebook/accounts/:id/history` | Lịch sử snapshot theo policy |
| POST | `/api/ext/v1/facebook/accounts/:id/refresh-intents` | Tạo refresh intent |

### 9.3. Backend guards bắt buộc

- Authentication guard.
- Authorization code one-time/TTL/PKCE validation.
- Extension ID và redirect URI allowlist.
- Tenant/workspace guard.
- Application entitlement guard.
- Device session guard.
- Session context version guard.
- Extension version guard.
- Action ticket guard.
- Command policy guard.
- Quota/rate-limit guard.
- Result schema validation.
- Idempotency/replay guard.

---

## 10. Data model dự kiến

### 10.1. `extension_device`

- Device/install ID.
- User ID.
- Tenant/workspace ID.
- Extension ID.
- Extension version.
- Status.
- Last seen.
- Revoked at.
- Created/updated timestamps.

### 10.2. `extension_session`

- Session ID.
- Device ID.
- User ID.
- Tenant ID.
- Scope.
- Session family ID.
- Session context version.
- Rotating refresh credential hash.
- Expires at.
- Revoked at.
- Created timestamp.

### 10.3. `extension_authorization_code`

- Code hash; không lưu raw code.
- Extension ID và redirect URI.
- Device/install ID.
- User ID và tenant/workspace ID.
- PKCE challenge và method `S256`.
- Requested application scopes.
- State/continuation reference hash.
- Expires/consumed/revoked timestamps.

Authorization code là one-time, TTL 30–60 giây và phải được consume atomically.

### 10.4. `extension_device_code`

- Device code hash và user code hash.
- Extension ID và install/device ID.
- Requested application scopes.
- Requested/approved user và tenant.
- Polling interval.
- Status.
- Expires/approved/consumed timestamps.

### 10.5. `extension_action_ticket`

- Ticket ID.
- Device/user/tenant.
- Application code.
- Command.
- Arguments hash.
- Idempotency key.
- Status.
- Issued/expires/consumed timestamps.
- Result reference.

### 10.6. `extension_action_audit`

- Ticket ID.
- Actor.
- Tenant.
- Device.
- Command.
- Target type/ID.
- Result status.
- Normalized error.
- Duration.
- Adapter version.
- Created timestamp.

### 10.7. `facebook_account_snapshot`

- Tenant ID.
- Facebook user ID.
- Ad account ID.
- Account name/status.
- Currency/timezone.
- Balance.
- Billing threshold.
- Daily/account limits.
- Spend today/total.
- Payment summary.
- Account type.
- Owner business ID/name.
- User role.
- Created/next bill date.
- Captured at.
- Adapter version.
- Quality/freshness status.

Không có credential columns trong các bảng trên.

---

## 11. Cấu trúc source dự kiến

### 11.1. Extensionpromax

```text
extensionpromax/
└── packages/
    └── extension/
        └── src/
            ├── shell/
            │   ├── app-grid/
            │   │   ├── AppGrid.tsx
            │   │   ├── AppTile.tsx
            │   │   ├── InstalledApps.tsx
            │   │   └── ContextualApps.tsx
            │   └── app-window/
            │       ├── AppWindow.tsx
            │       ├── AppHeader.tsx
            │       ├── EmbeddedAppFrame.tsx
            │       ├── NativeAppHost.tsx
            │       └── AppErrorBoundary.tsx
            │
            ├── mini-app-runtime/
            │   ├── catalog/
            │   │   ├── catalog-client.ts
            │   │   ├── catalog-cache.ts
            │   │   └── catalog-types.ts
            │   ├── auth/
            │   │   ├── extension-auth.ts
            │   │   ├── web-auth-flow.ts
            │   │   ├── pkce.ts
            │   │   ├── auth-callback.ts
            │   │   ├── device-session.ts
            │   │   ├── device-code-fallback.ts
            │   │   ├── session-context.ts
            │   │   └── embed-session.ts
            │   ├── bridge/
            │   │   ├── iframe-bridge.ts
            │   │   ├── message-schema.ts
            │   │   ├── origin-policy.ts
            │   │   └── session-nonce.ts
            │   ├── commands/
            │   │   ├── command-router.ts
            │   │   ├── command-policy.ts
            │   │   ├── action-ticket.ts
            │   │   └── action-result.ts
            │   ├── lifecycle/
            │   │   ├── app-loader.ts
            │   │   ├── app-session.ts
            │   │   ├── app-kill-switch.ts
            │   │   └── app-telemetry.ts
            │   └── permissions/
            │       ├── permission-manager.ts
            │       └── host-permissions.ts
            │
            ├── mini-apps/
            │   └── facebook-ads/
            │       ├── manifest.ts
            │       ├── capabilities.ts
            │       ├── routes.ts
            │       ├── contracts.ts
            │       ├── background/
            │       │   ├── register.ts
            │       │   ├── facebook-command-executor.ts
            │       │   ├── facebook-session-manager.ts
            │       │   ├── facebook-tab-manager.ts
            │       │   └── sensitive-data-filter.ts
            │       ├── content/
            │       │   ├── register.ts
            │       │   ├── facebook-context.ts
            │       │   ├── facebook-route-observer.ts
            │       │   └── isolated-bridge.ts
            │       ├── main-world/
            │       │   └── facebook-session-probe.ts
            │       ├── overlay/
            │       │   ├── FacebookAccountOverlay.tsx
            │       │   ├── OverlayMount.tsx
            │       │   ├── overlay-controller.ts
            │       │   └── overlay-styles.css
            │       ├── native-ui/
            │       │   ├── FacebookConnectionState.tsx
            │       │   ├── FacebookPermissionPrompt.tsx
            │       │   └── FacebookUnavailable.tsx
            │       └── adapters/
            │           ├── account-snapshot.adapter.ts
            │           ├── account-list.adapter.ts
            │           ├── billing.adapter.ts
            │           └── facebook-response-sanitizer.ts
            │
            └── legacy/
                └── platforms/
                    └── facebook/
```

Lưu ý:

- Không mở rộng trực tiếp `platforms/facebook` cũ thành Facebook Ads.
- Facebook Tools cũ được giữ nguyên trong quá trình pilot.
- Mini-app mới dùng namespace riêng.
- Chỉ migration legacy sau khi pilot ổn định.

### 11.2. Ladipage frontend

```text
ladipage-fe-v2/
└── src/
    ├── app/
    │   ├── (extension-auth)/
    │   │   └── extension/
    │   │       ├── authorize/
    │   │       │   └── page.tsx
    │   │       └── connect/
    │   │           └── page.tsx
    │   └── (extension)/
    │       └── extension/
    │           ├── layout.tsx
    │           └── facebook-ads/
    │               ├── page.tsx
    │               ├── accounts/
    │               │   └── page.tsx
    │               └── account/
    │                   └── [accountId]/
    │                       └── page.tsx
    │
    └── features/
        ├── extension-embed/
        │   ├── components/
        │   │   ├── ExtensionAppLayout.tsx
        │   │   ├── ExtensionLoadingState.tsx
        │   │   └── ExtensionErrorState.tsx
        │   ├── bridge/
        │   │   ├── extension-host.client.ts
        │   │   ├── extension-message.types.ts
        │   │   └── extension-session.client.ts
        │   └── hooks/
        │       ├── useExtensionHost.ts
        │       ├── useExtensionTheme.ts
        │       └── useExtensionAction.ts
        │
        ├── extension-auth/
        │   ├── clients/
        │   │   └── extension-authorization.client.ts
        │   ├── continuation/
        │   │   └── extension-continuation.ts
        │   └── components/
        │       ├── ExtensionConsent.tsx
        │       └── ExtensionWorkspacePicker.tsx
        │
        └── facebook-ads/
            └── extension/
                ├── components/
                │   ├── FacebookAdsHome.tsx
                │   ├── FacebookSessionStatus.tsx
                │   ├── ExtensionAccountSelector.tsx
                │   ├── AccountSnapshotCard.tsx
                │   └── BillingSummary.tsx
                ├── hooks/
                │   ├── useFacebookSnapshot.ts
                │   └── useFacebookAction.ts
                ├── services/
                │   └── facebook-extension-api.client.ts
                └── view-models/
                    └── facebook-account-snapshot.vm.ts
```

### 11.3. Ladipage backend

```text
liora-monorepo/
├── apps/
│   └── ladipage-backend/
│       └── src/
│           └── modules/
│               ├── extension/
│               │   ├── controllers/
│               │   │   ├── extension-bootstrap.controller.ts
│               │   │   ├── extension-catalog.controller.ts
│               │   │   ├── extension-authorization.controller.ts
│               │   │   ├── extension-device-code.controller.ts
│               │   │   ├── extension-session.controller.ts
│               │   │   └── extension-action.controller.ts
│               │   ├── services/
│               │   │   ├── extension-device.service.ts
│               │   │   ├── extension-authorization-code.service.ts
│               │   │   ├── extension-device-code.service.ts
│               │   │   ├── extension-pkce.service.ts
│               │   │   ├── extension-web-session-handoff.service.ts
│               │   │   ├── extension-session.service.ts
│               │   │   ├── extension-catalog.service.ts
│               │   │   ├── extension-entitlement.service.ts
│               │   │   ├── extension-action-ticket.service.ts
│               │   │   ├── extension-audit.service.ts
│               │   │   └── extension-feature-flag.service.ts
│               │   ├── dto/
│               │   ├── guards/
│               │   ├── entities/
│               │   └── repositories/
│               │
│               └── facebook-ads/
│                   ├── controllers/
│                   │   └── facebook-extension.controller.ts
│                   ├── services/
│                   │   ├── facebook-action-policy.service.ts
│                   │   ├── facebook-result-validator.service.ts
│                   │   ├── facebook-account-normalizer.service.ts
│                   │   ├── facebook-snapshot.service.ts
│                   │   └── facebook-quota.service.ts
│                   ├── dto/
│                   ├── entities/
│                   │   ├── facebook-account-snapshot.entity.ts
│                   │   └── facebook-action-audit.entity.ts
│                   └── repositories/
│
└── libs/
    └── extension-contracts/
        └── src/
            ├── catalog/
            ├── bridge/
            ├── actions/
            └── facebook-ads/
                ├── commands.ts
                ├── payloads.ts
                ├── results.ts
                └── view-models.ts
```

`extension-contracts` là nguồn contract duy nhất. Không tạo ba bản type độc lập cho backend, FE và extension.

---

## 12. Permission strategy

Pilot chỉ yêu cầu domain:

- Ladipage application origin.
- Ladipage API origin.
- `www.facebook.com`.
- `business.facebook.com`.
- `adsmanager.facebook.com`.
- Các Facebook Graph/upload origin thực sự cần cho command read-only đã duyệt.

Nguyên tắc:

- Dùng permission `identity` cho `chrome.identity.launchWebAuthFlow`; callback URI phải khớp extension ID theo từng môi trường.
- Chỉ allowlist Ladipage authorization/API origins và callback chính xác.
- Không dùng `externally_connectable` cho auth nếu PKCE callback/device flow đã đáp ứng; chỉ thêm khi có use case được threat-model riêng.
- Không dùng `<all_urls>` cho riêng Facebook Ads pilot.
- Xin optional host permission khi user mở Facebook Ads lần đầu nếu khả thi.
- Không xin `cookies` nếu flow không thực sự cần Chrome Cookies API.
- Không mở `webRequest` chỉ để proxy Facebook.
- Mỗi permission phải map tới capability và có giải thích trong UI.

---

## 13. Error model

Backend trả normalized error code, không phụ thuộc message nội bộ Facebook:

- `LADIPAGE_AUTH_REQUIRED`
- `LADIPAGE_LOGIN_REQUIRED`
- `AUTHORIZATION_CANCELLED`
- `AUTHORIZATION_CODE_EXPIRED`
- `AUTHORIZATION_STATE_MISMATCH`
- `PKCE_VERIFICATION_FAILED`
- `WEB_SESSION_CHANGED`
- `WORKSPACE_SELECTION_REQUIRED`
- `EXTENSION_SESSION_REVOKED`
- `EMBED_SESSION_EXPIRED`
- `APP_NOT_ENTITLED`
- `EXTENSION_UPDATE_REQUIRED`
- `FACEBOOK_PERMISSION_REQUIRED`
- `FACEBOOK_TAB_REQUIRED`
- `FACEBOOK_LOGIN_REQUIRED`
- `FACEBOOK_ACCOUNT_NOT_FOUND`
- `FACEBOOK_SESSION_CHANGED`
- `FACEBOOK_CHECKPOINT`
- `ACTION_TICKET_EXPIRED`
- `ACTION_TICKET_REPLAYED`
- `ACTION_NOT_ALLOWED`
- `FACEBOOK_RESPONSE_INVALID`
- `FACEBOOK_RATE_LIMITED`
- `FEATURE_TEMPORARILY_DISABLED`
- `SNAPSHOT_STALE`

UI map error code sang copy thân thiện. Raw Facebook error chỉ lưu trong protected diagnostic với redaction policy.

---

## 14. Telemetry và vận hành

Theo dõi tối thiểu:

- App open success/failure.
- Web session reused/login required.
- Authorization success/cancel/failure theo normalized reason.
- Account/workspace/session-context mismatch.
- Embedded session success/failure.
- Facebook session detection success.
- Action ticket issued/rejected/expired/replayed.
- Snapshot success/failure/duration.
- Adapter version.
- Facebook route/context.
- Overlay mount/unmount failure.
- Account switch detection.
- Service worker restart recovery.

Không telemetry:

- Cookie.
- Token.
- HTML trang.
- Form input.
- Full Facebook raw response.
- Payment card data.

Remote config cần hỗ trợ:

- Kill switch toàn Facebook Ads.
- Kill switch từng command.
- Disable overlay.
- Minimum extension version.
- Adapter rollout percentage.
- Pilot tenant/user allowlist.
- Emergency message.

---

## 15. Các phase triển khai

### P0 — Baseline và quyết định cuối

**Ước tính:** 3–5 ngày

Nội dung:

- Chọn một pipeline build extension.
- Xác định extension ID cho development/staging/production.
- Chốt Ladipage origins.
- Chốt extension ID/callback URI cho dev, staging và production.
- Chốt web authorization + PKCE là primary flow và device authorization là fallback.
- Chốt session TTL, rotation, revoke và account/workspace context policy.
- Chốt migration từ auth web hiện tại sang first-party authorization handoff.
- Chốt permission matrix.
- Chốt command contract read-only.
- Chốt snapshot field allowlist.
- Chốt threat model.
- Chốt ownership/license của source tham khảo AdsMeta.
- Lập test matrix theo loại Facebook account.

Deliverables:

- Architecture decision record.
- Permission matrix.
- Command catalog.
- Snapshot schema.
- Threat model.
- Auth/session sequence diagram và callback/continuation allowlist.
- Token storage/rotation/revoke matrix.
- Build baseline.

Go/No-Go:

- Build pipeline duy nhất được chấp nhận.
- Không còn mơ hồ về credential boundary.
- Không còn phụ thuộc iframe cookie/localStorage để nhận diện web login.
- Có staging extension ID và staging Ladipage origin.

### P1 — Mini-app runtime vertical slice

**Ước tính:** 2–3 tuần

Nội dung:

- Catalog/entitlement trong bootstrap.
- Tile Facebook Ads trong app grid.
- App window thống nhất.
- Embedded iframe host.
- Web-session handoff qua Authorization Code + PKCE.
- Top-level login fallback và signed/server-side continuation.
- Device authorization fallback.
- Device session, rotating refresh và revoke.
- Account/workspace/session-context synchronization.
- Embedded session.
- Versioned iframe bridge.
- Native error/loading/permission states.
- `facebook.session.status` vertical slice.

Deliverables:

- User mở Facebook Ads từ app grid.
- User đã login web mở app không phải nhập lại credential và nhận đúng workspace.
- User chưa login được đưa tới trang login Ladipage top-level, sau đó quay lại đúng app.
- UI nhúng hiển thị đúng theme.
- Backend nhận đúng user/tenant/device.
- UI hiển thị kết nối Facebook hoặc hướng dẫn mở tab.

Go/No-Go:

- Không double header/double scroll.
- Iframe origin/message validation đạt test.
- State/PKCE/code TTL/replay/callback allowlist đạt security test.
- Không có web token/cookie trong extension storage, iframe URL hoặc bridge message.
- Account/workspace đổi không hiển thị cache/data của context cũ.
- User không entitlement bị backend chặn.
- Revoke session có hiệu lực.

### P2 — Account snapshot read-only

**Ước tính:** 2–3 tuần

Nội dung:

- MAIN-world session probe.
- Isolated bridge.
- Facebook tab manager.
- Account ID/context detection.
- Account snapshot executor.
- Sensitive data filter.
- Action ticket.
- Backend result validator/normalizer.
- Snapshot persistence.
- Embedded account UI.
- Manual refresh.
- Account switch detection.

Deliverables:

- Snapshot thật cho account đang mở.
- Snapshot được backend chuẩn hóa và lưu.
- UI không còn phụ thuộc token Facebook.
- Không credential nào xuất hiện trong FE/backend.

Go/No-Go:

- ≥90% snapshot success trong test matrix hợp lệ.
- Ticket giả/hết hạn/replay bị chặn.
- Không token/cookie/DTSG trong network log Ladipage.
- Account switch không dùng snapshot sai user.

### P3 — Contextual overlay parity

**Ước tính:** 1–2 tuần

Nội dung:

- URL/context matcher.
- Facebook SPA route observer.
- Overlay mount isolation.
- Account summary overlay.
- Billing page placement.
- Theme/locale.
- Fresh/stale/offline states.
- Refresh/open mini-app/hide actions.
- Overlay kill switch.

Deliverables:

- Overlay hoạt động tại Ads Manager/Billing.
- Không phá layout chính.
- Rời route hợp lệ thì overlay tự ẩn.

Go/No-Go:

- Không duplicate overlay qua SPA navigation.
- Không làm tăng đáng kể lỗi trang Facebook.
- Kill switch có hiệu lực mà không cần store release.

### P4 — Facebook Ads read-only integration

**Ước tính:** 2–3 tuần

Nội dung:

- Account list.
- BM summary.
- Fanpage summary.
- Campaign/ad set/ad read-only.
- Metrics cơ bản.
- Snapshot history.
- Thay dữ liệu mẫu trong Ads Manager theo từng phần.
- Full-app deep link.

Deliverables:

- Ladipage Facebook Ads dùng dữ liệu thật ở phạm vi đã duyệt.
- Extension và full app hiển thị cùng backend view model.

Go/No-Go:

- Không còn hai nguồn dữ liệu cạnh tranh.
- Snapshot stale được biểu diễn rõ.
- Backend quota/rate limit hoạt động.

### P5 — Pilot và hardening

**Ước tính:** 2 tuần

Pilot:

- 10–30 user nội bộ/được chọn.
- Nhiều loại account: personal, BM-owned, prepay, postpay, restricted.
- Nhiều currency/timezone.
- Account switch.
- Facebook logout/login.
- Checkpoint.
- Service worker restart.
- Extension update.
- Network offline/reconnect.
- Backend deploy/restart.
- Entitlement revoke.

Deliverables:

- Pilot report.
- Error distribution.
- Performance report.
- Security verification.
- Chrome Web Store permission review.
- Go/No-Go proposal cho write actions hoặc app tiếp theo.

---

## 16. Tiêu chí nghiệm thu pilot

### Functional

- Facebook Ads xuất hiện theo backend catalog.
- Entitlement quyết định được mở app.
- Web đã login: extension nhận đúng `subjectId/tenantId` qua authorization handoff mà không hỏi lại credential.
- Web chưa login: user đăng nhập top-level rồi quay lại đúng app/deep link.
- Device-flow fallback hoạt động khi web auth callback không khả dụng.
- Embedded UI mở đúng trong app window.
- Extension phát hiện đúng Facebook session.
- Account snapshot hiển thị đúng.
- Overlay hoạt động trên route được phép.
- Account switch không dùng nhầm snapshot.
- Full-app deep link hoạt động.

### Security

- Facebook credential không rời extension.
- JWT/cookie/localStorage token của Ladipage web không được copy sang extension hoặc iframe.
- Authorization code one-time, TTL ngắn, bind extension ID/redirect URI/device và PKCE.
- `state` và signed/server-side continuation chống CSRF/open redirect.
- Extension refresh credential opaque, rotating, device-bound và revoke được.
- Embed token bind đúng user/tenant/device/app và chỉ giữ trong memory.
- Web UI không truy cập Chrome API.
- Không có arbitrary fetch/script bridge.
- Backend kiểm tra tenant và entitlement ở mọi API.
- Ticket one-time, TTL ngắn và chống replay.
- Audit đủ cho mọi action.
- Logs và telemetry không chứa credential.
- CORS dùng allowlist phù hợp.

### Reliability

- Mini-app lỗi không làm sập app grid.
- Facebook adapter lỗi không làm sập extension shell.
- Service worker restart tự phục hồi.
- Login bị cancel/timeout trở về native auth state, không tạo retry loop.
- Web logout/revoke làm extension session hết hiệu lực trong SLA đã chốt.
- Account/workspace switch hủy embed session và cache context cũ.
- Stale snapshot không được hiển thị như realtime.
- Kill switch hoạt động.
- Có rollback adapter/config.

### UX

- Mở lại app p95 dưới 1,5 giây trong điều kiện warm/cache.
- UI hoạt động tốt ở 380–600px.
- Một app header duy nhất.
- Một scroll container chính.
- Loading/error/empty states rõ ràng.
- Trạng thái `Đăng nhập Ladipage để tiếp tục` mở login ở tab/window top-level, không nhúng form login.
- Login thành công trả user về đúng mini-app và màn hình dự định mở.
- Quyền trình duyệt được giải thích trước khi xin.

### Pilot thresholds

- Snapshot success ≥90% trên phiên Facebook hợp lệ trong test matrix.
- App/iframe handshake success ≥99%.
- Web-session reuse success ≥99% với web session hợp lệ trong test matrix.
- Không có cross-account/cross-tenant data exposure.
- Không có security finding mức critical/high.
- Không có credential leak.
- Không có action ghi Facebook.
- Tỷ lệ crash extension liên quan pilot ở mức chấp nhận được theo baseline.

### Auth test matrix bắt buộc

- Web đã login một tài khoản/một workspace.
- Web đã login một tài khoản/nhiều workspace.
- Web chưa login; login thành công, thất bại, cancel và timeout.
- Web đổi account trong khi extension còn session cũ.
- Web/extension đổi workspace khi iframe đang mở.
- User bị xóa khỏi workspace hoặc mất entitlement.
- Extension session bị revoke từ web và từ backend admin.
- Authorization code hết hạn, bị replay hoặc dùng sai PKCE verifier.
- Callback sai extension ID/redirect URI và `state` mismatch.
- Third-party cookies bị chặn hoàn toàn.
- Service worker restart giữa auth flow và embed handshake.
- Browser restart với refresh credential hợp lệ, hết hạn và bị revoke.
- `chrome.identity` không khả dụng để xác nhận device authorization fallback.

---

## 17. Quyết định sau pilot

### Go — mở Facebook write actions

Chỉ khi:

- Security gates đạt.
- Read-only ổn định.
- Adapter có cơ chế version/kill switch.
- Audit và idempotency đạt.
- Product xác nhận nhu cầu.

Thứ tự write actions dự kiến:

1. Account rename.
2. Campaign pause/resume.
3. Campaign budget update.
4. Campaign duplicate.
5. Campaign creation.
6. BM/permission operations — đánh giá riêng, không mặc định triển khai.

Mỗi action phải có:

- Explicit confirmation.
- Backend action policy.
- One-time ticket.
- Idempotency.
- Before/after audit.
- Normalized result.
- Rollback/compensation strategy nếu khả thi.

### Go — đưa app Ladipage thứ hai vào

Chỉ khi mini-app runtime chứng minh:

- Catalog động ổn định.
- UI nhúng đồng nhất.
- Embedded auth an toàn.
- Error isolation tốt.
- Permission model mở rộng được.
- Backend entitlement/quota thực sự hoạt động.

Ứng dụng thứ hai nên là app ít quyền trình duyệt, ví dụ Site Metrics hoặc OfferKit, để kiểm chứng khả năng tái sử dụng runtime mà không thêm browser adapter phức tạp.

### No-Go hoặc chuyển hướng

Chuyển hướng sang official Facebook OAuth/backend provider nếu:

- Browser-session adapter quá dễ vỡ.
- Facebook checkpoint/rate limit cao.
- Chrome Web Store không chấp nhận permission/behavior.
- Rủi ro tài khoản người dùng không thể kiểm soát.
- Internal Facebook API thay đổi với tần suất không thể vận hành.

---

## 18. Rủi ro và biện pháp

| Rủi ro | Mức | Biện pháp |
|---|---:|---|
| Facebook internal API/DOM thay đổi | Cao | Adapter versioning, contract test, kill switch |
| Token leak qua log/message | Critical | Memory/session only, redaction, network inspection |
| Web UI điều khiển extension quá rộng | Critical | Command allowlist, ticket, origin/nonce/schema validation |
| Dùng nhầm account sau khi user switch | Cao | Bind snapshot với Facebook UID + account ID + session check |
| Chrome Web Store permission review | Cao | Permission minimization, optional permissions, disclosure |
| Iframe auth bị ảnh hưởng third-party cookie | Cao | Embed token qua secure bridge, không phụ thuộc cookie |
| Tưởng web login có thể dùng trực tiếp trong iframe/extension | Critical | First-party authorization handoff; không copy cookie/localStorage/JWT |
| CSRF, code interception hoặc open redirect ở login return | Critical | `state`, PKCE S256, one-time code, exact callback allowlist, signed/server-side continuation |
| Account/workspace web thay đổi nhưng extension còn cache cũ | Critical | `subjectId + tenantId + sessionContextVersion`, invalidate embed session/cache trước khi render |
| Extension device credential bị lấy cắp | Cao | Opaque rotating credential, device binding, short access TTL, server revoke và anomaly detection |
| Chromium variant không hoàn tất callback | Trung bình | Device authorization fallback với polling interval/expiry |
| UI nhúng không đồng nhất | Trung bình | ExtensionLayout contract, shared tokens, visual QA |
| Backend entitlement/quota chưa hoàn thiện | Cao | P1 bắt buộc hoàn thiện trước Facebook data |
| Hai nguồn contract drift | Cao | `libs/extension-contracts` làm source duy nhất |
| Hai pipeline build extension | Cao | P0 chọn một pipeline |
| Packaged AdsMeta không phải source sạch | Cao | Chỉ tham khảo behavior, xác nhận license/ownership |

---

## 19. Checklist trước khi bắt đầu code

- [ ] Xác nhận tên sản phẩm extension sau khi tích hợp Ladipage.
- [ ] Xác nhận extension production ID.
- [ ] Xác nhận staging/production Ladipage origins.
- [ ] Xác nhận pipeline build duy nhất.
- [ ] Xác nhận catalog source-of-truth.
- [ ] Xác nhận Authorization Code + PKCE là primary auth flow.
- [ ] Xác nhận extension ID và exact callback URI cho từng môi trường.
- [ ] Xác nhận top-level login và signed/server-side continuation flow.
- [ ] Xác nhận device authorization fallback.
- [ ] Xác nhận token TTL/storage/rotation/revoke policy.
- [ ] Xác nhận account/workspace switch và session-context invalidation policy.
- [ ] Xác nhận web logout/revoke SLA đối với extension.
- [ ] Xác nhận migration/compatibility với web session hiện tại.
- [ ] Xác nhận embedded auth flow.
- [ ] Xác nhận Facebook snapshot field allowlist.
- [ ] Xác nhận permission matrix.
- [ ] Xác nhận retention policy snapshot/audit.
- [ ] Xác nhận pilot users.
- [ ] Xác nhận Chrome Web Store disclosure.
- [ ] Xác nhận ownership/license của source tham khảo AdsMeta.
- [ ] Xác nhận không triển khai write actions trong pilot.
- [ ] Xác nhận Go/No-Go owner sau P5.

---

## 20. Ước tính tổng

| Phase | Ước tính |
|---|---:|
| P0 — Baseline | 3–5 ngày |
| P1 — Mini-app runtime vertical slice + auth handoff | 2–3 tuần |
| P2 — Account snapshot | 2–3 tuần |
| P3 — Contextual overlay | 1–2 tuần |
| P4 — Read-only integration | 2–3 tuần |
| P5 — Pilot/hardening | 2 tuần |

Với 2 người extension/frontend, 1 backend và QA tham gia theo phase:

- Vertical slice để đánh giá kiến trúc: khoảng 3–5 tuần.
- Pilot read-only hoàn chỉnh: khoảng 9–13 tuần.
- Write actions không nằm trong ước tính trên.

---

## 21. Definition of Done của tài liệu này

Tài liệu này được coi là đủ để bắt đầu triển khai khi:

- Product chấp nhận phạm vi pilot read-only.
- Backend, FE và extension đồng thuận ranh giới logic.
- Security chấp nhận credential boundary.
- Auth team chấp nhận PKCE, callback/continuation allowlist, rotation/revoke và workspace context contract.
- Danh sách fields, commands và permissions được duyệt.
- P0 checklist có owner và deadline.
- App Ladipage khác chỉ ở mức tile/preview; production data access tiếp tục bị gate cho đến khi runtime auth pilot đạt cổng Go.
