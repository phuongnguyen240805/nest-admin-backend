# Payments & Billing — Hai plane tách bạch

## 1. Câu hỏi

> Thanh toán billing / payment dùng logic LadiPage hay SDK Medusa?

**Trả lời ngắn:** **Cả hai**, nhưng **khác việc, không trộn pipeline**.

| Plane | Ai trả tiền | Hệ thống | Mục đích |
|-------|-------------|----------|----------|
| **A. Platform Billing** | Merchant (chủ tài khoản LadiPage) | Nest `BillingModule` (Stripe, PayOS, …) | Mua/gia hạn **gói SaaS** LadiPage (pages, domain, AI quota…) |
| **B. Commerce Payment** | End-customer (người mua trên landing) | **Medusa** payment providers + cart complete | Thanh toán **đơn hàng sản phẩm** |

Nhầm 2 plane là lỗi kiến trúc phổ biến (dùng Stripe subscription LadiPage để charge giỏ hàng khách, hoặc nhét PayOS SaaS vào cart Medusa không có order model).

---

## 2. Plane A — Platform Billing (giữ nguyên LadiPage)

### Hiện trạng (tham chiếu monorepo)

- `libs/nest-core` billing: subscribe, portal, usage, trial  
- PayOS plan: `plans/PAYOS-INTEGRATION.md` — **PTTT #2 cho subscription org**  
- `PaymentModule` ladipage-backend re-export BillingModule  
- Gate plan: page quota, AI jobs, app store features  

### Phạm vi

- Org chọn plan Free/Pro/…  
- Thanh toán định kỳ / one-time lifetime  
- Webhook kích hoạt `subscriptionTier`  
- **Không** tạo Medusa order  
- **Không** trừ inventory  

### Khi có Ecommerce Medusa

- Feature `commerce.medusa` có thể **nằm trong plan** hoặc add-on (billing A quyết định **được phép bán** hay không).
- Số đơn Medusa / GMV **không** thay bằng Stripe subscription — có thể meter sau (phase advanced) qua webhook đếm order → usage billing A.

---

## 3. Plane B — Commerce Payment (Medusa)

### Phạm vi

- Cart line items (product/variant)  
- Shipping, tax, region, currency storefront  
- Payment session Medusa (Stripe PaymentIntent, PayOS plugin Medusa, COD, bank transfer…)  
- Order lifecycle: capture, refund, fulfillment  

### Hybrid data plane

- Store SDK / Store API: create payment session, complete cart  
- **Không** gọi `POST /billing/subscribe` của LadiPage  
- Secret payment keys của **store merchant** cấu hình trong Medusa (hoặc LadiPage UI → BFF ghi Medusa), tách keys billing SaaS  

### Metadata bắt buộc trên cart/order Medusa

| Metadata | Mục đích |
|----------|----------|
| `ladipage_page_id` | Attribution landing |
| `ladipage_org_id` / `tenant_id` | Bridge multi-tenant |
| `ladipage_binding_id` | Optional |
| UTM / campaign | Ads funnel |

Webhook order.paid → Nest bridge dùng metadata này.

---

## 4. OfferKit / coupon — ranh giới

| Loại ưu đãi | Plane | Engine khuyến nghị |
|-------------|-------|---------------------|
| Giảm giá **gói LadiPage** | A | Billing discount codes Nest |
| Coupon **đơn hàng SP** | B | Medusa promotions (primary) |
| Loyalty / referral trên landing | Bridge | Ghi nhận post-purchase qua webhook; **không** double-apply Medusa + OfferKit cùng line nếu chưa có policy |

Policy mặc định GA:

- Sales page Medusa: **chỉ** Medusa promo trên cart.  
- OfferKit: lead magnet / post-purchase / referral **ngoài** unit price cart, hoặc phase 2 map 1-1 sang Medusa promo code.

Xem FE `OFFERKIT_INTEGRATION.md` — cần update khi implement để tránh 2 engine promo.

---

## 5. Legacy ecom checkout LadiPage

Khi `commerceEngine = legacy_ecom`:

- Vẫn dùng payment/order path **hiện có** của ecom-store (nếu đã/đang có).  
- **Không** ép qua Medusa.  
- Platform billing A vẫn độc lập.

Khi org migrate primary → Medusa:

- Page mới default Medusa.  
- Page legacy giữ engine đến khi re-bind.

---

## 6. Sơ đồ tiền chảy

```
Merchant ──$ SaaS──▶ Stripe/PayOS (LadiPage Billing A)
                         │
                         ▼
                   Org plan active
                   feature commerce.medusa = on

End customer ──$ hàng──▶ Medusa payment (Plane B)
                         │
                         ▼
                   Order + fulfillment
                   webhook → CRM / analytics
```

Hai dòng tiền **không** share customer_id bắt buộc (Stripe Customer billing org ≠ Stripe customer end-user order).

---

## 7. Trách nhiệm hoàn tiền / dispute

| Sự kiện | Xử lý |
|---------|--------|
| Chargeback đơn SP | Medusa + payment provider store; ops merchant |
| Refund gói SaaS | Nest billing portal / admin |
| Merchant nợ gói → lock app Ecommerce | Plane A feature gate; page sales có thể “read-only / unpublish CTA” theo policy |

---

## 8. Checklist thiết kế (acceptance)

- [ ] Không endpoint nào vừa subscribe plan vừa complete cart  
- [ ] Dashboard tách “Doanh thu gói” vs “Doanh thu bán hàng”  
- [ ] Keys PayOS/Stripe SaaS ≠ keys commerce store  
- [ ] Docs onboarding merchant: “Thanh toán gói LadiPage” vs “Cổng thanh toán bán hàng”  
- [ ] Webhook Medusa không đụng `sys_subscription`  

---

## 9. Kết luận

| Câu hỏi | Đáp |
|---------|-----|
| Billing gói LadiPage? | **Logic LadiPage (Nest billing)** |
| Payment mua SP trên landing? | **Logic Medusa (Store checkout)** |
| Hybrid? | Control plane LadiPage cấu hình/bật feature; data plane Medusa charge khách |
| Dùng chung 1 Stripe account? | **Có thể hạ tầng**, nhưng **tách product/customer/metadata**; khuyến nghị sub-account hoặc riêng keys theo plane |
