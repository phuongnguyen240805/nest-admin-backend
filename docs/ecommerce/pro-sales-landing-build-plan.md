# Plan — Landing bán hàng Medusa (free trước, monetize sau)

> **Cập nhật:** 2026-07-20  
> **Không code** — product + delivery plan.  
> **Tham chiếu FE:** `ladipage-fe-v2`  
> **Tham chiếu kiến trúc:** `docs/ecommerce/*`  
> **UI inventory:** [medusa-ui-inventory-plan.md](./medusa-ui-inventory-plan.md)

---

## 0. Chiến lược rollout (chốt mới)

### Nguyên tắc

| Giai đoạn | Tên | Medusa / sales landing | Billing tier | Phân quyền staff |
|-----------|-----|------------------------|--------------|------------------|
| **Now → GA kỹ thuật** | **M0 – Open build** | **Mọi org được dùng** (kể cả free) | **Không** gate Pro | **Có** RBAC `commerce:*` |
| **Sau khi Medusa chạy ổn production** | **M1 – Monetize** | Giữ full cho Pro+ (hoặc theo policy lúc đó) | Bật gate tier + grace + upsell UI | Giữ RBAC |

**Landing page** trong M0:

- Vẫn là landing **bình thường** (quota page / domain / AI như hiện tại — **không** thêm “phải Pro mới tạo page sales”).
- Có thể `pagePurpose=lead` **hoặc** `sales` / hybrid **không** bị chặn bởi `subscriptionTier`.
- Publish sales + checkout Medusa: **mở** khi channel + binding + permission đủ.

**Trả phí Medusa sau này (M1)** — *không triển khai UI/gate billing trong M0*, chỉ **chừa hook** (feature flag / permission namespace) để bật sau:

- `commerce.medusa.sales_landing` minTier=pro (design sẵn, **flag off**)
- Upsell modal, grace 7 ngày, badge PRO — **backlog M1**

### Vì sao làm vậy

1. Ưu tiên **nối và chạy ổn Medusa** (channel, SP, bind, H3 checkout, webhook).  
2. Tránh block dev/test/pilot bằng paywall.  
3. Monetize khi đã có value thật + metric.  
4. Vẫn cần **RBAC** ngay: Owner/Admin/Editor/Viewer không cùng quyền gắn SP / hoàn tiền.

---

## 0.1 Quyết định product (cập nhật)

| # | Chủ đề | **Now (M0)** | **Later (M1)** — sau Medusa ổn |
|---|--------|--------------|--------------------------------|
| **D0** | Ai được dùng Medusa sales | **Mọi tier** (free/pro/enterprise) | **Pro+ only** (hoặc policy mới) |
| **D1** | Legacy `lp_product` | **Free** — giữ nguyên | Free (không đổi) |
| **D2** | Sales landing + Medusa | **Free mở** (không paywall) | Chuyển sang trả phí / Pro |
| **D3** | Checkout GA | **H3 redirect** | H3; sau đó H1/H2 nhúng |
| **D4** | Hết hạn gói × sales | **Không áp** (chưa monetize sales) | Grace **7 ngày** rồi tắt CTA |
| **D5** | OfferKit × cart | **Không double-discount** cart (Medusa only trên cart) | Giữ; map OfferKit→Medusa promo optional |
| **D6** | Phân quyền staff | **Bắt buộc ngay** `commerce:*` | Giữ + tinh chỉnh |

### Ma trận quyền M0 (chỉ RBAC + app lifecycle — **không** tier)

```
L1 Billing tier     ── TẮT (coi như pass với mọi subscriptionTier)
L2 App / feature    Ecommerce active (optional soft) + commerce.medusa enabled (env/flag kỹ thuật)
L3 RBAC             commerce:product:*, commerce:page:bind, commerce:order:*  ← CHÍNH
L4 Data scope       org → Medusa sales channel
```

**Ví dụ M0:**

| User | Tier | Role | Tạo SP Medusa | Gắn SP landing | Publish sales | Checkout khách |
|------|------|------|---------------|----------------|---------------|----------------|
| Owner free | free | owner | ✓ | ✓ | ✓ | ✓ (nếu page published) |
| Editor free | free | editor + `page:bind` | tuỳ product:write | ✓ | tuỳ publish | — |
| Viewer free | free | viewer | ✗ | ✗ | ✗ | — |
| Staff pro không có bind | pro | editor no bind | ✗ product | ✗ bind | — | — |

Landing free vẫn chịu **quota số page / domain / AI** như hôm nay — đó là billing SaaS **đã có**, **không** phải “phí Medusa”.

---

## 1. Định vị sản phẩm theo giai

### 1.1 M0 — Đang xây / GA kỹ thuật (hiện tại)

| Tính năng | Free org | Ghi chú |
|-----------|----------|---------|
| Landing lead / content | ✓ | Bình thường |
| Landing sales + bind Medusa | ✓ | Không upsell Pro |
| SP Medusa + channel | ✓ | RBAC |
| Checkout H3 | ✓ | |
| `lp_product` legacy | ✓ | |
| Form CRM | ✓ | |
| Gate `subscriptionTier >= pro` cho Medusa | **Không** | M1 |

### 1.2 M1 — Monetize (sau khi Medusa production ổn)

Chỉ khi checklist M1-ready (mục 9) đạt:

| Capability | Policy đề xuất (giữ từ plan cũ) |
|------------|----------------------------------|
| Sales landing Medusa | Pro+ |
| Grace hết Pro | 7 ngày |
| Free chạm sales Medusa | Upsell modal |
| Legacy lp_product | Vẫn free |

**Không** implement M1 UI/gate cho đến khi product/eng sign-off “Medusa ổn”.

### 1.3 Hai plane tiền (không đổi)

| Plane | Ai trả | Hệ | M0 |
|-------|--------|-----|-----|
| A. SaaS LadiPage | Merchant | Nest Billing | Page quota, domain Pro, AI… như hiện tại |
| B. Đơn hàng SP | Khách | Medusa checkout | Hoạt động khi publish sales |

M1 chỉ thêm: **được phép bật path B (sales landing)** theo tier — không gộp 2 plane.

---

## 2. Hiện trạng FE-v2 (điểm bám) — điều chỉnh cột “chưa có”

| Khu | Đã có | M0 cần | M1 (sau) |
|-----|-------|--------|----------|
| Landing hub | List/create/AI/editor | purpose, bindings, filter | — |
| Access | tier domain/template Pro | **`commerce` RBAC only** cho sales | `canUseMedusaSales` + tier |
| Billing / upgrade | modal Pro | **Không** gắn Medusa | Copy + lock UI |
| `/ban-hang` | legacy products | tab/online Medusa | badge Pro optional |
| Editor | blocks | product block + picker | lock Free |
| Publish | SEO soft | checklist commerce (không check Pro) | + check Pro/grace |
| RBAC | platform permissions | **`commerce:*`** | giữ |

---

## 3. Luồng hoạt động M0 (free + RBAC)

### 3.1 Happy path (org free cũng được)

```
[A] (Optional) Cài/bật Ecommerce app — không check Pro
[B] Lần đầu mở Cửa hàng online → provision Sales Channel org
[C] /ban-hang: user có commerce:product:write → tạo "Serum A" (Medusa)
[D] /landing-pages: tạo page (quota page như thường)
    purpose = lead | sales | hybrid  (không chặn tier)
[E] Editor: user có commerce:page:bind → gắn Serum A
[F] Publish (user có quyền publish) → checklist channel + binding
[G] Khách: H3 redirect checkout Medusa
[H] Webhook → orders UI (user có commerce:order:read)
```

### 3.2 RBAC chặn (không liên quan gói)

```
Viewer mở “Gắn sản phẩm”
  → thiếu commerce:page:bind → 403 / toast
  → KHÔNG hiện “Nâng cấp Pro”
```

### 3.3 M1 (tương lai) — chỉ sketch

```
Free + sales Medusa path
  → L1 fail → openUpgradePlanModal
Pro hết hạn → grace 7d → tắt CTA
```

---

## 4. Luồng nghiệp vụ chi tiết (M0)

Giữ các bước 0–8 kỹ thuật như trước, **bỏ** “Pro gate” ở mọi bước:

| Bước | Nội dung | Gate M0 |
|------|----------|---------|
| 0 Entitlement | Flag kỹ thuật Medusa on; app ecommerce optional | **Không** tier |
| 1 Provision channel | 1 lần / org | RBAC manage hoặc auto on first product write |
| 2 Tạo SP | UI LadiPage → BFF → Medusa | `commerce:product:write` |
| 3 Tạo landing | purpose sales/lead | Page quota SaaS hiện có; **không** Pro-Medusa |
| 4 Gắn SP | bindings | `commerce:page:bind` |
| 5 Checkout config | H3 | Settings + payment warn |
| 6 Publish | checklist | publish permission; channel; binding |
| 7 Runtime khách | Store / redirect | Public |
| 8 Sau mua | webhook, orders | `commerce:order:read` |

---

## 5. Plan delivery theo phase (chỉnh lại)

### Phase P0 — Nền + RBAC (≈ 3–5 ngày) — **không paywall**

| ID | Work |
|----|------|
| P0-1 | Permission keys: `commerce:product:read/write`, `commerce:page:bind`, `commerce:order:read/refund`, `commerce:store:manage` |
| P0-2 | Map role mặc định: Owner/Admin full; Editor bind+read; Viewer read-only/none |
| P0-3 | FE: hook `useCommerceAccess` — **chỉ RBAC** (tier check stub `return true` hoặc flag `MONETIZE_MEDUSA=false`) |
| P0-4 | BE: guard API commerce theo permission + org channel (không check pro tier) |
| P0-5 | **Không** ship ProFeatureLock cho Medusa; **không** required_tier trên path sales |
| P0-6 | Feature flag `commerce.medusa.enabled` (ops) + `commerce.medusa.monetize` **default false** |

**Exit:** Staff thiếu quyền bị chặn; free org **vẫn** vào được path nếu có quyền.

---

### Phase P1 — Channel + product CRUD Medusa (≈ 1.5–2.5 tuần)

| ID | Work |
|----|------|
| P1-1…P1-7 | Như plan cũ (provision, facade, list/drawer, health) |
| P1-x | Mọi API: RBAC + channel scope; **skip** billing tier |

**Exit:** Free Owner tạo Serum A OK.

---

### Phase P2 — Landing purpose + bind (≈ 1.5–2 tuần)

| ID | Work |
|----|------|
| P2-1…P2-6 | purpose, wizard, block, picker, filter |
| P2-x | Palette **không** lock Pro; chỉ ẩn/disable theo `page:bind` |

**Exit:** Free Editor (+bind) gắn SP lên landing.

---

### Phase P3 — Publish + checkout H3 (≈ 1.5–2 tuần)

| ID | Work |
|----|------|
| P3-1…P3-6 | checklist **không** có dòng “Gói Pro” |
| P3-7 | D5 OfferKit: không double promo cart |
| P3-8 | Checklist: channel, binding, payment warn, permission publish |

**Exit:** Org free publish sales → khách checkout test OK.

---

### Phase P4 — Orders + CRM optional (≈ 1 tuần)

Không đổi — RBAC order:read.

---

### Phase P5 — Ổn định production (≈ 3–5 ngày) — **vẫn chưa monetize**

| ID | Work |
|----|------|
| P5-1 | Observability, retry webhook, runbook |
| P5-2 | Load/smoke E2E free+pro org |
| P5-3 | Docs ops Medusa payment |
| P5-4 | **Không** bật grace/upsell trừ khi `monetize=true` |

**Exit = “Medusa chạy thành công”** → điều kiện vào M1.

---

### Phase **PM / M1** — Monetize (chỉ sau P5 sign-off)

| ID | Work |
|----|------|
| PM-1 | Bật `commerce.medusa.monetize=true` (config) |
| PM-2 | `canUseMedusaSalesLanding` = pro+ |
| PM-3 | UI-01 lock, UI-90/91 badge, upgrade copy |
| PM-4 | Grace 7 ngày (D4) + UI-02/03 |
| PM-5 | Publish checklist + public CTA theo tier |
| PM-6 | Communication: free users đang dùng sales → notice trước X ngày |

**Thứ tự:** P0–P5 xong **mới** PM. Không xen PM vào P1–P3.

---

### Phase P6 — Embedded cart H1/H2 (sau GA kỹ thuật / sau hoặc song song M1)

Không chặn M0.

---

## 6. Phụ thuộc

```
P0 RBAC + flag monetize=false
  → P1 Channel + SP
    → P2 Purpose + bind
      → P3 Publish + H3
        → P4 Orders/webhook
          → P5 Production stable
            → [GATE] Sign-off Medusa OK
              → PM Monetize (Pro)
```

---

## 7. Acceptance M0 (bắt buộc)

| # | Scenario | Kỳ vọng |
|---|----------|---------|
| A1 | Org **free**, Owner: tạo SP Medusa | OK |
| A2 | Org free, Owner: landing sales + bind + publish | OK (trong quota page) |
| A3 | Org free, Viewer: gắn SP | **403** — message quyền, **không** “Nâng cấp Pro” |
| A4 | Editor không `page:bind` | Không picker |
| A5 | Checkout không gọi `/billing/subscribe` | Pass |
| A6 | Org khác không thấy SP | Channel isolation |
| A7 | OfferKit không stack cart sales | Pass |
| A8 | `monetize=false`: không UI lock Pro Medusa | Pass |

### Acceptance M1 (sau này)

| # | Scenario | Kỳ vọng |
|---|----------|---------|
| B1 | Free + monetize on: path sales | Upsell |
| B2 | Pro: full | OK |
| B3 | Hết Pro + grace 7d / sau D7 | Theo D4 |

---

## 8. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| Free dùng Medusa “mãi” trước M1 | Chấp nhận pilot; PM có notice + grandfather policy |
| Quên bật RBAC | P0 exit criteria cứng |
| Lỡ ship Pro lock sớm | Flag `monetize` default false; code review |
| Nhầm quota page với phí Medusa | Copy rõ: giới hạn số page ≠ khóa Medusa |

---

## 9. Checklist “Medusa chạy thành công” → mới mở M1

- [ ] Provision channel ổn định multi-org  
- [ ] CRUD SP + bind + publish H3 E2E  
- [ ] Payment test → order + webhook  
- [ ] Không data leak cross-org  
- [ ] RBAC verified  
- [ ] On-call runbook  
- [ ] Product sign-off written  

---

## 10. Tài liệu liên quan

| Doc | Ghi chú |
|------|---------|
| [medusa-ui-inventory-plan.md](./medusa-ui-inventory-plan.md) | UI M0 vs M1 |
| [tenancy-rbac.md](./tenancy-rbac.md) | Channel + permission (L1 billing = later) |
| [payments-billing.md](./payments-billing.md) | 2 plane — M1 chỉ gate path sales |
| [decisions.md](./decisions.md) | ADR monetize deferred |

---

## 11. Tóm tắt một câu

> **Hiện tại:** Medusa + landing sales **mở free** như landing bình thường; **chỉ phân quyền staff** + channel isolation; checkout H3; không Pro lock.  
> **Sau khi Medusa production ổn:** bật **M1 monetize** (Pro+, grace 7 ngày, upsell) — không chặn phase xây nối bây giờ.
