# Product Source of Truth — Tránh 2 catalog “song song mù”

## 1. Vấn đề

Hiện LadiPage đã có **phần Sản phẩm trong Bán hàng** (`ecom-store` / `lp_product`, order Nest…).  
Gắn Medusa **nếu không thiết kế** sẽ tạo:

- 2 màn hình quản lý SP (LadiPage vs Medusa Admin)
- 2 ID khác nhau khi gắn landing
- Giá/tồn lệch
- Report “top product” lệch nguồn
- Merchant không biết sửa SP ở đâu

→ Đây là **dual source of truth**, cần strategy tường minh, không phải “sync hết mọi thứ”.

---

## 2. Nguyên tắc

1. **Một UX catalog** trong LadiPage (picker + list) — dù backend đọc từ đâu.
2. Mỗi product record trong facade có field **`source`**: `legacy_lp` | `medusa`.
3. **Mỗi landing page** (và mỗi binding) chỉ dùng **một commerce engine** tại một thời điểm:
   - `commerceEngine: 'none' | 'legacy_ecom' | 'medusa'`
4. **Không dual-write** tạo SP: thao tác “Tạo sản phẩm” route theo engine org đã chọn (hoặc theo feature flag phase).
5. Legacy data **giữ nguyên**; migration sang Medusa là **opt-in project**, không big-bang.

---

## 3. Chiến lược theo phase

### Phase 0 — Coexistence (mặc định khi mới tích hợp)

| Engine | Catalog | Landing sales blocks | Checkout |
|--------|---------|----------------------|----------|
| `legacy_ecom` | `lp_product` | Block ecom cũ (nếu có) | Logic ecom LadiPage hiện tại |
| `medusa` | Medusa products (channel org) | Commerce widgets mới | Medusa Store |
| `none` | — | Lead form only | — |

Org **chưa** bật Medusa: 100% legacy.  
Org bật Medusa: default engine cho **page mới** = `medusa`; page cũ giữ engine đã lưu.

### Phase 1 — Facade thống nhất (picker)

```
GET catalog (conceptual)
  → nếu org.commercePrimary = medusa: list Medusa (+ optional “legacy archived”)
  → nếu legacy: list lp_product
  → nếu both (admin tool): merge view với badge source
```

Editor **không** cho gắn đồng thời 2 engine trên **cùng một page**.

### Phase 2 — Primary catalog

Mỗi org có `commercePrimary`:

| Giá trị | Ý nghĩa |
|---------|---------|
| `legacy_ecom` | Medusa chưa bật hoặc chỉ pilot 1–2 page |
| `medusa` | Medusa SoT; `lp_product` read-only hoặc “import source” |
| `dual_read` | Chỉ cho migration window (có badge, có deadline) |

`dual_read` **có thời hạn**; không phải model dài hạn.

### Phase 3 — Optional import legacy → Medusa

- Job one-shot / wizard: map `lp_product` → Medusa product + lưu `external_id` / metadata `ladipage_product_id`.
- Sau import: binding landing **re-point** sang Medusa IDs (tool migrate bindings).
- Legacy order **không** rewrite; chỉ catalog forward.

---

## 4. Model conceptual (không SQL)

### CommerceProductView (facade DTO)

| Field | Mô tả |
|-------|--------|
| `id` | ID ổn định trong facade: `medusa:{uuid}` hoặc `lp:{id}` |
| `source` | `medusa` \| `legacy_lp` |
| `externalId` | ID gốc engine |
| `title`, `thumbnail`, `priceFrom`, `currency` | Display |
| `variants[]` | Chỉ medusa / legacy options map |
| `status` | active / draft |
| `salesChannelId` | medusa only |

### PageCommerceBinding

| Field | Mô tả |
|-------|--------|
| `pageId` | Landing |
| `commerceEngine` | `medusa` \| `legacy_ecom` |
| `productRef` | facade id |
| `variantRef?` | |
| `placement` | hero_cta, card, sticky_bar… |
| `snapshot` | title/image/price lúc gắn (UX only) |
| `ctaMode` | add_to_cart, buy_now, redirect |

Snapshot **không** override giá lúc complete cart.

---

## 5. Trả lời trực tiếp: “Sẽ gây ra 2 nguồn sản phẩm không?”

| Nếu làm sai | Nếu làm đúng (doc này) |
|-------------|-------------------------|
| 2 admin UI độc lập, không badge | 1 catalog UI + `source` |
| Cùng page gắn SP 2 engine | Forbidden: 1 engine / page |
| Sync 2 chiều realtime | Chỉ import one-way có kiểm soát |
| Report trộn ID | Report filter theo engine + period |

**Kết luận:** Về vật lý có thể tồn tại 2 store (legacy DB + Medusa) trong giai transition; **về sản phẩm logic** merchant luôn thấy **một primary catalog** và page biết rõ engine. Đó không còn là “2 nguồn mù”.

---

## 6. Ảnh hưởng module ecom-store

| Hành vi | Design |
|---------|--------|
| CRUD product legacy | Giữ khi `commercePrimary=legacy` hoặc page engine legacy |
| Order legacy | Giữ lịch sử; sales page Medusa **không** bắt buộc ghi `lp_order` realtime |
| Optional mirror | Webhook Medusa → read-model `commerce_order_projection` cho dashboard thống nhất |
| Top-product report | Union query có cột `source` hoặc 2 tab “Legacy / Medusa” giai migration |

---

## 7. Anti-patterns (cấm)

1. Tự động tạo `lp_product` mỗi lần tạo Medusa product (dual-write).
2. AI generate HTML hardcode giá — phải dùng binding + hydrate.
3. Cho staff sửa giá trên landing override Medusa (chỉ được “display strikethrough marketing”, không đổi cart unit price).
4. Merge inventory 2 engine bằng cron không audit.

---

## 8. Quyết định khuyến nghị cho Liora

- **Cloud default:** `commercePrimary = medusa` cho org mới sau GA ecommerce; org cũ opt-in.
- **Migration window:** `dual_read` tối đa N tháng (config), sau đó legacy catalog ẩn khỏi picker (vẫn đọc order lịch sử).
- **SoT bán hàng mới:** Medusa.
- **SoT marketing lead:** CRM (không phải product table).
