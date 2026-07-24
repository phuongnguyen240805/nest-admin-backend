# Ecommerce + Landing — Medusa Hybrid

Tài liệu thiết kế (không code) cho việc kết hợp **LadiPage landing** với **MedusaJS** để tạo trang bán hàng, đồng thời giữ CRM / lead-gen và hệ ecom hiện có.

## Bối cảnh

| Thành phần hiện có | Vai trò hôm nay |
|--------------------|-----------------|
| Landing (Supabase `landing_pages`, AI job, CMS/Instatic) | Marketing page, draft/publish |
| `ecom-store` (Nest, `lp_product`, order…) | Catalog + order nội bộ LadiPage |
| CRM | Customer, lead, deal |
| Billing Nest (`/billing`, Stripe/PayOS) | **Thu phí gói SaaS** (subscription LadiPage) |
| OfferKit (FE docs) | Promo / loyalty / referral trên funnel |

Medusa được thêm như **commerce engine** (catalog nâng cao, cart, checkout, payment đơn hàng khách cuối), **không** thay billing SaaS.

## Thứ tự đọc

| # | Tài liệu | Nội dung |
|---|----------|----------|
| 1 | [hybrid-architecture.md](./hybrid-architecture.md) | Hybrid Store SDK + BFF, sơ đồ tổng, nguyên tắc |
| 2 | [product-source-of-truth.md](./product-source-of-truth.md) | 2 nguồn SP? Strategy catalog, avoid dual-write mù |
| 3 | [landing-page-modes.md](./landing-page-modes.md) | Tách landing CRM/lead vs landing bán hàng |
| 4 | [payments-billing.md](./payments-billing.md) | Payment SaaS LadiPage vs payment đơn Medusa |
| 5 | [tenancy-rbac.md](./tenancy-rbac.md) | Map tài khoản, sales channel, phân quyền bán |
| 6 | [impact-compatibility.md](./impact-compatibility.md) | Ảnh hưởng CRM/order/logic cũ, migration phases |
| 7 | [decisions.md](./decisions.md) | ADR-001…008 chốt quyết định |
| 8 | [pro-sales-landing-build-plan.md](./pro-sales-landing-build-plan.md) | **M0 free + RBAC** → publish→checkout; **M1 monetize sau** |
| 9 | [medusa-ui-inventory-plan.md](./medusa-ui-inventory-plan.md) | UI M0 vs M1 + design system app mẹ |
| 10 | [outcomes-and-src-structure.md](./outcomes-and-src-structure.md) | Kết quả sau deploy + cấu trúc src BE/FE |
| 11 | [gofiberVN-reuse-mapping.md](./gofiberVN-reuse-mapping.md) | Tái dùng logic Medusa gofiberVN (tRPC→Nest), không mang tRPC |
| 12 | [medusa-sdk-reuse-integration-plan.md](./medusa-sdk-reuse-integration-plan.md) | **Master plan:** reuse SDK gofiber + phase BE-0…5 + map data Medusa |

## Quyết định cốt lõi (tóm tắt)

1. **Hybrid:** BFF (Nest/Next) cho admin + multi-tenant; Medusa **Store API/SDK** cho runtime cart/checkout public.
2. **Catalog:** Một **commerce facade**; Medusa là SoT cho page mode `sales`. Legacy `lp_product` giữ free (`legacy_ecom`).
3. **Landing modes:** `lead` \| `sales` \| `hybrid_lead_sales` (metadata).
4. **Payment planes:** SaaS LadiPage vs commerce Medusa — tách bạch.
5. **Tenancy:** org → Medusa sales channel; staff = LadiPage user + RBAC.
6. **Rollout:** **M0** — Medusa + landing sales **mở free**, chỉ **phân quyền**; **M1** — trả phí Pro **sau** khi Medusa production ổn (`commerce.medusa.monetize`).
7. **Checkout GA:** H3 redirect; OfferKit không double-discount cart.

## Phạm vi ngoài docs này

- Chi tiết API OpenAPI / schema migration SQL
- Implementation PR plan (có thể bổ sung sau trong `plans/`)
- UI pixel-perfect editor blocks

## Liên quan

- `docs/landing/` — publish, Instatic, domain  
- `apps/ladipage-backend/src/modules/ecom-store/` — ecom legacy  
- `apps/ladipage-backend/src/modules/landing-ai/` — tạo landing AI  
- `plans/PAYOS-INTEGRATION.md` — PayOS cho **SaaS billing**, không nhầm với checkout bán hàng  
- FE: `ladipage-fe-v2/docs/OFFERKIT_INTEGRATION.md`
