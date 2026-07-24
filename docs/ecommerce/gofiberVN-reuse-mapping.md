# Mapping tái sử dụng — gofiberVN (tRPC/Medusa) → LadiPage Nest commerce

> **Ngày:** 2026-07-21  
> **Không code** — plan port logic.  
> **Nguồn:** `gofiberVN/src/server/api/routers/medusa/*`, `src/lib/medusaClient.ts`  
> **Đích:** `ladipage-backend` module `commerce` + FE-v2 REST/React Query  
> **Chiến lược hybrid:** Admin chỉ Nest; Store/cart cho public/checkout; DB Medusa tách.

---

## 1. Kết luận nhanh

| Hỏi | Đáp |
|-----|-----|
| Tái dùng **tRPC framework**? | **Không** — port logic sang Nest REST |
| Tái dùng **`@medusajs/js-sdk` + gọi :9000**? | **Có** — trong Nest clients |
| Tái dùng body router (list product, cart…)? | **Có** — map 1:1 sang service methods |
| FE LadiPage gọi tRPC gofiberVN? | **Không khuyến nghị** lâu dài |

---

## 2. Kiến trúc hiện tại gofiberVN vs đích LadiPage

```
gofiberVN (storefront 1 shop)
  api.medusa.*  →  tRPC  →  medusaClient.store / medusaAdmin  →  :9000

LadiPage (SaaS multi-org)
  FE commerce.*  →  Nest REST /commerce/*  →  MedusaAdminClient / StoreClient  →  MEDUSA_URL
                         + TenantGuard + commerce RBAC + sales_channel scope
```

---

## 3. Client SDK — map trực tiếp

| gofiberVN | LadiPage Nest (đề xuất) | Env |
|-----------|-------------------------|-----|
| `medusaClient` Store + `publishableKey` | `MedusaStoreClient` | `MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY` |
| `medusaAdmin` + `apiKey` | `MedusaAdminClient` | `MEDUSA_BACKEND_URL`, `MEDUSA_ADMIN_API_KEY` |
| `baseUrl … \|\| localhost:9000` | Config Nest `commerce.config.ts` | Dev = `:9000`; prod = HTTPS |

**Port file:** `gofiberVN/src/lib/medusaClient.ts` → `apps/ladipage-backend/src/modules/commerce/clients/`.

**Lưu ý bảo mật:** gofiberVN dùng `NEXT_PUBLIC_MEDUSA_ADMIN_API_KEY` (dễ lộ). LadiPage: **chỉ server env**, không `NEXT_PUBLIC_` cho admin key.

---

## 4. Bảng mapping router → Nest API / service

### 4.1 Product (Store) — gofiberVN `product.ts`

| tRPC procedure | SDK call | Nest method (đề xuất) | Plane | Ưu tiên LadiPage |
|----------------|----------|------------------------|-------|------------------|
| `getProducts` | `store.product.list` | `GET /commerce/storefront/products` **hoặc** admin list scoped channel | Store / Admin | P1 list admin: **Admin API + channel**; public hydrate: Store |
| `getProduct` | `store.product.retrieve` | `GET /commerce/products/:id` | Store/Admin | P1 |
| `getProductRecent` | `store.product.list({ id: ids })` | `POST /commerce/products/by-ids` | Store | P2 bind picker batch |

**Logic tái sử dụng:** `fields: '*variants,*variants.prices,…'`, error wrap, limit.

**Khác LadiPage:** Admin create/update product (UI mock) **không có** trong gofiberVN product router → **viết mới** bằng `medusaAdmin.admin.product.*` + gán sales channel.

### 4.2 Cart — `cart.ts` (Store) ★ reuse cao cho checkout

| tRPC | SDK | Nest / runtime | Phase |
|------|-----|----------------|-------|
| `createCart` | `store.cart.create({ region_id })` | `POST /commerce/storefront/cart` | P3 H3 |
| `getCart` | `store.cart.retrieve` | `GET …/cart/:id` | P3 |
| `addToCart` | `store.cart.createLineItem` | `POST …/cart/:id/line-items` | P3 |
| `completeOrder` | `store.cart.complete` | `POST …/cart/:id/complete` | P3 |
| `updateLineItemMetadata` | `store.cart.updateLineItem` | metadata `ladipage_page_id` | P3 |

**Reuse:** input Zod → DTO; success `type === 'order'`; metadata pattern.

### 4.3 Region — `region.ts`

| tRPC | Nest | Phase |
|------|------|-------|
| `getRegions` | `GET /commerce/regions` (settings) | P1/P3 |
| `getRegion` | `GET /commerce/regions/:id` | P3 |

### 4.4 Categories — `categories.ts` (file name campaign confusion; uses Store category)

| tRPC | Nest | Phase |
|------|------|-------|
| `listCategories` | Optional `GET /commerce/categories` | Post-GA |
| `getCategory` | Optional | Post-GA |

### 4.5 Collection — `collection.ts`

| tRPC | Nest | Phase |
|------|------|-------|
| `getCollections` | Optional catalog | Post-GA |

### 4.6 Campaign — `campaign.ts` (Admin)

| tRPC | Nest | Phase |
|------|------|-------|
| `listCampaigns` / `getCampaignById` | Optional promotions | Later (OfferKit boundary) |

### 4.7 Shipping — `shipping.ts` (Admin)

| tRPC | Nest | Phase |
|------|------|-------|
| `getShippingOptions` | Settings / checkout prep | P3 optional |

### 4.8 User customer — `user.ts` + `auth.ts`

| gofiberVN | LadiPage |
|-----------|----------|
| register/login **Medusa customer** | Guest checkout / optional customer; **≠** `sys_user` staff |
| NextAuth + `medusa_jwt` cookie | Không copy; Nest tenant JWT riêng |

**Reuse:** pattern `auth.register/login("customer", "emailpass")` nếu cần customer account Medusa — **không** map 1-1 staff LadiPage.

---

## 5. Phần phải viết mới (gofiberVN không có / không đủ)

| Capability LadiPage hybrid | Ghi chú |
|----------------------------|---------|
| Provision **Sales Channel** per org | Multi-tenant |
| Admin **create/update product** + images + channel | UI mock → Admin API |
| `CommerceStoreLink` org ↔ channel | Entity Nest |
| RBAC `commerce:*` | Nest guards |
| Landing **bindings** + inject editor | FE already mock |
| Webhook order.paid | Event plane |
| Tenant isolation mọi Admin list | Filter channel |

---

## 6. FE LadiPage — thay tRPC hooks

| gofiberVN | LadiPage FE-v2 |
|-----------|----------------|
| `api.medusa.getProducts.useQuery()` | `useCommerceProducts` → sau: `commerceApi.listProducts()` React Query |
| `api.medusa.createCart.useMutation()` | `commerceApi.createCart` (public/runtime) |
| `createTRPCNext` | **Không** thêm tRPC package |

Giữ UI mock hiện tại; swap mock store → `lib/endpoints/commerce.api.ts`.

---

## 7. Thứ tự port (implementation order)

```
1. Nest: medusaAdmin + medusaStore clients (copy medusaClient.ts pattern)
2. Admin: list/create product + channel scope   ← UI mock đã có
3. Store: getProduct / by-ids                   ← picker + hydrate
4. Port cart.* từ gofiberVN                     ← H3 checkout
5. region + shipping options                    ← checkout complete
6. webhook + order list
7. (optional) categories/collections
```

**Không** port tRPC server. **Có** port từng procedure body như pure functions / Nest services.

---

## 8. Checklist khi port 1 procedure

- [ ] Copy SDK call + fields query  
- [ ] Đổi Zod → Nest DTO  
- [ ] Thêm `TenantGuard` + permission  
- [ ] Admin: filter `sales_channel_id` của org  
- [ ] Map error Medusa → HTTP Nest  
- [ ] Contract test / fixture  
- [ ] FE endpoint + hook  

---

## 9. Rủi ro

| Rủi ro | Mitigation |
|--------|------------|
| gofiberVN Medusa v2 fields khác version | Pin `@medusajs/js-sdk` cùng major; test list product |
| publicProcedure không auth | LadiPage bật guard từ ngày 1 |
| Admin key public env | Server-only secrets |
| Dual BFF (gofiberVN + Nest) | Chỉ Nest làm BFF production |

---

## 10. Tóm tắt

> **tRPC gofiberVN = lớp transport storefront** — bỏ khi vào LadiPage.  
> **Logic Medusa (SDK + cart/product/region)** = **tái sử dụng** vào Nest `commerce`.  
> **Admin multi-tenant + bind landing** = **viết mới** trên Nest, không có sẵn trong gofiberVN.

Liên quan: [hybrid-architecture.md](./hybrid-architecture.md), [outcomes-and-src-structure.md](./outcomes-and-src-structure.md), [pro-sales-landing-build-plan.md](./pro-sales-landing-build-plan.md).
