# Plan tích hợp Medusa — tái sử dụng gofiberVN SDK + hoàn thiện logic LadiPage BE

> **Ngày:** 2026-07-21  
> **Không code** — kế hoạch kỹ thuật end-to-end.  
> **Nguồn reuse:** `gofiberVN` (`medusaClient.ts`, routers `medusa/*`)  
> **Nguồn plan LadiPage:** `docs/ecommerce/*` (hybrid, M0 free+RBAC, UI inventory, outcomes/src)  
> **Nguồn Medusa (docs chính thức):** JS SDK, Admin API, Sales Channel, Publishable API Keys  
> **Refs:**  
> - https://docs.medusajs.com/resources/js-sdk  
> - https://docs.medusajs.com/api/admin  
> - https://docs.medusajs.com/resources/commerce-modules/sales-channel  
> - https://docs.medusajs.com/resources/commerce-modules/sales-channel/publishable-api-keys  

---

## 0. Mục tiêu plan này

1. **Tái sử dụng** phần logic **kết nối Medusa** từ gofiberVN (SDK + lời gọi Store/Admin), **không** mang tRPC.  
2. **Hoàn thiện** logic LadiPage còn thiếu so với plan hybrid + M0 (channel, admin product, bind, H3, webhook, RBAC).  
3. **Khớp dữ liệu Medusa v2** (product/variant/price, sales channel, publishable key, cart/order).  
4. **Chốt thứ tự phase** có acceptance, phụ thuộc UI mock đã có.

### Out of scope plan này

- Monetize Pro (M1) — chỉ flag `monetize=false`.  
- Dual-write `lp_product`.  
- Cart nhúng H1/H2 (sau H3).  
- Code / migration SQL chi tiết.

---

## 1. Hiện trạng (baseline)

| Lớp | Đã có | Chưa có (BE thật) |
|-----|--------|-------------------|
| **FE mock** | Cửa hàng online, form SP đầy đủ, gắn SP landing, inject `product_card` editor | Gọi Nest/Medusa |
| **gofiberVN** | SDK Store+Admin, tRPC cart/product/region… | Multi-tenant org/channel LadiPage |
| **ladipage-backend** | `ecom-store` legacy, landing-ai, publish | Module `commerce` + Medusa clients |
| **Medusa process** | Giả định dev `:9000` (như gofiberVN) | Provision channel per org, publishable key scope |

---

## 2. Nguyên tắc kiến trúc (chốt — khớp docs ecommerce)

```
FE LadiPage (admin)
  → Nest JWT + TenantGuard + commerce RBAC
  → MedusaAdminClient (apiKey, server-only)
  → Medusa Admin API  [control plane]

FE public landing (runtime H3)
  → (optional) Nest storefront session bootstrap
  → Medusa Store API / checkout URL  [data plane]
  → publishableKey + sales channel

Medusa → Nest webhook  [event plane]

DB: Medusa Postgres ≠ LadiPage DB (chỉ map ID)
```

| Quyết định | Giá trị |
|------------|---------|
| Transport LadiPage | Nest REST — **không tRPC** |
| SDK | `@medusajs/js-sdk` (+ `@medusajs/types`) — cùng major với Medusa server |
| Multi-tenant | 1 LadiPage `organizationId` ↔ 1 Medusa **Sales Channel** (+ publishable key scoped channel) |
| SoT catalog sales | Medusa product |
| Landing | binding + snapshot + `product_card` editor |
| Checkout GA | **H3 redirect** |
| gofiber reuse | **Logic SDK calls** only |

---

## 3. Medusa data model — khớp với LadiPage (từ docs)

### 3.1 Thực thể Medusa quan trọng

| Medusa | Ý nghĩa | LadiPage map |
|--------|---------|--------------|
| **Sales Channel** | Kênh bán; SP chỉ mua được nếu thuộc channel storefront | `CommerceStoreLink.salesChannelId` per org |
| **Publishable API Key** | Key storefront; gắn 1+ sales channel | Per-org hoặc shared key scoped channel (docs: publishable keys ↔ channels) |
| **Product** | Catalog cha | Admin create/list |
| **Product Variant** | SKU bán được, inventory | Ít nhất 1 variant khi tạo SP |
| **Price** (Price module / variant prices) | Giá theo currency/region | Map từ form LadiPage `price` + `compareAtPrice` |
| **Region** | Currency, tax, country | `createCart({ region_id })` — reuse gofiber |
| **Cart + Line item** | Session mua | Store API; metadata `ladipage_page_id` |
| **Order** | Sau complete cart | Webhook → list đơn online |
| **Admin API key** | Secret quản trị | Nest only |

### 3.2 Khớp form UI LadiPage (mock) → Medusa fields

| UI LadiPage (đã mock) | Medusa (hướng map) |
|----------------------|---------------------|
| `title` | `product.title` |
| `sku` | `variant.sku` (default variant) |
| `price` / `compareAtPrice` | variant prices (currency region default, e.g. VND) |
| `stock` | inventory quantity trên variant / inventory item |
| `thumbnailUrl` + `images[]` | product images / thumbnail |
| `shortDescription` | `subtitle` hoặc metadata / description truncated |
| `description` | `product.description` (HTML/text) |
| `highlights[]` | `metadata.highlights` hoặc description bullets |
| `brand` | `metadata.brand` hoặc Product type/collection |
| `badge` | `metadata.badge` |
| `unit` | `metadata.unit` |
| `shippingNote` | `metadata.shipping_note` |
| (implicit) channel | **Add product to sales channel** (Admin: batch products on channel) |

Docs: product phải **gắn sales channel** thì storefront (publishable key channel đó) mới thấy/mua.

### 3.3 Binding landing → Medusa

| LadiPage | Medusa |
|----------|--------|
| `commerce_bindings[].productId` | `product.id` (hoặc `variant.id` nếu sau này chọn variant) |
| `ctaMode: buy_now` | create cart 1 line → complete / payment session / redirect |
| `pageId` metadata | cart/line `metadata.ladipage_page_id`, `ladipage_org_id` |

### 3.4 Admin vs Store (SDK) — docs JS SDK

| Client | Key | Dùng LadiPage |
|--------|-----|----------------|
| **Admin** | Secret API key | Provision channel, CRUD product, batch channel products, list orders admin, shipping options |
| **Store** | Publishable key | List/retrieve product (scoped channel), cart, complete |

gofiberVN đã có **cả hai** trong `medusaClient.ts` — pattern tái dùng trực tiếp cho Nest.

---

## 4. Inventory: tái sử dụng gofiberVN vs viết mới

### 4.1 Tái sử dụng 1:1 (port body → Nest service)

| # | gofiberVN | Medusa SDK | Nest service method (tên logic) | Phase |
|---|-----------|------------|----------------------------------|-------|
| R1 | `medusaClient.ts` | SDK construct | Init Admin + Store clients | **BE-0** |
| R2 | `getProducts` | `store.product.list` | Optional public list; admin list ưu tiên Admin | BE-2 / SF |
| R3 | `getProduct` | `store.product.retrieve` | Get product for picker/hydrate | BE-2 |
| R4 | `getProductRecent` | `store.product.list({ id })` | Batch by ids (bindings) | BE-2 |
| R5 | `createCart` | `store.cart.create` | Create cart + region | BE-4 |
| R6 | `getCart` | `store.cart.retrieve` | Get cart | BE-4 |
| R7 | `addToCart` | `store.cart.createLineItem` | Add line + metadata | BE-4 |
| R8 | `completeOrder` | `store.cart.complete` | Complete / order result | BE-4 |
| R9 | `updateLineItemMetadata` | `store.cart.updateLineItem` | page attribution | BE-4 |
| R10 | `getRegions` / `getRegion` | `store.region.*` | Default region for org/cart | BE-1/4 |
| R11 | `listCategories` / `getCategory` | `store.category.*` | Optional later | BE-6 |
| R12 | `getCollections` | `store.collection.list` | Optional later | BE-6 |
| R13 | `getShippingOptions` | `admin.shippingOption.list` | Optional checkout | BE-4+ |
| R14 | customer register/login | `auth.*` customer | Optional guest identity | BE-5 optional |

**Không port:** tRPC router glue, NextAuth, FE `api.medusa.*`.

### 4.2 Viết mới (bắt buộc LadiPage hybrid — docs Medusa Sales Channel)

| # | Logic | Medusa API (docs) | Phase |
|---|--------|-------------------|-------|
| N1 | Create Sales Channel per org | Admin sales channel create | **BE-1** |
| N2 | Create/link Publishable key ↔ channel | Admin publishable API keys | BE-1 |
| N3 | Persist `CommerceStoreLink` | LadiPage DB only | BE-1 |
| N4 | Admin create product + default variant + prices + images | Admin product create | **BE-2** |
| N5 | Batch add products to channel | `admin.salesChannel.batchProducts` (docs) | BE-2 |
| N6 | Admin list products **filtered by channel** | Admin product list + channel filter | BE-2 |
| N7 | Update product / archive | Admin product update | BE-2 |
| N8 | Health check Medusa | lightweight admin/store ping | BE-1 |
| N9 | Storefront session bootstrap (return publishable + channel + region) | Compose config, no secret admin | BE-3 |
| N10 | Webhook verify + order paid | Medusa webhook / subscriber → Nest | BE-5 |
| N11 | Order list for org (channel/metadata filter) | Admin order list | BE-5 |
| N12 | RBAC + TenantGuard on all admin routes | Nest only | BE-0 |
| N13 | Mapper Medusa product ↔ CommerceProduct DTO (UI fields) | Nest mappers | BE-2 |
| N14 | Persist bindings server-side (optional upgrade from localStorage) | LadiPage/Supabase | BE-3 |

---

## 5. Mapping DTO LadiPage ↔ Medusa (contract dữ liệu)

### 5.1 Create product (Admin) — logical payload

```
Input LadiPage CreateCommerceProduct
  title, sku, price, compareAtPrice?, stock,
  images[], thumbnail?, shortDescription, description,
  highlights[], brand, badge, unit, shippingNote
       │
       ▼ map
Medusa Admin Create Product
  title
  handle (slugify title)
  description / subtitle
  thumbnail + images[]
  options: [Default]
  variants: [{
    title: "Default",
    sku,
    prices: [{ amount, currency_code }],  // note: Medusa amount units per currency rules
    manage_inventory / inventory quantities per docs version
  }]
  metadata: { brand, badge, unit, shipping_note, highlights, ladipage_org_id }
       │
       ▼ then
SalesChannel.batchProducts({ add: [product_id] })  // channel of org
```

**Cảnh báo amount:** Medusa thường dùng **minor units** (cent) với một số currency; VND thường **integer đồng**. Cần **verify** với version Medusa đang chạy (contract test) — ghi vào checklist BE-2.

### 5.2 Facade DTO response (khớp FE mock hiện tại)

Giữ shape FE `CommerceProduct` (đã có images, highlights…) — mapper Nest điền từ Medusa retrieve, không bắt FE đổi lớn.

### 5.3 Order projection (optional)

```
Medusa Order → {
  id, display_id, email, total, currency,
  status, items summary,
  metadata.ladipage_page_id → landingPageId
}
```

---

## 6. Phase implementation (hoàn thiện logic tích hợp)

Bám P0–P5 trong `pro-sales-landing-build-plan.md`, chi tiết hóa **BE + FE swap mock**.

### BE-0 — Foundation (≈ 2–3 ngày)

| Task | Nội dung | Reuse |
|------|----------|-------|
| BE-0.1 | Module `commerce` skeleton + config | outcomes-and-src-structure |
| BE-0.2 | Install `@medusajs/js-sdk` + types | gofiber package |
| BE-0.3 | Admin + Store clients (env secrets) | **R1** gofiber `medusaClient.ts` |
| BE-0.4 | Feature flag `commerce.medusa.enabled` | plan M0 |
| BE-0.5 | Permission keys + guard skeleton | plan D6 RBAC |
| BE-0.6 | Health endpoint (Medusa reachability) | N8 |

**Exit:** Nest ping Medusa `:9000` OK với admin key.

---

### BE-1 — Store link + Sales Channel (≈ 3–5 ngày)

| Task | Medusa docs | Logic |
|------|-------------|-------|
| BE-1.1 | Create sales channel | `sc_lp_{orgId}` name |
| BE-1.2 | Publishable key scoped channel | docs publishable keys |
| BE-1.3 | Entity/table `commerce_store_link` | org, channelId, publishableKeyRef, regionId, status |
| BE-1.4 | API provision + get settings | FE Settings panel swap mock |
| BE-1.5 | Default region (VND) | **R10** regions list pick |

**Exit:** Org first open “Cửa hàng online” → channel active; FE health badge real.

**Acceptance:** 2 org → 2 channel; không lộ key admin ra FE (chỉ publishable nếu cần public).

---

### BE-2 — Product Admin CRUD (≈ 1–1.5 tuần) ★ thay mock catalog

| Task | Reuse / new |
|------|-------------|
| BE-2.1 | Create product + variant + prices + images | **N4** (mới) |
| BE-2.2 | Attach to org channel | **N5** batchProducts |
| BE-2.3 | List products by channel | **N6** |
| BE-2.4 | Get / update / draft-archive | N4/N7 |
| BE-2.5 | Mapper ↔ FE CommerceProduct | N13 |
| BE-2.6 | Batch get by ids | **R4** gofiber |
| BE-2.7 | Contract tests fields + amount VND | docs + reality |

**FE:** `useCommerceProducts` / create drawer → `commerce.api` (bỏ in-memory store khi flag real).

**Exit:** Owner tạo SP trên UI LadiPage → thấy trên Medusa admin + list LadiPage; org B không thấy.

---

### BE-3 — Bindings server + storefront bootstrap (≈ 3–5 ngày)

| Task | Ghi chú |
|------|---------|
| BE-3.1 | Optional: persist bindings Nest/Supabase (upgrade localStorage) |
| BE-3.2 | `POST /commerce/storefront/session` → publishableKey, channelId, regionId, pageId | N9 |
| BE-3.3 | Validate product ∈ channel before bind | security |
| BE-3.4 | Keep inject editor_data (FE) after bind API success | already UI |

**Exit:** Bind API validates product; session public không có admin key.

---

### BE-4 — Cart + Checkout H3 (≈ 1–1.5 tuần) ★ reuse gofiber cart

| Task | Reuse gofiber |
|------|---------------|
| BE-4.1 | createCart(region) | R5 |
| BE-4.2 | addLineItem(variant_id, qty, metadata page/org) | R6–R7, R9 |
| BE-4.3 | complete / payment session / redirect URL | R8 + Medusa payment provider config ops |
| BE-4.4 | Public CTA “Mua ngay” gọi bootstrap + cart flow | D3 H3 |
| BE-4.5 | Thank-you page handle order id | |
| BE-4.6 | **Không** touch Nest `/billing/subscribe` | payments-billing.md |

**Ops dependency:** Medusa payment provider (Stripe/PayOS plugin) configured on Medusa — plane B commerce.

**Exit:** Published sales landing → test payment → Medusa order created.

---

### BE-5 — Orders + webhook (≈ 3–5 ngày)

| Task | |
|------|--|
| BE-5.1 | Webhook endpoint signature verify | N10 |
| BE-5.2 | Map order → FE orders list DTO | N11 |
| BE-5.3 | Optional CRM person from email | impact-compatibility optional |
| BE-5.4 | Idempotent webhook | |

**Exit:** FE “Đơn online” real data; attribution `pageId`.

---

### BE-6 — Polish + optional catalog (≈ 2–3 ngày)

| Task | Reuse |
|------|-------|
| Categories/collections | R11–R12 optional |
| Shipping options in settings | R13 |
| Metrics/logging | plan P5 |
| Sign-off checklist Medusa stable | pro-sales plan §9 → only then M1 |

---

## 7. FE swap plan (sau/khi BE sẵn)

| Hiện mock | Đổi thành | Phase |
|-----------|-----------|-------|
| `commerceMockStore` products | `commerceApi` + React Query | BE-2 |
| `landingCommerceBindingsStore` only local | + API persist optional | BE-3 |
| Settings org mock | GET store link real | BE-1 |
| Role mock bar | Real permissions from Nest | BE-0/2 |
| Checkout chưa có | BuyNow → H3 | BE-4 |

Giữ UI components đã build (list, drawer, bind modal, badges) — chỉ đổi data layer.

---

## 8. Dependency graph

```
BE-0 clients+flags+RBAC
  └─► BE-1 channel + publishable + store_link
        └─► BE-2 product admin CRUD + mapper
              ├─► BE-3 bind validate + storefront session
              │     └─► BE-4 cart/H3 (gofiber cart logic)
              │           └─► BE-5 webhook + orders
              └─► FE swap mock → API (song song BE-2+)
```

UI mock hiện tại **không block** BE-0…2; BE-4 cần product + channel + region.

---

## 9. Env & ops checklist

| Env | Mô tả |
|-----|--------|
| `MEDUSA_BACKEND_URL` | `http://localhost:9000` dev |
| `MEDUSA_ADMIN_API_KEY` | Server secret |
| `MEDUSA_PUBLISHABLE_KEY` | Default/global hoặc per-org stored encrypted |
| `COMMERCE_MEDUSA_ENABLED` | bool |
| `COMMERCE_MEDUSA_MONETIZE` | false M0 |

| Ops Medusa | |
|------------|--|
| Region VND + countries | |
| Payment provider test mode | |
| Webhook URL → Nest | |
| CORS nếu browser gọi Store trực tiếp | |

---

## 10. Acceptance tổng (M0 kỹ thuật xong)

- [ ] Nest Admin SDK tạo channel + product + gắn channel  
- [ ] FE Cửa hàng online CRUD qua API (không mock)  
- [ ] Org isolation (channel)  
- [ ] Gắn SP landing → product ∈ channel  
- [ ] Editor hiện product_card từ binding  
- [ ] Publish sales → Mua ngay → order Medusa (test)  
- [ ] Webhook → Đơn online  
- [ ] RBAC 403 đúng role  
- [ ] Cart/order không đụng SaaS billing  
- [ ] OfferKit không double-discount cart  

---

## 11. Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| SDK/API Medusa version ≠ gofiberVN | Pin version; contract tests sớm BE-0 |
| Amount currency units | Explicit test VND create/list price |
| Inventory model v2 phức tạp | MVP: 1 variant, stock simple; iterate |
| Publishable key per org vs shared | Prefer per-org channel-scoped keys (docs) |
| gofiber Admin key public pattern | Never copy to FE LadiPage |
| Scope creep categories/campaigns | BE-6 only |

---

## 12. Tài liệu liên quan (đọc kèm)

| Doc | Vai trò trong plan này |
|-----|------------------------|
| `hybrid-architecture.md` | Control/data/event planes |
| `product-source-of-truth.md` | Medusa SoT, legacy free |
| `landing-page-modes.md` | purpose/engine |
| `payments-billing.md` | 2 payment planes |
| `tenancy-rbac.md` | org ↔ channel, RBAC |
| `pro-sales-landing-build-plan.md` | M0 free + phases product |
| `medusa-ui-inventory-plan.md` | UI already / M0 |
| `outcomes-and-src-structure.md` | Target module tree |
| `gofiberVN-reuse-mapping.md` | Router-level mapping |
| **This file** | **Master plan reuse SDK + complete integration** |

---

## 13. Tóm tắt một trang

| Câu hỏi | Trả lời |
|---------|---------|
| Reuse gofiber gì? | **SDK init + Store product/cart/region (+ một ít Admin list)** |
| Bỏ gofiber gì? | **tRPC, NextAuth, FE storefront** |
| Logic mới chính? | **Channel, publishable, admin product+images, batch channel, webhook, RBAC, multi-tenant** |
| Khớp Medusa data? | **Product/variant/price/images/metadata + sales channel + cart metadata pageId** |
| Thứ tự? | **Clients → Channel → Product Admin → Bind/session → Cart H3 → Webhook** |
| DB? | **Tách** Medusa vs LadiPage |

**Kết quả khi plan xong:** LadiPage BE module `commerce` nói chuyện Medusa bằng cùng họ SDK như gofiberVN; FE mock hiện tại chuyển sang API thật; merchant free (RBAC) bán được qua landing checkout H3; nền sẵn cho M1 monetize sau.
