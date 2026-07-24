# Kết quả sau triển khai (M0) + cấu trúc source code mục tiêu

> **Cập nhật:** 2026-07-20  
> **Wave:** M0 — Medusa free + RBAC; monetize = M1 sau.  
> **Không code** — mô tả deliverable & tree `src` đề xuất bám monorepo hiện tại.

---

## 1. Kết quả đạt được sau khi triển khai M0

### 1.1 Người dùng (merchant staff)

| Hạng mục | Trước | Sau M0 |
|----------|--------|--------|
| Catalog | Chỉ `lp_product` (legacy) trên `/ban-hang` | + **Cửa hàng online**: tạo/sửa SP Medusa qua UI LadiPage |
| Landing | Lead/content/AI; không bind commerce chuẩn | Page có **purpose** lead/sales/hybrid; **gắn SP** online vào block |
| Publish | HTML/domain/SEO soft | Sales page: checklist channel + binding; CTA **Mua ngay** |
| Checkout | Không (hoặc path legacy) | Khách **redirect H3** → thanh toán Medusa → order |
| Đơn hàng | Order legacy | + **Đơn online** (Medusa) list/detail |
| Phân quyền | Chung ecom/landing | **RBAC commerce:** product write, page bind, order read… |
| Gói Pro | — | **Không** khóa Medusa (M0); free cũng bán được nếu đủ quyền |

### 1.2 Khách cuối (public)

- Vào landing sales đã publish → thấy giá/tồn (hydrate) → **Mua ngay** → cổng thanh toán Medusa → thank-you.  
- Không cần tài khoản LadiPage.  
- Lead form (nếu hybrid/lead) vẫn về CRM như cũ.

### 1.3 Hệ thống / kỹ thuật

| Thành phần | Kết quả |
|------------|---------|
| Multi-tenant | Mỗi org LadiPage ↔ 1 Medusa **Sales Channel** |
| Control plane | Nest BFF: Admin Medusa (product, channel, webhook) |
| Data plane | Store API: cart/checkout public (H3) |
| Source of truth sales | Medusa product/order; landing chỉ **binding + snapshot** |
| Legacy | `ecom-store` / `lp_product` **vẫn chạy free** song song |
| Landing AI / CMS | Không vỡ; sales = metadata + block thêm |
| Billing SaaS | Không đụng checkout hàng; quota page như cũ |
| Flag | `commerce.medusa.enabled`; `commerce.medusa.monetize=false` |
| Observability | Log provision, checkout fail, webhook order |

### 1.4 API / surface chính (conceptual)

| Method / area | Việc |
|---------------|------|
| `POST/GET …/commerce/store` | Provision/health channel |
| `CRUD …/commerce/products` | SP Medusa (RBAC) |
| `GET …/commerce/orders` | Đơn online (RBAC) |
| `POST …/commerce/webhooks/medusa` | order.paid → bridge |
| `POST …/commerce/storefront/session` | Bootstrap public (publishable + channel) |
| Landing metadata | `page_purpose`, `commerce_engine`, `commerce_bindings` (Supabase page hoặc side table) |
| Public | CTA → Medusa checkout URL |

### 1.5 Acceptance “xong M0”

- [ ] Free Owner: SP → bind → publish → khách checkout test  
- [ ] Viewer thiếu quyền: 403, không upsell Pro  
- [ ] Org A không thấy SP org B  
- [ ] Cart không gọi `/billing/subscribe`  
- [ ] Legacy `/ban-hang` Cơ bản vẫn dùng  
- [ ] Webhook tạo/hiện đơn online  

### 1.6 Chưa có sau M0 (cố ý)

- Paywall Pro / grace 7 ngày / badge PRO Medusa  
- Cart nhúng in-page (H1/H2)  
- Dual OfferKit + Medusa promo trên cart  
- Embed Medusa Admin  

---

## 2. Kết quả wave M1 (sau này — tham chiếu)

Khi `monetize=true`: free bị chặn path sales Medusa; Pro full; grace 7d; upsell UI.  
Legacy `lp_product` vẫn free.

---

## 3. Cấu trúc source code mục tiêu

Bám pattern module hiện có: Nest `apps/ladipage-backend/src/modules/*`, FE `features/*` + `components/*` + `lib/endpoints/*`.

### 3.1 Backend — `liora-monorepo/apps/ladipage-backend`

#### Module mới (chính)

```
src/modules/commerce/                    # hoặc medusa-bridge/
├── commerce.module.ts
├── commerce.config.ts                   # MEDUSA_URL, keys, flags monetize/enabled
├── controllers/
│   ├── commerce-store.controller.ts     # provision, health, settings
│   ├── commerce-products.controller.ts
│   ├── commerce-orders.controller.ts
│   ├── commerce-storefront.controller.ts  # public/session bootstrap (rate-limit)
│   └── commerce-webhook.controller.ts
├── dto/
│   ├── create-commerce-product.dto.ts
│   ├── update-commerce-product.dto.ts
│   ├── list-products.query.dto.ts
│   └── storefront-session.dto.ts
├── entities/
│   ├── commerce-store-link.entity.ts    # orgId ↔ salesChannelId, status
│   ├── commerce-order-projection.entity.ts  # optional mirror read-model
│   └── index.ts
├── guards/
│   ├── commerce-enabled.guard.ts
│   └── commerce-permission.guard.ts     # commerce:* (không check Pro ở M0)
├── clients/
│   ├── medusa-admin.client.ts
│   └── medusa-store.client.ts
├── services/
│   ├── commerce-store.service.ts        # provision channel, health
│   ├── commerce-product.service.ts      # facade CRUD
│   ├── commerce-order.service.ts
│   ├── commerce-webhook.service.ts      # order.paid → CRM optional
│   ├── commerce-storefront.service.ts
│   └── commerce-access.service.ts       # RBAC + flag monetize stub
├── mappers/
│   ├── commerce-product.mapper.ts       # Medusa → facade DTO
│   └── commerce-order.mapper.ts
└── types/
    ├── commerce-product.types.ts
    ├── commerce-binding.types.ts        # shared shape binding (doc/DTO)
    └── index.ts
```

#### Wire vào app

```
src/app/app.module.ts
  → imports: […, CommerceModule]

# Giữ nguyên, không phá:
src/modules/ecom-store/          # legacy lp_product
src/modules/landing-ai/
src/modules/landing-cms/
src/modules/publish/
src/modules/crm/
src/modules/payment/             # SaaS billing only
```

#### Extend nhẹ (không module mới)

```
src/modules/publish/publish.service.ts
  # optional: validate sales checklist server-side

src/modules/app-store/application-access.config.ts
  # permission keys commerce:* ; monetize later

libs/nest-core/…/billing|permissions   # nếu permission map tập trung
```

#### Types package (optional)

```
libs/ladipage-types/src/commerce/   # hoặc apps/.../libs/api-types
  product.types.ts
  order.types.ts
  store-link.types.ts
```

#### Test

```
src/modules/commerce/**/*.spec.ts
test/contract/commerce-*.contract.spec.ts
```

---

### 3.2 Frontend — `ladipage-fe-v2`

#### Feature domain mới

```
src/features/commerce/
├── types/
│   ├── product.ts
│   ├── order.ts
│   ├── store.ts
│   └── binding.ts
├── api/                             # hoặc chỉ dùng lib/endpoints
│   └── (thin re-exports)
├── hooks/
│   ├── useCommerceAccess.ts         # RBAC only M0; monetize stub
│   ├── useCommerceStore.ts          # health / provision
│   ├── useCommerceProducts.ts
│   ├── useCommerceProductMutations.ts
│   ├── useCommerceOrders.ts
│   └── useStorefrontSession.ts      # public nếu gọi từ client
├── components/                      # hoặc đặt dưới components/sales/online/
│   ├── PermissionDeniedState.tsx
│   ├── ChannelHealthBadge.tsx
│   ├── ChannelProvisioningState.tsx
│   ├── MedusaProductsList.tsx
│   ├── MedusaCreateProductDrawer.tsx
│   ├── MedusaEditProductPanel.tsx
│   ├── MedusaOrdersList.tsx
│   ├── MedusaOrderDetailDrawer.tsx
│   ├── EngineSegment.tsx            # Cơ bản | Online
│   └── CommerceSettingsPanel.tsx
└── utils/
    ├── commerce-permissions.ts
    └── format-money.ts
```

#### API client

```
src/lib/endpoints/
├── ecom.api.ts                      # legacy — giữ
└── commerce.api.ts                  # MỚI — products, orders, store, session

src/lib/access/
├── landing-access.ts                # giữ
└── commerce-access.ts               # MỚI — canBindProduct, canWriteProduct; isMonetizeEnabled()=>false

src/lib/mappers/
└── commerce.mapper.ts

src/lib/query-keys.ts                # + commerce keys
```

#### UI Bán hàng (extend layout hiện có)

```
src/components/sales/
├── sidebar/SalesSidebar.tsx         # + group Cửa hàng online
├── products/…                       # legacy — giữ
├── orders/…                         # legacy — giữ
└── online/                          # MỚI — re-export từ features/commerce/components
    ├── index.ts
    └── …

src/app/(admin)/ban-hang/page.tsx    # segment Cơ bản | Online; mount list online
```

#### Landing

```
src/features/landing-pages/
├── hooks/useLandingAccess.ts        # không Pro-Medusa M0
├── components/                      # optional
│   ├── CreateLandingPurposeWizard.tsx
│   ├── LandingPurposeBadge.tsx
│   └── LandingPurposeFilters.tsx
└── …

src/components/landing-pages/
├── editor/                          # existing editor tree
│   ├── blocks/
│   │   └── ProductBuyBlock.tsx      # MỚI
│   ├── commerce/
│   │   ├── ProductPickerModal.tsx
│   │   └── BindingInspector.tsx
│   └── …
└── …

# Metadata page (Supabase types / storage)
src/components/landing-pages/editor/core/
  editor-supabase-storage.ts         # + page_purpose, commerce_engine, commerce_bindings
```

#### Publish + public runtime

```
src/features/landing-publish/
├── services/
│   └── commerce-publish-checklist.ts  # MỚI
└── …

src/features/commerce-runtime/         # MỚI — public CTA (không admin chrome)
├── BuyNowButton.tsx
├── checkout-redirect.ts
└── thank-you-types.ts

# Public page route (tùy chỗ render hiện tại)
src/app/p/… hoặc publish renderer
  → mount BuyNow khi engine=medusa + bindings
```

#### App shell

```
src/layout/AppSidebar.tsx            # Bán hàng path giữ; không app Medusa top-level
src/config/app-registry.ts           # Ecommerce vẫn /ban-hang
```

#### Tests FE

```
src/lib/access/commerce-access.test.ts
src/features/commerce/hooks/*.test.ts
src/features/landing-publish/…/commerce-publish-checklist.test.ts
```

---

### 3.3 Docs (đã có / mở rộng)

```
liora-monorepo/docs/ecommerce/
├── README.md
├── hybrid-architecture.md
├── product-source-of-truth.md
├── landing-page-modes.md
├── payments-billing.md
├── tenancy-rbac.md
├── impact-compatibility.md
├── decisions.md                     # + ADR-009 M0 free
├── pro-sales-landing-build-plan.md  # M0/M1 delivery
├── medusa-ui-inventory-plan.md
└── outcomes-and-src-structure.md    # file này
```

---

### 3.4 Sơ đồ phụ thuộc module

```
                    ┌─────────────────────┐
                    │  ladipage-fe-v2      │
                    │  features/commerce  │
                    │  landing + sales UI │
                    └──────────┬──────────┘
                               │ HTTP JWT
                    ┌──────────▼──────────┐
                    │  ladipage-backend   │
                    │  modules/commerce   │
                    └─────┬─────────┬─────┘
              Admin API   │         │ Store / webhook
                    ┌─────▼──┐  ┌───▼────┐
                    │ Medusa │  │ Medusa │
                    │ Admin  │  │ Store  │
                    └────────┘  └────────┘

  ecom-store (legacy) ── song song, không dual-write
  landing_pages (Supabase) ── bindings metadata
  crm ── optional webhook person
  payment/billing ── SaaS only
```

---

## 4. Mapping UI ID → path code (M0)

| UI ID | Path gợi ý |
|-------|------------|
| UI-05/06 | `features/commerce/components/PermissionDeniedState.tsx` |
| UI-10/11 | `components/sales/sidebar/SalesSidebar.tsx` + `EngineSegment` |
| UI-12–14 | `features/commerce/components/Medusa*` |
| UI-15/16 | `ChannelProvisioningState`, `ChannelHealthBadge` |
| UI-20/21 | `MedusaOrdersList`, `MedusaOrderDetailDrawer` |
| UI-30–34 | `features/landing-pages/components/*Purpose*` |
| UI-40–44 | `components/landing-pages/editor/…/Product*` |
| UI-50–52 | `features/landing-publish/…/commerce-publish-checklist` |
| UI-60/61 | `CommerceSettingsPanel` |
| UI-70–73 | `features/commerce-runtime/*` |
| UI-01… Pro | **không** tạo file M0; backlog M1 |

---

## 5. Tóm tắt

**Sau M0:** Merchant (mọi gói, đủ RBAC) quản SP Medusa trên LadiPage, gắn vào landing, publish, khách checkout H3; legacy ecom + lead landing giữ nguyên; multi-tenant bằng sales channel.

**Src:** một module Nest `commerce/` (BFF Medusa) + FE `features/commerce` + extend `sales`/`landing-pages`/`landing-publish` + `lib/endpoints/commerce.api.ts` + access RBAC — **không** nhét logic Medusa vào `ecom-store` legacy hay `payment` SaaS.
