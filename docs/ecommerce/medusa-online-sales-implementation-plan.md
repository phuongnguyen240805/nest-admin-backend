# Plan triển khai Bán hàng Online qua Medusa — BE + FE

> **Ngày:** 2026-07-26
> **Trạng thái:** Implementation plan (bám code thật + docs kiến trúc)
> **BE:** `liora-monorepo/apps/ladipage-backend` (repo này)
> **FE:** `ladipage-fe-v2` — **repo RIÊNG**, nằm ở `d:\monorepo-project-workspace\ladipage-fe-v2` (KHÔNG thuộc monorepo này)
> **Refs kiến trúc:** [hybrid-architecture.md](./hybrid-architecture.md), [product-source-of-truth.md](./product-source-of-truth.md), [tenancy-rbac.md](./tenancy-rbac.md), [payments-billing.md](./payments-billing.md), [landing-page-modes.md](./landing-page-modes.md), [medusa-sdk-reuse-integration-plan.md](./medusa-sdk-reuse-integration-plan.md), [outcomes-and-src-structure.md](./outcomes-and-src-structure.md), [medusa-ui-inventory-plan.md](./medusa-ui-inventory-plan.md), [decisions.md](./decisions.md)

---

## 0. Tóm tắt điều hành

Module `commerce` hiện là **M0 bridge mức mock**: kết nối Medusa robust (`MedusaHttpClient`), product CRUD live qua Admin API, nhưng store link / order / sales channel vẫn chạy trên bộ nhớ. Plan này hoàn thiện thành **bán hàng online end-to-end** (channel thật → catalog → bind landing → checkout H3 → order/webhook) theo **M0: free + RBAC, chưa monetize** (ADR-009).

**Nguyên tắc bất biến (giữ nguyên qua mọi phase):**
- M0 free + RBAC `commerce:*`, **không** paywall (flag `commerce.medusa.monetize=false`).
- 1 org LadiPage ↔ 1 Medusa **Sales Channel** (ADR-005). Mọi Admin list **bắt buộc** filter channel.
- 2 payment plane tách biệt: SaaS billing (Nest) ≠ commerce checkout (Medusa) — ADR-004.
- Không dual-write `lp_product`; `ecom-store` legacy chạy song song (ADR-002, ADR-006).
- Medusa Postgres ≠ LadiPage Postgres; chỉ map ID.

---

## 1. Hiện trạng đã verify (từ code, không phải docs)

### 1.1 BE `commerce` module đã có
| Thành phần | Trạng thái |
|-----------|-----------|
| `MedusaHttpClient` (auth admin/store, multi-candidate retry WSL/Docker, dual auth) | ✅ tốt — giữ |
| `commerce.config.ts` (mock/live auto theo admin key) | ✅ |
| Product list/get/create/updateStatus qua Admin API | ✅ live, ⚠ chưa filter channel |
| Store health / provision / storefront session | ⚠ chỉ memory/mock |
| Order list | ⚠ chỉ seed mock |
| RBAC | ❌ chưa có `@Perm` |

### 1.2 Nền tảng có sẵn để tái dùng
- **Persistence: TypeORM (Postgres), KHÔNG Prisma.** Có `TenantScopedEntity` (`libs/nest-core/.../tenant-scoped.entity.ts`) + `TenantScopedService` (`common/services/tenant-scoped.service.ts`).
- **RBAC:** `definePermission(prefix, actions)` + `@Perm(...)` + `RbacGuard` (`libs/nest-core/src/modules/auth/`). Admin role bypass.
- **Tenant:** `TenantContextService` (`getTenantId()`, `getOrganizationId()`), `TenantGuard`, `TenantInterceptor` (global).
- **Webhook HMAC:** `landing-cms/instatic/instatic-hmac.ts` (`signBridgePayload`/`verifyBridgeSignature`, `timingSafeEqual`, max-skew 300s) — template cho Medusa webhook.
- **Legacy `ecom-store`:** TypeORM entities (`lp_product`, `OrderEntity`…), controllers `ecom/*`, services extend `TenantScopedService`.

### 1.3 Gap nghiêm trọng phải vá sớm
| # | Gap | Vị trí | Hậu quả |
|---|-----|--------|---------|
| G1 | List live **không filter sales channel** | `commerce-product.service.ts:53` | Rò rỉ chéo tenant (vi phạm ADR-005) |
| G2 | Fallback `default-org` khi thiếu header | `commerce.controller.ts:24` | Gộp data nhiều tenant |
| G3 | Sales channel **ảo** (`sc_lp_*` local, không tạo thật trên Medusa) | `commerce-memory.store.ts:35` | Create product live gắn `sales_channels` sẽ lỗi |
| G4 | RBAC soft (permission rỗng → cho qua) | `commerce-access.service.ts:30` | Không chặn được staff |
| G5 | Store link mất khi restart (memory Map) | `commerce-memory.store.ts` | Không production-ready |

---

## 2. Phase BE (bám phase docs + vá gap thật)

### BE-0 — Nền tảng RBAC + Tenant (≈ 3–5 ngày)
- `definePermission('commerce', { PRODUCT_READ:'product:read', PRODUCT_WRITE:'product:write', PAGE_BIND:'page:bind', ORDER_READ:'order:read', ORDER_REFUND:'order:refund', STORE_MANAGE:'store:manage' })`.
- Gắn `@Perm(...)` + `RbacGuard` lên mọi route admin trong `commerce.controller.ts`.
- Thay `resolveOrgId(header)` → `TenantContextService.getOrganizationId()`; **bỏ `default-org`** (vá G2, G4).
- Feature flag `commerce.medusa.enabled` (có) + `commerce.medusa.monetize=false` (có).
- **Quyết định SDK:** giữ `MedusaHttpClient` raw (khuyến nghị — không lệ thuộc version), bổ sung method thay vì thêm `@medusajs/js-sdk`.
- **Exit:** Nest ping Medusa OK; staff thiếu quyền → 403; không còn `default-org`.

### BE-1 — Store link + Sales Channel THẬT (≈ 3–5 ngày)
- `CommerceStoreLinkEntity extends TenantScopedEntity` (TypeORM) thay `commerceMemoryStore`.
- Provision thật qua Admin API: tạo sales channel → tạo/link publishable key scoped channel → lưu entity. **Idempotent**.
- Default region VND (`store.region.list` pick). Vá G3, G5.
- **Exit:** 2 org → 2 channel thật trên Medusa; không lộ admin key ra FE.

### BE-2 — Product Admin CRUD đúng tenant (≈ 1–1.5 tuần) ★
- **List filter channel** `/admin/products?sales_channel_id[]=...` (vá G1).
- Sau create → `admin.salesChannel.batchProducts({ add:[id] })`.
- **Contract test đơn vị tiền VND** (integer đồng vs minor unit) — verify với Medusa version thật.
- Giữ `medusa-product.mapper.ts`; bổ sung inventory thật nếu bỏ `manage_inventory:false`.
- **Exit:** Owner tạo SP trên UI → thấy trên Medusa Admin + list LadiPage; org B không thấy.

### BE-3 — Bindings + Storefront session (≈ 3–5 ngày)
- `POST /commerce/storefront/session` (có khung) + **rate-limit** + optional signed cart context.
- Validate `product ∈ channel` trước khi bind.
- (Optional) persist bindings phía BE (upgrade từ localStorage FE).
- **Exit:** Bind API validate product∈channel; session public không chứa admin key.

### BE-4 — Cart + Checkout H3 (≈ 1–1.5 tuần) ★
- Port từ gofiberVN (Store API): `createCart(region)`, `addLineItem(variant, qty, metadata{ladipage_page_id, org_id})`, `complete`.
- H3 redirect: trả checkout URL/prefill. **Không** đụng `/billing/subscribe`.
- Phụ thuộc ops: Medusa payment provider (Stripe/PayOS plugin) cấu hình phía Medusa.
- **Exit:** Published sales landing → test payment → Medusa order created.

### BE-5 — Orders + Webhook (≈ 3–5 ngày)
- `POST /commerce/webhooks/medusa`: verify chữ ký (mirror `instatic-hmac.ts`), **idempotent** theo event id.
- Order list thật từ Admin (filter channel/metadata) thay mock.
- Optional CRM bridge: upsert person theo email (flag `commerce.crm_bridge.auto_person`).
- **Exit:** FE "Đơn online" data thật; attribution `pageId`.

### BE-6 — Polish (≈ 2–3 ngày)
- Regions endpoint, shipping options, observability (`commerce_order_bridged`, `commerce_checkout_failed`), contract tests.

---

## 3. Phase FE (bám docs — cần đối chiếu code thật ở `d:\monorepo-project-workspace\ladipage-fe-v2`)

Giữ UI đã build, swap data layer mock → API. Bám design app mẹ: brand `#65a30d`, nút `bg-lime-500`, dark-mode. M0 **không** ship ProFeatureLock/grace/upsell.

| Sprint | Việc | UI IDs |
|--------|------|--------|
| **U0** | RBAC states, sidebar IA "Online", segment không lock | UI-05, 06, 10 |
| **U1** | Catalog online (list/create/health/empty) | UI-12…17, 11 |
| **U2** | Landing purpose wizard + editor bind | UI-30…34, 40…45 |
| **U3** | Publish checklist + public H3 + OfferKit boundary | UI-50…52, 60…61, 70…73, 80…81 |
| **U4** | Orders online | UI-20…22, 62 |
| **UM1** | (backlog M1) lock/grace/upsell — chỉ sau sign-off | UI-01…04, 74, 90…91 |

---

## 4. Cấu trúc thư mục khi triển khai

### 4.1 Backend — `apps/ladipage-backend/src/modules/commerce/`

```
commerce/
├── commerce.module.ts                      # [sửa] + TypeOrmModule.forFeature([entities]), guards
├── commerce.config.ts                      # [có] + flag monetize/enabled
├── controllers/
│   ├── commerce.controller.ts              # [sửa→tách] gắn @Perm + RbacGuard, bỏ default-org
│   ├── commerce-store.controller.ts        # [mới] provision, health, settings, regions
│   ├── commerce-products.controller.ts     # [mới] CRUD product (RBAC)
│   ├── commerce-orders.controller.ts       # [mới] list/detail order (RBAC)
│   ├── commerce-storefront.controller.ts   # [mới] PUBLIC: session, cart, checkout (rate-limit)
│   └── commerce-webhook.controller.ts      # [mới] POST /commerce/webhooks/medusa (HMAC verify)
├── clients/
│   └── medusa-http.client.ts               # [có] giữ; + method channel/publishable-key/cart
├── dto/
│   ├── create-commerce-product.dto.ts      # [có]
│   ├── update-commerce-product.dto.ts      # [mới]
│   ├── list-products.query.dto.ts          # [mới] filter channel
│   ├── storefront-session.dto.ts           # [mới]
│   ├── create-cart.dto.ts                   # [mới] BE-4
│   └── medusa-webhook.dto.ts               # [mới] BE-5
├── entities/                               # [mới] — TypeORM, extends TenantScopedEntity
│   ├── commerce-store-link.entity.ts       # org↔channel, publishableKeyRef, region, mode, status
│   ├── commerce-order-projection.entity.ts # optional mirror read-model
│   └── index.ts
├── guards/
│   ├── commerce-enabled.guard.ts           # [mới] flag enabled
│   └── (dùng RbacGuard + TenantGuard sẵn có từ nest-core)
├── services/
│   ├── commerce-store.service.ts           # [sửa] provision channel THẬT + persist entity
│   ├── commerce-product.service.ts         # [sửa] filter channel + batchProducts
│   ├── commerce-order.service.ts           # [sửa] đọc order thật từ Admin
│   ├── commerce-storefront.service.ts      # [mới] cart/checkout H3 (Store API)
│   ├── commerce-webhook.service.ts         # [mới] order.paid → CRM optional, idempotent
│   └── commerce-access.service.ts          # [sửa] RBAC cứng + monetize stub
├── mappers/
│   ├── medusa-product.mapper.ts            # [có]
│   └── medusa-order.mapper.ts              # [mới]
└── types/
    └── commerce.types.ts                   # [có] + cart/checkout/webhook types

# Extend nhẹ (không module mới):
app-store/application-access.config.ts      # [sửa] permission keys commerce:*
publish/publish.service.ts                  # [optional] validate sales checklist server-side

# Bỏ dần:
services/commerce-memory.store.ts           # [xóa sau BE-1] thay bằng entity + DB

# Tests:
commerce/**/*.spec.ts
test/contract/commerce-*.contract.spec.ts   # amount VND, product↔channel
```

### 4.2 Frontend — `ladipage-fe-v2/src/` (repo riêng)

```
features/commerce/                          # [mới] domain commerce
├── types/
│   ├── product.ts
│   ├── order.ts
│   ├── store.ts
│   └── binding.ts
├── hooks/
│   ├── useCommerceAccess.ts                # RBAC only M0; isMonetizeEnabled()=>false
│   ├── useCommerceStore.ts                 # health / provision
│   ├── useCommerceProducts.ts
│   ├── useCommerceProductMutations.ts
│   ├── useCommerceOrders.ts
│   └── useStorefrontSession.ts             # public
└── components/
    ├── PermissionDeniedState.tsx           # UI-05
    ├── ChannelHealthBadge.tsx              # UI-16
    ├── ChannelProvisioningState.tsx        # UI-15
    ├── MedusaProductsList.tsx              # UI-12
    ├── MedusaCreateProductDrawer.tsx       # UI-13
    ├── MedusaEditProductPanel.tsx          # UI-14
    ├── MedusaOrdersList.tsx                # UI-20
    ├── MedusaOrderDetailDrawer.tsx         # UI-21
    ├── EngineSegment.tsx                   # UI-11 "Cơ bản | Online"
    └── CommerceSettingsPanel.tsx           # UI-60

lib/endpoints/
├── ecom.api.ts                             # [có] legacy — giữ
└── commerce.api.ts                         # [mới] products, orders, store, session, cart

lib/access/
└── commerce-access.ts                      # [mới] canBindProduct, canWriteProduct

lib/
├── query-keys.ts                           # [sửa] + commerce keys
└── mappers/commerce.mapper.ts              # [mới]

components/sales/
├── sidebar/SalesSidebar.tsx                # [sửa] + group "Cửa hàng online"
└── online/                                 # [mới] re-export từ features/commerce/components

app/(admin)/ban-hang/page.tsx              # [sửa] segment Cơ bản | Online

# Landing purpose + editor bind:
features/landing-pages/components/
├── CreateLandingPurposeWizard.tsx          # UI-30
├── LandingPurposeBadge.tsx                 # UI-32
└── LandingPurposeFilters.tsx               # UI-31

components/landing-pages/editor/
├── blocks/ProductBuyBlock.tsx              # UI-41 [mới]
├── commerce/ProductPickerModal.tsx         # UI-42 [mới]
├── commerce/BindingInspector.tsx           # UI-43 [mới]
└── core/editor-supabase-storage.ts         # [sửa] + page_purpose, commerce_engine, commerce_bindings

# Publish + public runtime:
features/landing-publish/services/
└── commerce-publish-checklist.ts           # UI-50 [mới]

features/commerce-runtime/                  # [mới] public, không admin chrome
├── BuyNowButton.tsx                        # UI-70
├── checkout-redirect.ts                    # UI-71
└── thank-you-types.ts                      # UI-72

# Tests FE:
lib/access/commerce-access.test.ts
features/commerce/hooks/*.test.ts
features/landing-publish/**/commerce-publish-checklist.test.ts
```

---

## 5. Dependency graph

```
BE-0 (RBAC + tenant + vá G1/G2/G4)
  └─► BE-1 (channel THẬT + publishable + store_link entity — vá G3/G5)
        └─► BE-2 (product CRUD filter channel + batchProducts)
              ├─► BE-3 (bind validate + storefront session)
              │     └─► BE-4 (cart/H3 — port gofiber)
              │           └─► BE-5 (webhook + orders)
              │                 └─► BE-6 (polish)
              └─► FE swap mock → API (U0…U4, song song từ BE-2)

[GATE] P5 sign-off "Medusa chạy ổn" ──► M1 monetize (backlog, KHÔNG làm trong M0)
```

---

## 6. Acceptance M0 (điều kiện "xong")

- [ ] Free Owner: tạo SP Medusa → bind landing → publish → khách checkout H3 test OK
- [ ] Viewer thiếu quyền: **403**, message quyền, **không** "Nâng cấp Pro"
- [ ] Org A **không** thấy SP org B (channel isolation — vá G1)
- [ ] Không còn `default-org` fallback (vá G2)
- [ ] Sales channel tạo thật trên Medusa, product gắn đúng channel (vá G3)
- [ ] Store link persist qua restart (vá G5)
- [ ] Checkout **không** gọi `/billing/subscribe`
- [ ] Webhook `order.paid` → "Đơn online" hiện data, idempotent
- [ ] Legacy `/ban-hang` "Cơ bản" (`lp_product`) vẫn chạy
- [ ] `monetize=false`: zero ProFeatureLock UI
- [ ] Contract test amount VND pass

---

## 7. Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Rò rỉ chéo tenant (G1) | Ưu tiên vá ngay BE-0/BE-2; test org isolation cứng |
| Amount currency units (VND) | Contract test sớm BE-2 |
| SDK/API Medusa version drift | Giữ raw `MedusaHttpClient`; pin nếu thêm SDK |
| Channel ảo gây lỗi create live (G3) | BE-1 provision channel thật trước BE-2 |
| FE ở repo riêng | Đối chiếu code thật `ladipage-fe-v2` trước khi code FE; plan này là intent |
| Ship Pro lock sớm | Flag `monetize=false` default; code review |

---

## 8. Việc cần xác nhận trước khi code

1. **SDK:** giữ `MedusaHttpClient` raw (khuyến nghị) hay chuyển `@medusajs/js-sdk`?
2. **FE repo:** xác nhận đường dẫn `d:\monorepo-project-workspace\ladipage-fe-v2` để plan FE bám code thật (state management, component kit, cách gắn header tenant).
3. **Ưu tiên:** bắt đầu từ **BE-0 (vá gap rò rỉ tenant)** — khuyến nghị làm trước vì là lỗ hổng bảo mật.
