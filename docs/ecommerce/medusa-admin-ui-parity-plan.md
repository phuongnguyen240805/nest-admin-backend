# Plan UI — Đưa năng lực Medusa Admin lên LadiPage (parity với group Bán hàng)

> **Ngày:** 2026-07-27
> **Trạng thái:** UI plan (không code trong tài liệu này) — mock-first
> **Mục tiêu:** Owner kiểm soát nội dung Medusa (danh mục, tag, tồn kho, biến thể, khuyến mãi, khách hàng…) ngay trên LadiPage, thay vì màn "Cửa hàng online" hiện quá sơ sài.
> **BE:** `liora-monorepo/apps/ladipage-backend` (module `commerce`)
> **FE:** `ladipage-fe-v2` — repo riêng, `src/features/commerce/`
> **Refs:** [medusa-ui-inventory-plan.md](./medusa-ui-inventory-plan.md), [product-source-of-truth.md](./product-source-of-truth.md), [tenancy-rbac.md](./tenancy-rbac.md), [payments-billing.md](./payments-billing.md), [medusa-online-sales-implementation-plan.md](./medusa-online-sales-implementation-plan.md)

---

## 0. Vấn đề & nguyên tắc

### 0.1 Vấn đề
Màn "Cửa hàng online" (Medusa) hiện chỉ có 3 tab (SP / Đơn / Cài đặt), mỗi màn hiển thị rất ít field:
- SP online: ~5/20 field (ẩn `compareAtPrice`, `brand`, `badge`, `highlights`, `images`, ngày…); không search/sort/pagination; không sửa/xoá/archive; không xem chi tiết.
- Đơn online: không line-item thật (chỉ chuỗi `itemsSummary`); không filter/search; không refund; không địa chỉ/vận chuyển.
- Thiếu hẳn: **Danh mục, Tag, Tồn kho, Biến thể, Khách hàng, Khuyến mãi** — những nhóm mà bán hàng legacy LadiPage đã có.

→ Owner không nắm được tình hình cửa hàng.

### 0.2 Nguyên tắc (bất biến)
1. **Mock-first:** mỗi màn dựng bằng `commerceMockStore` để kiểm tra UI trước, KHÔNG đấu BE (`NEXT_PUBLIC_COMMERCE_USE_API` mặc định off). Đấu BE là phase sau.
2. **Bám design & convention app mẹ:** brand lime-500, dark mode, Tailwind v4, primitives `@/components/ui/*`, `ApiState`, `ladiConfirm/ladiToast`. KHÔNG invent skin Medusa Admin.
3. **Không phá layout không liên quan:** chỉ thêm sub-tab vào `SalesSidebar` + case trong `ban-hang/page.tsx`; mount component từ barrel `@/features/commerce`. Không đụng legacy `components/sales/*`.
4. **Tổ chức màn theo cấu trúc group legacy** để owner quen tay (xem §2).
5. **Tôn trọng ADR:** M0 free + RBAC (không paywall); 1 org ↔ 1 sales channel; promo chỉ 1 engine trên cart (ADR-008); không dual-write legacy.

---

## 1. Mapping: group legacy LadiPage → thực thể Medusa

Ba nhóm khả năng (quyết định cách triển khai):

### Nhóm 1 — Medusa có native, map thẳng (owner kiểm soát tối đa)
| Group legacy | Thực thể Medusa (Admin API) | CRUD | Ghi chú triển khai |
|----|----|----|----|
| Danh mục SP | Product Category | ✅ + phân cấp cha-con | Map gần 1-1 |
| Tag SP | Product Tag | ✅ | Medusa tag không có màu → màu là `metadata` phía LadiPage |
| Loại SP | Product Type | ✅ | Legacy `type/typeName` → `product_type` |
| Biến thể | Product Variant + Options | ✅ | MVP 1 variant Default; mở rộng sau |
| Tồn kho | Inventory Item + Stock Location | ✅ (model phức tạp) | MVP: 1 location, stock đơn giản |
| Khuyến mãi | Promotion + Campaign | ✅ | Legacy đang stub; Medusa hỗ trợ thật. ADR-008: 1 engine promo/cart |
| Khách hàng | Customer + Customer Group | ✅ | Legacy chưa có "khách online" tách riêng |
| Bảng giá | Price List (giá sỉ/nhóm) | ✅ | LadiPage chưa khai thác — optional |

### Nhóm 2 — Medusa KHÔNG có native → extension phía LadiPage
| Group legacy | Cách làm |
|----|----|
| Tag đơn hàng | `order.metadata` hoặc bảng phụ LadiPage (không ghi Medusa core) |
| Đánh giá SP | Giữ `lp_product_review` legacy hoặc `metadata` — Medusa core không có review |
| Màu cho tag | `metadata` phía LadiPage |
| Phiếu giao hàng | Medusa có Fulfillment; nếu khác nghiệp vụ → giữ `lp_delivery_note` |

### Nhóm 3 — Chỉ là metadata, không cần schema riêng
| Group legacy | Cách làm |
|----|----|
| Trường tuỳ chỉnh (SP/đơn) | Map vào `metadata` JSON của product/order Medusa |

---

## 2. Cấu trúc màn (theo group legacy) — IA cho SalesSidebar

Giữ group "Cửa hàng online" hiện có, mở rộng thành các sub-group song song legacy:

```
Cửa hàng online (Medusa)
├── SẢN PHẨM
│   ├── Sản phẩm online        (UI-P1  — có sẵn, cần enrich)
│   ├── Danh mục               (UI-P2  — mới, Nhóm 1)
│   ├── Tag sản phẩm           (UI-P3  — mới, Nhóm 1)
│   ├── Tồn kho                (UI-P4  — mới, Nhóm 1)
│   └── Biến thể (trong SP)    (UI-P5  — trong drawer/detail)
├── ĐƠN HÀNG
│   ├── Đơn online             (UI-O1  — có sẵn, cần enrich)
│   ├── Chi tiết đơn           (UI-O2  — mới: line-items, địa chỉ, thanh toán)
│   └── Tag đơn (Nhóm 2)       (UI-O3  — optional, metadata)
├── KHÁCH HÀNG
│   ├── Khách hàng             (UI-C1  — mới, Nhóm 1)
│   └── Nhóm khách             (UI-C2  — optional)
├── KHUYẾN MÃI
│   └── Khuyến mãi / Campaign  (UI-M1  — mới, Nhóm 1)
└── CÀI ĐẶT
    ├── Cài đặt cửa hàng       (UI-S1  — có sẵn)
    ├── Khu vực & tiền tệ      (UI-S2  — mới: region/currency read)
    └── Bảng giá (optional)    (UI-S3  — Nhóm 1, optional)
```

---

## 3. Chi tiết từng màn (mock-first) — field & tương tác

### UI-P1 — Sản phẩm online (ENRICH màn có sẵn)
- **Cột thêm:** ảnh + tên + SKU, **giá + giá gạch** (`compareAtPrice`), tồn, **brand**, **badge**, trạng thái, **ngày cập nhật**.
- **Thêm:** ô search (tên/SKU), sort (giá/tồn/ngày), pagination (hoặc "tải thêm").
- **Actions:** sửa (mở detail drawer), archive, ngoài toggle ẩn/hiện hiện có.
- **Row click:** mở **Product Detail Drawer** (UI-P5) xem toàn bộ field + biến thể + ảnh.
- RBAC: `commerce:product:read` (xem), `commerce:product:write` (sửa/tạo/archive).

### UI-P2 — Danh mục (mới)
- Cột: checkbox, tên (+ảnh nếu có), **số SP**, hiển thị (toggle), cha, actions (sửa/xoá).
- Create/edit modal: tên, danh mục cha (select cây), mô tả, visibility.
- Mock: cây 2 cấp, đếm SP theo `categoryId`.

### UI-P3 — Tag sản phẩm (mới)
- Cột: tên tag (chip màu — màu lưu metadata), số SP gắn, ngày tạo/cập nhật.
- Create/edit: tên + palette màu (như legacy OrderTags).
- Mock: 5-6 tag, map nhiều-nhiều với SP.

### UI-P4 — Tồn kho (mới)
- Cột: SP, SKU, giá, **số lượng (input sửa + Lưu)**, location (MVP 1 location).
- Search theo tên/SKU. Cảnh báo "sắp hết" khi stock < ngưỡng.
- Mock: đồng bộ `stock` từ product; sửa cập nhật lại store.

### UI-P5 — Product Detail Drawer / Biến thể (mới)
- Tabs: **Tổng quan** (mọi field: mô tả, highlights, brand, badge, unit, shippingNote, ảnh gallery), **Biến thể** (bảng: tên, SKU, giá, tồn, options), **Danh mục & Tag**, **SEO/metadata**.
- Đây là "cú hích" lớn nhất cho vấn đề "owner thấy quá ít".

### UI-O1 — Đơn online (ENRICH)
- **Thêm:** search (mã/khách/SĐT), filter trạng thái (tab), sort ngày/tổng, pagination.
- Cột giữ + thêm cột **kênh/nguồn** nếu có.

### UI-O2 — Chi tiết đơn (mới)
- **Line-items thật:** bảng SP × qty × đơn giá × thành tiền (cần bổ sung `items[]` vào type/mock — hiện chỉ có `itemsSummary`).
- Khối: khách (tên/email/SĐT), **địa chỉ giao**, **thanh toán** (phương thức/trạng thái), **vận chuyển**, tổng breakdown (tạm tính/giảm/ship/tổng).
- Action: **hoàn tiền** (`commerce:order:refund`) — mock confirm, chưa gọi BE.

### UI-C1 — Khách hàng (mới, Nhóm 1)
- Cột: tên, email, SĐT, **số đơn**, **tổng chi tiêu**, ngày tạo. Search.
- Detail drawer: thông tin + lịch sử đơn (mock join theo email).

### UI-M1 — Khuyến mãi / Campaign (mới, Nhóm 1)
- Cột: mã/tên, loại (%/số tiền), giá trị, điều kiện, thời gian, trạng thái.
- Create/edit: code, type, value, min order, thời hạn.
- **Lưu ý ADR-008:** promo chỉ áp trên cart Medusa, không double với OfferKit — ghi rõ helper text.

### UI-S1/S2/S3 — Cài đặt
- S1 (có sẵn): channel + org read-only.
- S2 (mới): khu vực & tiền tệ (region/currency) — read-only M0.
- S3 (optional): bảng giá.

---

## 4. Thay đổi type & mock store cần bổ sung (FE)

`src/features/commerce/types/index.ts` — thêm:
- `CommerceCategory` (id, name, parentId, thumbnail?, productCount, visible)
- `CommerceProductTag` (id, name, color, productCount)
- `CommerceInventoryRow` (productId, sku, price, quantity, locationName)
- `CommerceVariant` (id, title, sku, price, stock, options)
- `CommerceCustomer` (id, name, email, phone, ordersCount, totalSpent, createdAt)
- `CommercePromotion` (id, code, type: 'percentage'|'fixed', value, minOrder, startAt, endAt, status)
- Bổ sung `CommerceOrder.items: CommerceOrderLineItem[]` (productTitle, sku, quantity, unitPrice, total) + địa chỉ/thanh toán optional.

`src/features/commerce/mock/commerce-mock-store.ts` — seed & thao tác cho các entity mới, giữ pattern `subscribe/emit` + snapshot ổn định + colocated `.test.ts`.

---

## 5. Điểm mount (KHÔNG phá layout)

- `src/features/commerce/index.ts`: export component mới.
- `src/components/sales/sidebar/SalesSidebar.tsx`: thêm sub-tab dưới group "Cửa hàng online".
- `src/app/(admin)/ban-hang/page.tsx`: thêm `case` cho `activeSubTab` mới, mount từ barrel.
- KHÔNG sửa `components/sales/products|orders|...` (legacy).

---

## 6. Thứ tự triển khai (mock-first, tăng giá trị "thông tin cho owner" sớm)

| Wave | Màn | Lý do ưu tiên |
|----|----|----|
| **W1** | Enrich type + mock store (entity mới) | Nền cho mọi màn |
| **W2** | UI-P5 Product Detail Drawer + UI-P1 enrich | Đánh trúng "owner thấy quá ít" ngay |
| **W3** | UI-O2 Chi tiết đơn + UI-O1 enrich | Line-item thật, nghiệp vụ đơn |
| **W4** | UI-P2 Danh mục + UI-P3 Tag + UI-P4 Tồn kho | Kiểm soát catalog |
| **W5** | UI-C1 Khách hàng + UI-M1 Khuyến mãi | Mở rộng năng lực Medusa |
| **W6** | UI-S2/S3 settings, Nhóm 2 (tag đơn, review) | Hoàn thiện |

Mỗi wave: dựng mock → test vitest `src/features/commerce` → kiểm UI → mới sang wave sau.

---

## 7. Cần contract-test khi đấu BE (không làm ở mock)
- Path & query filter Medusa Admin thật (category/tag/inventory/promotion/customer) theo `docs.medusajs.com/api/admin`.
- Đơn vị tiền VND (integer đồng vs minor-unit).
- Model inventory v2 (item ↔ location ↔ variant).
- Channel scope trên mọi list (đã enforce ở BE-2).

---

## 8. Tóm tắt
Mượn cấu trúc group của bán hàng legacy làm khuôn IA, map xuống Medusa Admin API (Nhóm 1 map thẳng, Nhóm 2 extension LadiPage, Nhóm 3 metadata). Dựng mock-first theo `features/commerce` để owner thấy đầy đủ thông tin trước khi đấu BE. Ưu tiên Product Detail + Order Detail để xử lý ngay vấn đề "hiển thị quá ít".
