# Impact & Compatibility — CRM, bán hàng sẵn có, logic hoạt động

## 1. Câu hỏi

> Khi tích hợp Medusa + landing bán hàng, nguồn khách hàng và bán hàng có sẵn trong LadiPage bị ảnh hưởng gì? Logic có bị thay đổi không?

**Nguyên tắc:** **Opt-in, additive, không big-bang.**  
Hệ cũ tiếp tục chạy cho org/page chưa bật Medusa. Logic mới **chỉ** áp dụng khi `commerceEngine=medusa` (và feature flag).

---

## 2. Ma trận ảnh hưởng

| Vùng dữ liệu / logic | Bị xóa? | Bị đổi hành vi mặc định? | Khi org bật Medusa |
|----------------------|---------|---------------------------|---------------------|
| CRM customers / leads | Không | Không | Thêm **nguồn** person từ purchase webhook (optional toggle) |
| Form lead trên landing | Không | Không | Giữ; sales page vẫn có thể có form |
| `lp_product` | Không | Không (phase 0–1) | Có thể read-only nếu primary=medusa (phase 2+) |
| `lp_order` / ecom order | Không | Không | Đơn Medusa **không** bắt buộc ghi đè; optional projection |
| Landing list / AI create | Không | Thêm field purpose (default lead) | Wizard thêm bước bán hàng |
| Billing SaaS | Không | Không | Có thể thêm feature gate ecommerce |
| Domain / publish / AI-SEO | Không | Không | + event purchase |
| OfferKit | Không ngay | Cần policy promo (doc payments) | Tránh double discount |
| Analytics report top-product | Có thể **mở rộng** | Union/tab source | Dashboard 2 nguồn hoặc facade |

---

## 3. CRM — chi tiết

### Giữ nguyên

- Tạo lead từ form landing → CRM pipeline hiện tại.  
- Segment, tag, custom field.  
- LadiWork board (nếu dùng).  

### Thêm (opt-in per org)

| Setting | Off (default) | On |
|---------|---------------|-----|
| `crm.autoCreateFromCommerceOrder` | Chỉ log/analytics | Upsert Person by email/phone từ order Medusa |
| `crm.tagPurchaseSource` | — | Tag `source:medusa_order` + `page:{id}` |
| `crm.createDealOnPurchase` | — | Deal value = order total (phase later) |

### Rủi ro cần tránh

- Trùng person (email khác format) → normalize trước upsert.  
- Coi mọi abandoned cart là lead (spam) → chỉ webhook **order paid** / placed theo policy.  
- Ghi đè tên CRM bằng tên checkout nếu staff đã enrich → prefer “fill empty fields only”.

**Kết luận CRM:** nguồn khách **mở rộng**, không thay thế form lead. Logic form **không đổi**.

---

## 4. Bán hàng legacy (ecom-store)

### Giữ nguyên khi

- `commerceEngine=legacy_ecom` trên page  
- `commercePrimary=legacy_ecom` trên org  
- Staff chỉ dùng UI ecom cũ  

### Thay đổi có chủ đích (khi migrate)

| Thay đổi | Bắt buộc? | Ghi chú |
|----------|-----------|--------|
| Ẩn “Tạo SP legacy” | Không (phase 2+) | Khi primary=medusa |
| Migrate catalog → Medusa | Không | Wizard |
| Report gộp GMV | Không | Nice-to-have |
| Deprecated checkout legacy | Chỉ sau GA + notice | |

### Order history

- Đơn cũ: query như hiện tại.  
- Đơn Medusa: màn “Đơn hàng” có filter `source=medusa|legacy` **hoặc** 2 menu giai transition.  
- **Không** migrate bắt buộc order line items sang Medusa.

---

## 5. Landing create / edit / publish — diff logic

| Bước | Trước Medusa | Sau (tương thích) |
|------|--------------|-------------------|
| Create blank/AI | Tạo draft page | + chọn `pagePurpose` (default `lead` → hành vi cũ) |
| Editor blocks | Content/form | + commerce blocks nếu purpose sales & feature on |
| Save editor_data | HTML/sections | + `commerce_bindings` optional |
| Publish | HTML + domain + SEO soft | + checklist sales nếu purpose sales |
| Runtime public | Static/hydrate form | + Store hydrate **chỉ** sales/hybrid medusa |

Org **không bật** ecommerce: UI purpose “Bán sản phẩm” ẩn hoặc upsell plan — còn lại identical.

---

## 6. Logic hoạt động có “bị thay đổi” không?

### Không đổi (core)

- Auth, tenant guard, org membership  
- AI job queue generate HTML  
- Supabase landing ownership model  
- Platform billing subscribe  
- CRM write paths hiện tại  
- Legacy ecom CRUD paths (khi còn bật)  

### Đổi có kiểm soát (additive)

- Metadata page (purpose/engine)  
- Facade catalog  
- Runtime sales widgets  
- Webhook consumer mới  
- RBAC permissions mới (default deny cho role cũ cho đến khi gán)  
- App store feature `Ecommerce` ý nghĩa “commerce bridge”  

### Đổi breaking (tránh ở GA1)

- Xóa API product legacy  
- Bắt mọi page phải có product  
- Đổi default purpose sang `sales`  
- Gộp payment SaaS + cart  

---

## 7. Kịch bản người dùng

### A. Merchant chỉ CRM (không bán)

- Không bật Medusa.  
- Tạo landing purpose `lead`.  
- **Không ảnh hưởng.**

### B. Merchant ecom legacy đang bán

- Tiếp tục `legacy_ecom`.  
- Có thể pilot 1 page Medusa song song.  
- Catalog 2 nguồn chỉ khi bật dual_read — có badge.

### C. Merchant mới sau GA Medusa

- Primary medusa.  
- Sales landing + Store checkout.  
- CRM nhận purchase nếu bật auto-create.

### D. Merchant migrate

1. Connect channel  
2. Import products  
3. Re-bind pages  
4. Switch primary  
5. Legacy read-only  

---

## 8. Phased rollout & feature flags

| Flag | Ý nghĩa |
|------|---------|
| `commerce.medusa.enabled` | Global kill switch |
| `commerce.medusa.org_allowlist` | Pilot orgs |
| `commerce.crm_bridge.auto_person` | Webhook → CRM |
| `commerce.legacy_picker` | Hiện legacy trong facade |
| `commerce.dual_read` | Migration window |

Rollback: tắt flag → sales page medusa fallback message / unpublish CTA; lead pages intact.

---

## 9. Testing / acceptance tương thích

- [ ] Org không flag: regression ecom + CRM + landing AI  
- [ ] Org flag, page lead: không gọi Medusa Store  
- [ ] Page sales medusa: cart không đụng `/billing`  
- [ ] Webhook order không sửa `sys_subscription`  
- [ ] Legacy order list vẫn trả data cũ  
- [ ] Permission thiếu `commerce:page:bind` không gắn được SP  

---

## 10. Tóm tắt ảnh hưởng

| Hạng mục | Mức độ |
|----------|--------|
| Dữ liệu khách CRM sẵn có | **An toàn** — additive bridge |
| SP & đơn legacy | **An toàn** — giữ; migrate optional |
| Logic tạo landing lead | **Gần như không đổi** — default purpose lead |
| Logic bán hàng mới | **Thêm path** Medusa hybrid |
| Payment SaaS | **Không đổi plane** |
| Rủi ro chính | Dual catalog & dual promo nếu bỏ qua docs product + payments |

**Logic hoạt động cốt lõi LadiPage không bị thay thế; được mở rộng bằng commerce profile trên landing và bridge Medusa opt-in.**
