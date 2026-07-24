# Architecture Decisions — Ecommerce Medusa Hybrid

Các quyết định chốt (ADR ngắn). Chi tiết trong các doc cùng thư mục.

---

## ADR-001 — Hybrid control plane + data plane

**Status:** Proposed  

**Context:** Cần multi-tenant, RBAC, CRM bridge và runtime cart tốt.  

**Decision:** Nest/BFF = control plane (Admin, mapping, webhook, RBAC). Medusa Store API/SDK = data plane cart/checkout. Optional public proxy (H2) khi CORS/domain đòi hỏi.  

**Consequences:** Hai client Medusa (admin server + store public); rõ secret boundary.

---

## ADR-002 — Không dual-write product

**Status:** Proposed  

**Context:** Đã có `lp_product`.  

**Decision:** Facade catalog + `source`; một `commerceEngine` mỗi page; Medusa SoT cho sales mới; legacy giữ đến khi org migrate; cấm dual-write realtime.  

**Consequences:** Có 2 store vật lý trong transition nhưng 1 UX primary.

---

## ADR-003 — pagePurpose tách lead vs sales

**Status:** Proposed  

**Context:** Cùng builder cho CRM và bán hàng.  

**Decision:** Metadata `pagePurpose` + `commerceEngine` + publish gates; default tạo page = `lead`.  

**Consequences:** Analytics/primary conversion rõ; editor palette theo mode.

---

## ADR-004 — Hai payment plane

**Status:** Proposed  

**Context:** Billing SaaS (Stripe/PayOS Nest) vs thanh toán đơn hàng.  

**Decision:** Plane A = LadiPage billing; Plane B = Medusa commerce payments. Không share pipeline.  

**Consequences:** Onboarding merchant phải giải thích 2 loại thanh toán; keys tách.

---

## ADR-005 — Org → Sales Channel (không 1-1 user Medusa)

**Status:** Proposed  

**Context:** Tách dữ liệu multi-tenant.  

**Decision:** Map `organizationId` → Medusa `sales_channel_id` (hosted shared) hoặc BYO Medusa. Staff dùng LadiPage RBAC + service account.  

**Consequences:** Không provision Medusa user per staff; channel filter bắt buộc.

---

## ADR-006 — Opt-in compatibility

**Status:** Proposed  

**Context:** Không phá CRM/ecom hiện có.  

**Decision:** Feature flags; behavior cũ khi flag off; CRM bridge purchase optional; không migrate order bắt buộc.  

**Consequences:** Hai path bán hàng tạm thời; cần dashboard filter `source`.

---

## ADR-007 — MVP runtime H3 rồi H1/H2

**Status:** Proposed  

**Context:** Time-to-value.  

**Decision:** MVP checkout redirect/prefill storefront (H3); sau đó embedded Store SDK (H1/H2).  

**Consequences:** UX MVP rời landing nhẹ; architecture hybrid vẫn giữ control plane từ đầu.

---

## ADR-008 — Promo: một engine trên cart Medusa

**Status:** Proposed  

**Context:** OfferKit + Medusa promotions.  

**Decision:** GA sales Medusa: discount cart chỉ Medusa promotions; OfferKit post-purchase/referral/lead.  

**Consequences:** Cần cập nhật doc OfferKit khi implement.

---

## ADR-009 — Monetize Medusa hoãn (M0 free + RBAC only)

**Status:** Accepted (2026-07-20)  

**Context:** Cần nối và chạy ổn Medusa trước khi bán feature; tránh paywall chặn pilot/dev. Landing sales nên dùng như landing bình thường.  

**Decision:**

- **M0 (now → GA kỹ thuật):** Mọi `subscriptionTier` được dùng Medusa sales landing, catalog online, checkout H3. Gate chính = **RBAC** `commerce:*` + org→channel. Flag `commerce.medusa.monetize=false`.
- **M1 (sau production sign-off):** Bật monetize (Pro+, grace 7 ngày, upsell UI) — không ship gate tier trong P0–P5.
- Legacy `lp_product` luôn free.
- Quota page/domain/AI SaaS hiện tại **không** đổi nghĩa “phí Medusa”.

**Consequences:** Free có thể dùng sales path đến M1; cần policy grandfather khi bật monetize; UI Pro lock là backlog M1, không block delivery M0.

**Refs:** `pro-sales-landing-build-plan.md`, `medusa-ui-inventory-plan.md`.
