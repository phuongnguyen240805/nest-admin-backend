# Hybrid Integration — Medusa + LadiPage Landing

## 1. Vì sao hybrid (không chỉ A hoặc B)

Hai hướng thuần:

| Hướng | Mô tả | Điểm yếu trong multi-tenant LadiPage |
|-------|--------|--------------------------------------|
| **A. Store SDK client-only** | Browser gọi trực tiếp Medusa Store API | Khó ẩn config multi-tenant, CORS custom domain, admin catalog/key, policy RBAC, gắn CRM/webhook thống nhất |
| **B. Full BFF** | Mọi cart/checkout qua Nest | Latency, re-implement surface Medusa, mất lợi thế SDK/storefront patterns, gánh nặng maintain |

**Hybrid** kết hợp:

| Mặt phẳng | Ai gọi Medusa | API Medusa | Mục đích |
|-----------|---------------|------------|----------|
| **Control plane (trusted)** | `ladipage-backend` (và/hoặc Next server) | Admin API + config nội bộ | Link store, sync/list catalog picker, map tenant→channel, webhook, RBAC, mirror CRM |
| **Data plane (public)** | Published landing (browser) **hoặc** thin public BFF | **Store API / Store SDK** | Retrieve product live, cart, shipping options, complete checkout |
| **Event plane** | Medusa → Nest webhooks | Webhooks | Order paid → CRM person/order summary, analytics conversion, optional OfferKit |

Nguyên tắc:

- **Secret / Admin key** chỉ trên server LadiPage.
- **Publishable key + sales channel** scope theo workspace, inject an toàn (edge/BFF short-lived config hoặc public env theo channel).
- Landing **không** là source of truth giá/tồn; chỉ **placement + snapshot UX**.

---

## 2. Sơ đồ hybrid

```
                    ┌──────────────────────────────────────┐
                    │  LadiPage App (FE editor + admin)    │
                    │  JWT + Tenant / Org                  │
                    └───────────────┬──────────────────────┘
                                    │
                    Control plane   │  BFF
                                    ▼
                    ┌──────────────────────────────────────┐
                    │  ladipage-backend                    │
                    │  • EcommerceBridge / MedusaGateway   │
                    │  • Tenant ↔ SalesChannel mapping     │
                    │  • Product picker (facade)           │
                    │  • RBAC: ecom:product, ecom:sell…    │
                    │  • Webhook receiver                  │
                    │  • Optional: mirror order → report   │
                    └───────┬───────────────┬──────────────┘
                            │               │
              Admin API     │               │ Webhooks
                            ▼               ▼
                    ┌──────────────────────────────────────┐
                    │           Medusa commerce            │
                    │  products, variants, cart, payment   │
                    │  regions, sales channels, inventory  │
                    └───────┬──────────────────────────────┘
                            │ Store API
                            ▼
┌──────────────┐    ┌──────────────────────────────────────┐
│ Visitor      │───▶│  Published Landing (sales mode)      │
│ browser      │    │  • Static HTML / blocks              │
│              │    │  • Commerce widgets hydrate          │
│              │    │  • Store SDK: cart / checkout        │
└──────────────┘    └──────────────────────────────────────┘
         │
         │ (optional thin public proxy if CORS/domain policy requires)
         ▼
    Next edge / Nest public routes — chỉ forward Store ops + channel context
```

### 2.1 Chia trách nhiệm chi tiết

| Tác vụ | Hybrid gán cho |
|--------|----------------|
| Tạo/sửa SP (merchant) | Medusa Admin UI **hoặc** LadiPage UI → BFF → Admin API |
| Chọn SP gắn landing | Editor → BFF catalog facade (đã filter theo channel + RBAC) |
| Lưu binding trên page | LadiPage (`editor_data` / `commerce_bindings`) — chỉ IDs + snapshot |
| Hiển thị giá live | Store API (client hoặc public BFF) |
| Add to cart / checkout | Store SDK (data plane) |
| Thanh toán đơn hàng khách | Payment provider **của Medusa cart** |
| Ghi nhận lead form | CRM LadiPage (không qua Medusa) |
| Conversion purchase | Webhook Medusa → analytics + CRM |
| Thu phí gói LadiPage | Nest Billing (Stripe/PayOS) — **plane khác** |

---

## 3. Các lớp (logical)

### L0 — Platform identity

- User Nest + Supabase link, Organization, Tenant, Plan/subscription.
- Quyết định: org có app `Ecommerce` / feature `commerce.medusa` không.

### L1 — Commerce connection

- Bản ghi `CommerceStoreLink` (conceptual): `organizationId`, `medusaSalesChannelId`, `regionId`, `publishableKeyRef`, `status`, `mode` (`hosted_shared` | `byo_medusa`).
- Xem [tenancy-rbac.md](./tenancy-rbac.md).

### L2 — Catalog facade

- API thống nhất “list products for picker” — implementer có thể đọc Medusa, legacy, hoặc both với `source` tag.
- Xem [product-source-of-truth.md](./product-source-of-truth.md).

### L3 — Page commerce profile

- Metadata landing: `pagePurpose`, `commerceEngine`, bindings.
- Xem [landing-page-modes.md](./landing-page-modes.md).

### L4 — Runtime storefront slice

- Chỉ khi publish + mode sales/hybrid: hydrate + cart session scoped page/channel.

### L5 — Post-purchase bridge

- Order events → CRM, Umami/AI-SEO, optional legacy order mirror (read model).

---

## 4. Hybrid runtime variants (cho phép cấu hình theo org)

| Variant | Cart/checkout gọi | Khi nào dùng |
|---------|-------------------|--------------|
| **H1 Direct Store** | Browser → Medusa Store | Domain/CORS ổn, giảm hop |
| **H2 Proxied Store** | Browser → LadiPage public BFF → Medusa Store | Custom domain strict, rate limit, A/B keys |
| **H3 Redirect Storefront** | CTA → Medusa storefront theme với line item prefilled | MVP nhanh, UX rời landing |

Khuyến nghị roadmap: **H3 (MVP)** → **H1/H2 embedded** khi product-market fit.

---

## 5. Ranh giới với module hiện có

```
landing-ai / landing-cms / publish
        │  (không biết Medusa chi tiết)
        │  chỉ biết pagePurpose + optional product slots
        ▼
ecommerce bridge (mới, design)
        │
   ┌────┴────┐
   ▼         ▼
ecom-store  Medusa
(legacy)    (new SoT sales)
   │
   └── CRM / analytics (shared consumers)
```

- **Landing AI** tiếp tục sinh marketing HTML; optional template “sales” chèn **slot** không hardcode SKU Medusa trong prompt.
- **Publish** fail-soft SEO giữ nguyên; thêm event purchase sau.
- **ecom-store** không bị xóa ngày 1 — trở thành legacy path + optional adapter.

---

## 6. Nguyên tắc không phá vỡ

1. **Opt-in:** Org chưa bật Medusa → hành vi ecom/CRM/landing như cũ.
2. **Page-level engine:** Mỗi landing khai báo engine; không global force.
3. **Không dual-write mù** product (chi tiết strategy ở doc catalog).
4. **Hai payment plane** tách (doc payments).
5. **CRM là identity khách hàng marketing;** Medusa customer/order là commerce — bridge bằng email/phone, không merge DB thô.

---

## 7. Trả lời ngắn các câu hỏi (chi tiết ở doc chuyên)

| Câu hỏi | Trả lời hybrid |
|---------|----------------|
| 2 nguồn sản phẩm? | Có **nguy cơ** nếu không facade; design: 1 UX catalog + `source` + SoT theo page mode. |
| Tách landing CRM vs bán? | `pagePurpose` + block allowlist + publish checklist. |
| Payment LadiPage hay Medusa? | SaaS subscription = LadiPage billing; đơn hàng bán SP = Medusa. |
| 1 account LP = 1 Medusa? | **Không** map 1-1 user; map **org → sales channel** (shared Medusa hoặc BYO). |
| Phân quyền bán? | App gate + Nest RBAC + Medusa channel isolation. |
| Ảnh hưởng data cũ? | Opt-in, không xóa; xem impact doc. |

---

## 8. Phụ thuộc triển khai (design only)

- Medusa instance: **shared multi-tenant (sales channel)** giai nhất cho LadiPage cloud; **BYO Medusa URL** cho enterprise.
- Secrets: vault/env Nest; publishable keys rotate được.
- Observability: job metrics style landing-ai; log `commerce_order_bridged`, `commerce_checkout_failed`.
