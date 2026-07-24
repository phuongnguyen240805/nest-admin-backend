# Tenancy & RBAC — Map tài khoản và phân quyền bán hàng

## 1. Câu hỏi

> Mỗi tài khoản LadiPage có ứng với mỗi tài khoản Medusa để tách dữ liệu không?

**Không map 1 user LadiPage = 1 user Medusa Admin.**  
Tách dữ liệu ở mức **Organization / Workspace → Medusa Sales Channel (hoặc isolated store config)**.

---

## 2. Mô hình tenancy khuyến nghị

### 2.1 Shared Medusa (LadiPage Cloud — default)

```
Medusa Instance (1)
  ├── Sales Channel: org_1001
  ├── Sales Channel: org_1002
  ├── Sales Channel: org_1003
  └── Regions / stock locations (shared or per-channel policy)
```

| LadiPage | Medusa |
|----------|--------|
| `organizationId` | `sales_channel_id` (+ metadata `ladipage_org_id`) |
| `tenantId` (Nest) | metadata / custom header bridge |
| `user` staff | **Không** tạo Medusa user từng người; dùng LadiPage RBAC → BFF Admin API với service account |
| End-customer | Medusa customer (guest hoặc registered) **per order/email**, không = sys_user |

**Cách ly dữ liệu:**

- Mọi Admin list product filter **bắt buộc** `sales_channel_id` của org.  
- Publishable key / storefront context gắn channel.  
- Webhook verify + resolve org từ metadata/channel.  
- Không tin client gửi `organizationId` không khớp session.

### 2.2 BYO Medusa (Enterprise)

```
Org Enterprise ──link──▶ Medusa base URL + API keys của họ
```

- `CommerceStoreLink.mode = byo_medusa`  
- LadiPage không share catalog với org khác.  
- Vẫn map logical “1 org ↔ 1 primary channel/store”.

### 2.3 Không làm

| Anti-pattern | Lý do |
|--------------|--------|
| 1 Medusa user login per LadiPage user | Ops nặng, SSO phức tạp không cần |
| 1 Medusa database per free org | Chi phí |
| Client gửi admin token | Bảo mật |
| Channel null = “all products” | Data leak |

---

## 3. Bản ghi liên kết (conceptual `CommerceStoreLink`)

| Field | Mô tả |
|-------|--------|
| `organizationId` | PK soft |
| `mode` | `hosted_shared` \| `byo_medusa` |
| `medusaBaseUrl` | byo only |
| `salesChannelId` | required |
| `defaultRegionId` | |
| `publishableKeyRef` | secret manager ref |
| `adminCredentialRef` | server only |
| `status` | pending \| active \| suspended \| error |
| `connectedAt` | |
| `lastHealthCheckAt` | |

Provisioning hosted:

1. Org bật app Ecommerce / feature flag.  
2. Backend tạo sales channel `lp_{orgId}`.  
3. Gán default region (VD Vietnam).  
4. Sinh publishable key scope channel.  
5. `status=active`.

---

## 4. Phân quyền bán sản phẩm (RBAC)

### 4.1 Ba lớp

```
[1] Plan / App gate     — org có được dùng Ecommerce/Medusa không?
[2] LadiPage RBAC       — user trong org được làm gì?
[3] Commerce data scope — channel isolation (tự động theo org)
```

Medusa Admin roles **không** thay RBAC LadiPage cho staff thường.

### 4.2 Capability matrix (conceptual)

| Capability | Owner | Admin | Editor | Viewer | API key MCP |
|------------|-------|-------|--------|--------|-------------|
| Bật/kết nối Medusa store | ✓ | ✓ | — | — | — |
| CRUD product (via BFF) | ✓ | ✓ | optional | — | scope |
| Gắn product vào landing | ✓ | ✓ | ✓ | — | landing:create + ecom |
| Publish sales page | ✓ | ✓ | ✓ (policy) | — | — |
| Xem order commerce | ✓ | ✓ | limited | limited | — |
| Refund / capture | ✓ | ✓ | — | — | — |
| Cấu hình payment provider | ✓ | ✓ | — | — | — |
| Chỉ xem landing lead | ✓ | ✓ | ✓ | ✓ | — |

Gợi ý permission codes (Nest / app-store style):

- `app:ecom:use`  
- `commerce:store:manage`  
- `commerce:product:write`  
- `commerce:product:read`  
- `commerce:order:read`  
- `commerce:order:refund`  
- `commerce:page:bind`  
- `landing:publish:sales`  

Kết hợp page purpose: user có `landing:edit` nhưng **không** `commerce:page:bind` → sửa content lead OK, không gắn SP.

### 4.3 API key / MCP

- Scope tách: `landing:create` ≠ `commerce:product:write`.  
- MCP tạo draft sales page: cần cả landing + product bind scopes.  
- Không cấp admin Medusa key qua MCP.

### 4.4 Staff multi-store (nếu LadiPage multi-store)

- Nếu `storeId` LadiPage tồn tại: map **store → channel** (1 org nhiều channel) **hoặc** 1 channel + metadata store.  
- Quyết định product:  
  - **Simple:** 1 org = 1 channel (MVP).  
  - **Advanced:** `storeId` ↔ `sales_channel_id`.  

MVP docs chốt: **1 org = 1 sales channel**.

---

## 5. Luồng authorize khi gắn SP / publish sales

```
User action: bind product X to page P
  1. JWT valid, tenant/org context
  2. app:ecom:use + commerce:page:bind
  3. Page belongs to org (ownership)
  4. pagePurpose allows commerce
  5. Product X ∈ sales channel of org (BFF verify Medusa)
  6. Write binding

User action: complete cart (visitor)
  1. No LadiPage staff JWT required
  2. Publishable key + channel of that page's org
  3. Line items only products in channel
  4. Metadata page_id set by widget config (signed or server-issued cart bootstrap)
```

**Cart bootstrap (hybrid an toàn):** public page gọi BFF `POST /commerce/storefront-session` (rate-limited) → nhận publishable config + channel + optional signed cart context; browser dùng Store SDK với config đó. Tránh hardcode key sai channel.

---

## 6. Tách dữ liệu khách hàng (customer)

| Khái niệm | Hệ | Ghi chú |
|-----------|-----|--------|
| Staff / merchant user | Nest `sys_user` + Supabase auth | Đăng nhập LadiPage |
| CRM Person/Customer | CRM module | Lead từ form |
| Medusa Customer | Medusa | Người mua (email order) |
| Bridge | email/phone normalize | Webhook tạo/link CRM person **optional**, policy “auto-create CRM from purchase” |

**Không** đồng bộ password.  
**Không** coi mọi CRM lead là Medusa customer cho đến khi có purchase hoặc explicit sync job.

---

## 7. Suspend / offboarding

| Sự kiện | Hành vi |
|---------|---------|
| Hết hạn gói SaaS | Feature gate off: ẩn picker, CTA sales page → “unavailable” hoặc unpublish policy |
| Org xóa | Soft-disable channel; không xóa order Medusa ngay (retention) |
| BYO disconnect | Page sales engine medusa → warn + block publish mới |

---

## 8. Kết luận tenancy

| Câu hỏi | Đáp |
|---------|-----|
| 1 account LP = 1 account Medusa? | **Không** (user-level) |
| Tách data thế nào? | **Org → Sales Channel** (+ BYO option) |
| Staff Medusa login? | Không bắt buộc; BFF service account |
| Phân quyền bán? | Plan gate + LadiPage RBAC + channel scope |
| Khách mua = user LP? | Không |
