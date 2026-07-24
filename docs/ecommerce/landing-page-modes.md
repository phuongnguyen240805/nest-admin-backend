# Landing Page Modes — CRM / Lead vs Trang bán hàng

## 1. Vấn đề

Cùng pipeline “tạo landing” phục vụ:

- Quảng cáo, thu lead, nuôi CRM  
- Trang bán sản phẩm (cart/checkout)

Nếu không tách **mục đích page**, editor sẽ trộn form lead + buy CTA + catalog, analytics sai funnel, và staff không biết page “đã bán” hay “chỉ lead”.

---

## 2. `pagePurpose` (bắt buộc trên metadata page)

| Purpose | Mục tiêu chính | Blocks khuyến nghị | Blocks hạn chế |
|---------|----------------|--------------------|----------------|
| **`lead`** | Thu thập khách → CRM | Form, CTA gọi, chat, trust, content | Không product cart / checkout Medusa |
| **`sales`** | Bán SP → order Medusa (hoặc legacy ecom) | Product card, price, variants, buy, mini-cart | Form lead optional phụ |
| **`hybrid_lead_sales`** | Vừa lead vừa bán (funnel mềm) | Cả form + 1 primary product CTA | Phải khai báo **primary conversion** |
| **`content`** | SEO/blog/landing thông tin | Content, SEO | Không commerce runtime |

Mặc định khi tạo:

| Nguồn tạo | Default purpose |
|-----------|-----------------|
| Blank editor | `lead` hoặc user chọn wizard |
| AI job type `ai` | `lead` (marketing) |
| AI job type `ppc` | gợi ý `hybrid_lead_sales` hoặc `sales` |
| AI + template “ecommerce” | `sales` |
| Clone URL | `lead` (an toàn); user nâng cấp |

Purpose **đổi được** trước publish; đổi `lead` → `sales` yêu cầu: bật Ecommerce app + chọn `commerceEngine` + ≥1 binding (nếu publish sales).

---

## 3. `commerceEngine` (chỉ meaningful khi purpose ∈ sales/hybrid)

| Giá trị | Runtime |
|---------|---------|
| `none` | Không hydrate cart |
| `legacy_ecom` | Checkout path ecom LadiPage hiện có |
| `medusa` | Hybrid Store path |

Invariant:

```
if pagePurpose === 'lead' or 'content':
  commerceEngine must be 'none'
if pagePurpose === 'sales':
  commerceEngine in (legacy_ecom, medusa)
  bindings.length >= 1 (publish gate)
if pagePurpose === 'hybrid_lead_sales':
  commerceEngine in (legacy_ecom, medusa)
  primaryConversion in (lead, purchase)
```

---

## 4. Wizard tạo landing (UX logic, không UI spec)

```
[1] Chọn mục đích
    ○ Thu thập khách hàng (CRM)
    ○ Bán sản phẩm
    ○ Cả hai (nâng cao)
    ○ Nội dung / SEO

[2] Nếu bán / cả hai:
    ○ Engine: Medusa (khuyến nghị) | Ecom LadiPage (legacy)
    ○ Chọn 1+ sản phẩm (facade catalog)

[3] Template / AI prompt
    — lead: form-first
    — sales: product-slot-first

[4] Tạo draft pageId + metadata
```

AI generate **không** bắt buộc biết Medusa: chỉ sinh layout; bước [2] gắn binding sau (hoặc song song).

---

## 5. Phân tách trong editor

### 5.1 Palette theo purpose

- Mode `lead`: ẩn commerce widgets (hoặc grey + tooltip “Đổi mục đích page”).
- Mode `sales`: product widgets + checkout settings; form lead secondary.
- Mode `hybrid`: cả hai; badge “Primary conversion”.

### 5.2 Publish checklist

| Check | lead | sales | hybrid |
|-------|------|-------|--------|
| Có form/CRM endpoint hoặc thank-you | ✓ | optional | nếu primary=lead |
| Có product binding + engine | ✗ | ✓ | ✓ |
| Medusa channel healthy | ✗ | nếu medusa | nếu medusa |
| Tracking (Umami/SEO) | optional | optional | optional |
| Payment provider Medusa configured | ✗ | ✓ (warn) | nếu bán |

Publish **cứng** (block) vs **cảnh báo** (warn) cấu hình theo product policy.

### 5.3 Analytics / funnel

| Event | lead | sales |
|-------|------|-------|
| `page_view` | ✓ | ✓ |
| `lead_submit` | primary | secondary |
| `add_to_cart` | — | primary path |
| `purchase` | — | primary |
| `hybrid`: dual funnel | primary theo metadata | |

AI-SEO / Umami: tiếp tục page-level; purchase event từ webhook Medusa gắn `pageId` metadata trên cart.

---

## 6. Lưu trữ conceptual

Trên `landing_pages` (Supabase) hoặc side table:

| Field | Ví dụ |
|-------|--------|
| `page_purpose` | `lead` \| `sales` \| `hybrid_lead_sales` \| `content` |
| `commerce_engine` | `none` \| `legacy_ecom` \| `medusa` |
| `primary_conversion` | `lead` \| `purchase` (hybrid) |
| `commerce_bindings` | JSON array PageCommerceBinding |
| `generation_meta.pagePurposeHint` | từ AI job (optional) |

List UI admin: filter “Lead pages” / “Sales pages”.

---

## 7. Quan hệ với domain & publish

- Cùng custom domain có thể host cả lead và sales pages (path khác).
- Free subdomain không đổi theo purpose.
- `completeLandingPublish` / AI-SEO sync **không** phụ thuộc purpose; purchase tracking là layer sau.

---

## 8. Tóm tắt

Tách loại landing **không** bằng 2 product codebase, mà bằng **metadata + editor policy + publish gate + analytics primary conversion**.  
Sales page = purpose + engine + bindings; CRM page = purpose lead + form/CRM — cùng builder, khác “commerce profile”.
