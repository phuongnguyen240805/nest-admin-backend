# Plan UI — Tích hợp Medusa trên LadiPage (app mẹ)

> **Cập nhật:** 2026-07-20  
> **Không code** — inventory UI + design system FE-v2.  
> **Product:** [pro-sales-landing-build-plan.md](./pro-sales-landing-build-plan.md) — **M0 free + RBAC**; **M1 monetize sau**.  
> **App mẹ:** `ladipage-fe-v2`.

---

## 0. Scope UI theo giai

| Wave | UI làm gì | UI **không** làm |
|------|-----------|------------------|
| **M0 (now)** | Catalog online, purpose/bind, publish H3, orders, **RBAC empty/403**, channel health | Pro lock, badge PRO bắt buộc, grace banner, upsell Medusa, required_tier |
| **M1 (sau Medusa ổn)** | ProFeatureLock, upgrade copy, grace 7d, suspend CTA, checklist tier | — |

**Landing** M0 = landing bình thường (quota page hiện có). Không UI “chỉ Pro mới bán”.

---

## 1. Design system app mẹ (bắt buộc bám)

Mọi màn Medusa **không** invent skin Medusa Admin. Copy **Bán hàng** + admin shell.

### 1.1 Token màu

| Token | Giá trị / class | Dùng cho |
|-------|-----------------|----------|
| **Brand primary** | `#65a30d` / `brand-500` | CTA, active nav |
| Brand scale | `brand-25`…`brand-950` | Soft bg, hover |
| Active nav (Sales) | bg `#e5ecff` + text `#65a30d` | Sidebar item |
| Canvas rail | `#f4f4fa` / dark `#13141f` | `SalesSidebar` |
| Text | `slate-800` / `slate-400` uppercase 10px | Hierarchy |
| Border | `gray-200` / dark `gray-800` | Cards |
| Danger | rose / destructive | Lỗi, 403, hết hàng |
| Warn | `amber-*` | Payment chưa cấu hình; **(M1)** grace |
| Success | success/lime soft | Channel healthy, order paid |

**Primary button:** `bg-lime-500` / `hover:bg-brand-600`, `rounded-lg`.  
**Không** purple primary commerce.

### 1.2 Layout shell

```
AppSidebar (Bán hàng = emerald icon) | AppHeader
Module rail SalesSidebar (#f4f4fa)   | Main list/drawer
active: #e5ecff + brand text
```

- Medusa trong `/ban-hang` + entry `/landing-pages`.  
- Drawer: pattern `CreateProductDrawer`.  
- Dark mode parity.

### 1.3 Microcopy M0

- **“Sản phẩm cửa hàng online”** vs **“Sản phẩm cơ bản”** (`lp_product`) — hạn chế nói “Medusa” với user.  
- Thiếu quyền: *“Bạn không có quyền gắn sản phẩm. Liên hệ Owner.”* — **không** *“Nâng cấp Pro”*.  
- M1 mới: *“Bán trên Landing — gói Pro”*.

---

## 2. Inventory — đã có vs thiếu

### 2.1 Reuse

| UI | Việc M0 |
|----|---------|
| App shell, SalesSidebar, ProductsList/Drawer legacy | Giữ free; nhãn “Cơ bản” |
| Landing hub, editor, publish | + purpose/bind |
| ApiState, toasts | Loading/error/403 |
| Platform permissions | Map `commerce:*` |
| Upgrade modal | **Chỉ domain/template… hiện có** — **không** gắn Medusa M0 |

### 2.2 UI M0 — bắt buộc (xây nối Medusa)

#### A. RBAC & states (không billing)

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-05** | **PermissionDeniedState** | Empty/inline khi thiếu `commerce:*` |
| **UI-06** | Toast/banner 403 chuẩn | Message quyền, CTA “Liên hệ quản trị” |

#### B. `/ban-hang` — cửa hàng online

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-10** | SalesSidebar group “Cửa hàng online” | SP online, Đơn online, Cài đặt |
| **UI-11** | Segment **Cơ bản \| Online** | Cả hai mở theo RBAC; **không** lock Pro |
| **UI-12** | MedusaProductsList | List SP channel |
| **UI-13** | MedusaCreateProductDrawer | Tạo SP → Medusa |
| **UI-14** | MedusaEditProductPanel | Sửa SP |
| **UI-15** | ChannelProvisioningState | Lần đầu tạo channel |
| **UI-16** | ChannelHealthBadge | Healthy / error |
| **UI-17** | Empty “Chưa có SP online” | CTA tạo SP |

#### C. Orders online

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-20** | MedusaOrdersList | Đơn + page nguồn |
| **UI-21** | MedusaOrderDetailDrawer | Chi tiết |
| **UI-22** | Filter nguồn (optional) | Cơ bản / Online |

#### D. Landing hub

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-30** | Create purpose wizard | Lead \| Bán \| Hybrid \| Content — **không** 🔒 PRO |
| **UI-31** | Filter chips list | Lead / Bán hàng / Tất cả |
| **UI-32** | Badge row purpose | Lead / Bán / Hybrid |
| **UI-33** | CTA “Tạo trang bán hàng” | Primary brand; **mọi tier** (quota page) |
| **UI-34** | Indicator “Đã gắn SP” | Có bindings |

#### E. Editor bind

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-40** | Palette “Sản phẩm / Mua ngay” | **Không** Pro lock; ẩn/disable nếu không `page:bind` |
| **UI-41** | ProductBlock canvas | Preview + CTA |
| **UI-42** | ProductPickerModal | SP online channel |
| **UI-43** | BindingInspector | Variant, CTA H3 |
| **UI-44** | Permission toast bind | UI-05 style |
| **UI-45** | AI sales slot (optional) | Dashed placeholder |

#### F. Publish

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-50** | PublishCommerceChecklist | Channel, binding, payment warn — **không** dòng Pro |
| **UI-51** | Payment warn amber | Chưa cấu hình cổng |
| **UI-52** | Success + Xem trang / Test mua | |

#### G. Settings

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-60** | CommerceSettings panel | Channel status, region read-only |
| **UI-61** | Payment setup guide | Checklist ops |
| **UI-62** | Staff permission hints | commerce:* (nếu có màn authority) |

#### H. Public runtime

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-70** | BuyNow hydrate | Giá live, hết hàng |
| **UI-71** | Redirect interstitial optional | “Đang chuyển thanh toán…” |
| **UI-72** | Thank-you | |
| **UI-73** | Checkout errors | |

#### I. OfferKit boundary

| ID | UI | Mục đích |
|----|-----|----------|
| **UI-80** | Không dual promo trên H3 sales | |
| **UI-81** | Helper editor: mã giảm online vs OfferKit lead | |

### 2.3 UI M1 — backlog monetize (**không ship M0**)

| ID | UI | Khi nào |
|----|-----|---------|
| **UI-01** | ProFeatureLock | `monetize=true` |
| **UI-02** | GracePeriodBanner (7 ngày) | M1 |
| **UI-03** / **UI-74** | Sales suspended public | Sau grace |
| **UI-04** | Copy plan “Bán trên Landing” | M1 upgrade steps |
| **UI-90** / **UI-91** | Badge PRO app store / upgrade row | M1 |
| Checklist + tier line | Publish “Gói Pro” | M1 |
| Palette 🔒 PRO | Free lock | M1 |

Hook kỹ thuật M0: `commerce.medusa.monetize === false` → mọi nhánh UI-01… không render.

---

## 3. Map UI → phase

| Phase | UI IDs | Ghi chú |
|-------|--------|---------|
| **P0** | 05, 06, 10 (IA) | RBAC only |
| **P1** | 10–17, 11 | Catalog online free |
| **P2** | 30–34, 40–45 | Purpose + bind, no Pro lock |
| **P3** | 50–52, 60–61, 70–73, 80–81 | H3 + checklist no Pro |
| **P4** | 20–22, 62 | Orders |
| **P5** | — | Ổn định; **không** UI-01… |
| **PM/M1** | 01–04, 74, 90–91 | Monetize |
| **Post** | Embedded cart | H1/H2 |

---

## 4. Wireframe M0

### `/ban-hang`

```
[ Cơ bản | Online ]     ← cả hai dùng được nếu đủ RBAC
Online: list SP + health + "Thêm sản phẩm"
Thiếu product:write → PermissionDeniedState (không upsell Pro)
```

### Tạo landing

```
Mục đích: [Thu lead] [Bán sản phẩm] [Cả hai] [Nội dung]
  → không badge PRO trên card Bán
  → vẫn check quota số page nếu có
```

### Editor

```
Palette Sản phẩm
  → có page:bind? drop + picker
  → không? disabled + tooltip quyền
```

### Publish checklist M0

```
✓ Gian hàng online hoạt động
✓ Đã gắn ≥1 sản phẩm
⚠ Cổng thanh toán (warn)
[ Hủy ] [ Xuất bản ]
(không có: ✓ Gói Pro)
```

---

## 5. Sprint UI (M0)

| Sprint | Việc | ~ |
|--------|------|---|
| **U0** | UI-05/06, sidebar IA Online, segment không lock | 3–4 ngày |
| **U1** | UI-12…17 catalog | 1–1.5 tuần |
| **U2** | Wizard + editor bind | 1–1.5 tuần |
| **U3** | Publish + public H3 + OfferKit boundary | 1–1.5 tuần |
| **U4** | Orders | ~1 tuần |
| **UM1** | Chỉ sau sign-off Medusa — lock/grace/upsell | backlog |

---

## 6. QA UI M0

| # | Check |
|---|--------|
| Q1 | Brand/active nav đúng app mẹ |
| Q2 | Free Owner full path sales Medusa (đủ quyền) |
| Q3 | Viewer/không bind: 403 **không** mở upgrade Medusa |
| Q4 | Không badge PRO trên “Bán sản phẩm” / palette |
| Q5 | `monetize=false`: zero ProFeatureLock |
| Q6 | Public không AppSidebar |
| Q7 | OfferKit không double mã H3 |
| Q8 | Dark mode |

---

## 7. Cố ý không làm M0

| Không | Lý do |
|-------|--------|
| Pro paywall Medusa | Chờ M1 |
| Grace/suspend tier | M1 |
| Embed Medusa Admin | Brand |
| Checkout nhúng full | H3 first |
| Dual OfferKit+Medusa cart | D5 |

---

## 8. Tóm tắt

- **M0:** UI đầy đủ nối Medusa + **phân quyền**; landing/sales **free**; design brand `#65a30d` / layout Bán hàng.  
- **M1:** UI trả phí (lock, grace, upsell) **sau** khi Medusa production ổn — flag `monetize`.
