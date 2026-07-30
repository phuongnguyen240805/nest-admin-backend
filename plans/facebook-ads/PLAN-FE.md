# Kế hoạch Frontend Facebook Ads

## 1. Mục tiêu

Xây dựng giao diện Facebook Ads Manager tại:

```text
D:\monorepo-project-workspace\ladipage-fe-v2
```

Frontend chịu trách nhiệm:

- Giao diện kết nối tài khoản Meta.
- Chọn ad account.
- Hiển thị Campaign, Ad Set, Ad và Insights.
- Filter, search, date range và custom columns.
- Campaign creation wizard.
- Autosave draft.
- Gửi yêu cầu validate/publish đến Backend.
- Hiển thị tiến trình và lỗi publish.
- Bulk actions, reports, alerts và rules.

Frontend không:

- Đọc Facebook cookie.
- Đọc `window.__accessToken`.
- Lưu Meta access token trong Zustand/localStorage/IndexedDB.
- Gọi `graph.facebook.com` trực tiếp.
- Dùng private Facebook GraphQL.
- Tự thực hiện chuỗi tạo Campaign → Ad Set → Creative → Ad.

## 2. Routes

```text
src/app/(admin)/facebook-ads/
├── layout.tsx
├── manager/
│   └── page.tsx
├── create/
│   └── page.tsx
├── drafts/
│   ├── page.tsx
│   └── [draftId]/
│       └── page.tsx
├── reports/
│   └── page.tsx
├── rules/
│   └── page.tsx
├── connections/
│   └── page.tsx
└── assets/
    ├── ad-accounts/
    │   └── page.tsx
    ├── business-managers/
    │   └── page.tsx
    └── pages/
        └── page.tsx
```

Mapping route:

| Route | Chức năng |
|---|---|
| `/facebook-ads/manager` | Campaign/Ad Set/Ad và Insights |
| `/facebook-ads/create` | Tạo campaign draft mới |
| `/facebook-ads/drafts` | Danh sách draft |
| `/facebook-ads/drafts/:id` | Chỉnh sửa draft |
| `/facebook-ads/reports` | Báo cáo, export |
| `/facebook-ads/rules` | Budget/performance rules |
| `/facebook-ads/connections` | Kết nối Meta |
| `/facebook-ads/assets/*` | Ad account, BM và Page |

## 3. Cấu trúc feature

```text
src/features/facebook-ads/
├── manager/
│   ├── components/
│   │   ├── AdsManagerHeader.tsx
│   │   ├── AdAccountSelector.tsx
│   │   ├── AdsDateRangePicker.tsx
│   │   ├── AdsMetricsSummary.tsx
│   │   ├── AdsEntityTabs.tsx
│   │   ├── AdsHierarchyTable.tsx
│   │   ├── AdsTableToolbar.tsx
│   │   ├── AdsFilterPopover.tsx
│   │   ├── AdsColumnsPopover.tsx
│   │   ├── AdsBulkActions.tsx
│   │   ├── DeliveryStatusBadge.tsx
│   │   └── EntityDetailsDrawer.tsx
│   ├── hooks/
│   │   ├── useAdsManagerQuery.ts
│   │   ├── useAdsManagerFilters.ts
│   │   ├── useAdsTableColumns.ts
│   │   └── useAdsSelection.ts
│   ├── services/
│   │   ├── campaigns.api.ts
│   │   ├── adsets.api.ts
│   │   ├── ads.api.ts
│   │   └── insights.api.ts
│   ├── stores/
│   │   └── ads-manager-ui.store.ts
│   └── types/
├── create-campaign/
│   ├── components/
│   │   ├── CampaignWizard.tsx
│   │   ├── WizardNavigation.tsx
│   │   ├── CampaignStep.tsx
│   │   ├── AdSetStep.tsx
│   │   ├── AdStep.tsx
│   │   ├── ReviewStep.tsx
│   │   └── PublishProgress.tsx
│   ├── sections/
│   │   ├── ObjectiveSection.tsx
│   │   ├── BudgetSection.tsx
│   │   ├── ConversionSection.tsx
│   │   ├── AudienceSection.tsx
│   │   ├── PlacementSection.tsx
│   │   ├── IdentitySection.tsx
│   │   ├── CreativeSection.tsx
│   │   ├── DestinationSection.tsx
│   │   └── TrackingSection.tsx
│   ├── schemas/
│   │   ├── campaign.schema.ts
│   │   ├── adset.schema.ts
│   │   ├── ad.schema.ts
│   │   └── objective-rules.ts
│   ├── services/
│   │   ├── drafts.api.ts
│   │   └── publishing.api.ts
│   ├── stores/
│   │   └── campaign-draft.store.ts
│   └── types/
├── connections/
│   ├── components/
│   ├── hooks/
│   └── services/
├── assets/
│   ├── components/
│   ├── hooks/
│   └── services/
├── reports/
│   ├── components/
│   ├── hooks/
│   └── services/
├── rules/
│   ├── components/
│   ├── hooks/
│   └── services/
├── shared/
│   ├── components/
│   ├── constants/
│   ├── errors/
│   └── formatters/
└── navigation/
    └── FacebookAdsLayoutShell.tsx
```

## 4. Layout Ads Manager

```text
┌ Account selector ─ Date range ─ Search ─ Filters ─ Columns ─ Reports ┐
├ Spend | Results | CPA | Revenue | ROAS | Profit                      ┤
├ Campaigns | Ad sets | Ads                         Create | Bulk action ┤
├───────────────────────────────────────────────────────────────────────┤
│ Select | On/Off | Name | Delivery | Budget | Spend | Results | ...   │
│ Campaign                                                              │
│   └─ Ad Set                                                            │
│       └─ Ad                                                            │
└───────────────────────────────────────────────────────────────────────┘
```

### Header

- Ad account selector.
- Khoảng ngày.
- Search.
- Filters.
- Columns.
- Refresh.
- Export.
- Create.

### Summary

- Spend.
- Results.
- CPA.
- Revenue.
- ROAS.
- Profit.

### Entity tabs

- Campaigns.
- Ad Sets.
- Ads.

Mỗi tab query riêng. Không tải toàn bộ ba cấp nếu người dùng chưa mở.

### Table

- Server-side pagination.
- Server-side sorting/filtering.
- Sticky name/status columns.
- Expand hierarchy khi cần.
- Column presets.
- Row selection riêng theo entity level.
- Skeleton, empty, permission và API error state.

## 5. State management

### React Query

Quản lý server state:

- Connections.
- Ad accounts.
- Campaigns.
- Ad Sets.
- Ads.
- Insights.
- Drafts.
- Publish jobs.
- Reports.
- Rules.

Query key:

```ts
[
  "facebook-ads",
  organizationId,
  adAccountId,
  entityLevel,
  dateRange,
  filters,
  pagination,
]
```

### Zustand

Chỉ quản lý UI state:

- Entity tab.
- Expanded rows.
- Selected rows.
- Column order/visibility.
- Filters cục bộ.
- Modal/drawer state.
- Draft form chưa autosave.

Không lưu Meta access token hoặc Facebook cookie.

## 6. Campaign wizard

### Bước 1 — Campaign

```text
Campaign name
Objective
Special Ad Category
Campaign Budget hoặc Ad Set Budget
Daily/Lifetime Budget
Bid Strategy
```

### Bước 2 — Ad Set

```text
Ad Set name
Conversion location
Pixel/Dataset
Conversion event
Budget
Schedule
Audience
Custom/Lookalike Audience
Location
Age
Language
Placement
Optimization goal
```

### Bước 3 — Ad

```text
Ad name
Facebook Page
Instagram account
Ad format
Image/video
Primary text
Headline
Description
CTA
Destination URL
UTM/tracking
Preview
```

### Bước 4 — Review

- Hiển thị đầy đủ hierarchy.
- Các cảnh báo validation.
- Dự toán budget.
- Asset được sử dụng.
- Trạng thái publish mặc định `PAUSED`.
- Xác nhận trước khi gửi publish job.

## 7. Draft và autosave

- Backend là nguồn dữ liệu draft chính.
- Autosave debounce 800–1500ms.
- Sử dụng `draftVersion` để chống ghi đè.
- Hiển thị `Saving`, `Saved`, `Save failed`.
- Retry khi autosave lỗi tạm thời.
- localStorage chỉ dùng crash recovery cho payload không nhạy cảm.
- Không lưu file media dạng base64 trong localStorage.

## 8. Publish UX

Frontend gửi duy nhất:

```http
POST /api/facebook-ads/drafts/:id/publish
```

Sau đó theo dõi:

```text
QUEUED
VALIDATING
CREATING_CAMPAIGN
CREATING_ADSETS
UPLOADING_MEDIA
CREATING_CREATIVES
CREATING_ADS
SYNCING
COMPLETED
FAILED
```

UI cần:

- Progress theo từng bước.
- Meta request ID khi có lỗi.
- Lỗi gắn đúng Campaign/Ad Set/Ad/field.
- Retry nếu backend đánh dấu retryable.
- Resume draft nếu validation lỗi.
- Deep link sang Meta Ads Manager sau thành công.
- Nút Activate riêng, có confirmation.

## 9. API service layer

Không gọi `fetch` rải rác trong component.

```text
services/
├── facebook-ads-api.client.ts
├── connections.api.ts
├── assets.api.ts
├── campaigns.api.ts
├── adsets.api.ts
├── ads.api.ts
├── insights.api.ts
├── drafts.api.ts
├── publishing.api.ts
├── reports.api.ts
└── rules.api.ts
```

Mỗi service:

- Nhận/return shared contract type.
- Chuẩn hoá query parameters.
- Không đọc auth token Meta.
- Map API error sang một `FacebookAdsError`.
- Hỗ trợ `AbortSignal`.
- Không tự hiển thị toast trong service.

## 10. Migration code hiện tại

### Giữ lại

- Layout chung.
- Các component tài khoản quảng cáo/BM/Fanpage có thể tái sử dụng.
- React Query.
- TanStack Table.
- Zod.
- Zustand cho UI state.
- Loading/toast infrastructure.

### Cần thay

- Các mock account chỉ giữ trong MSW/dev fixtures.
- Không fallback mock trong production.
- Bỏ flow refresh token từ Facebook cookie.
- Bỏ gọi Graph API trực tiếp từ browser.
- Không persist Facebook profile chứa token/cookie.
- Chuẩn hoá toàn bộ chuỗi bị mojibake sang UTF-8.
- Tách asset management khỏi màn hình Ads Manager.

## 11. Hệ thống layout và trải nghiệm

### 11.1. Mục tiêu trải nghiệm

Facebook Ads phải có cảm giác là một phần tự nhiên của LadiPage, không phải một giao diện AdsMeta/Facebook được nhúng vào hệ thống.

Người dùng cần cảm nhận:

- Quen thuộc với các màn hình LadiPage khác.
- Có kiểm soát khi chuẩn bị chạy quảng cáo.
- Dễ đọc dù bảng có nhiều dữ liệu.
- Không bị áp lực bởi quá nhiều màu, badge hoặc CTA.
- Biết rõ thao tác nào chỉ lưu draft, thao tác nào ảnh hưởng quảng cáo thật.
- Có thể quay lại công việc đang làm mà không mất dữ liệu.

Nguyên tắc:

```text
LadiPage design system
    + cấu trúc thao tác quen thuộc của Ads Manager
    + dữ liệu và trạng thái minh bạch
    - nhận diện AdsMeta
    - pixel-copy Facebook
    - hiệu ứng trang trí không cần thiết
```

### 11.2. Khung layout chính

Giữ nguyên App Sidebar và Admin Layout của LadiPage. Facebook Ads chỉ cung cấp sub-navigation và vùng nội dung.

```text
┌ LadiPage App Sidebar ──────────────────────────────────────────────────┐
│ ┌ Facebook Ads sub-navigation ┐ ┌ Page header                       ┐ │
│ │ Ads Manager                 │ │ Title + account + date + actions  │ │
│ │ Drafts                      │ ├───────────────────────────────────┤ │
│ │ Reports                     │ │ Summary metrics                   │ │
│ │ Rules                       │ ├───────────────────────────────────┤ │
│ │ Assets                      │ │ Tabs + toolbar                    │ │
│ │ Connections                 │ ├───────────────────────────────────┤ │
│ └─────────────────────────────┘ │ Data table / page content         │ │
│                                 └───────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

Quy chuẩn:

- Không tạo thêm một top navigation giống Facebook bên trong LadiPage.
- Sub-navigation desktop rộng khoảng `216–232px`.
- Nội dung chính dùng toàn bộ chiều rộng còn lại.
- Page header cao vừa đủ, không chiếm quá nhiều không gian dọc.
- Toolbar và header có thể sticky nhưng không che nội dung.
- Bảng là bề mặt chính; summary card không được đẩy bảng xuống quá sâu.
- Drawer dùng cho xem/chỉnh sửa nhanh.
- Full page dùng cho campaign wizard hoặc công việc dài.
- Modal chỉ dùng cho xác nhận hoặc tác vụ ngắn.

### 11.3. Grid, spacing và mật độ

Sử dụng nhịp spacing nhất quán:

```text
4px   khoảng cách icon/nội dung nhỏ
8px   khoảng cách control trong cùng nhóm
12px  padding control/table cell
16px  khoảng cách component
24px  khoảng cách section
32px  khoảng cách giữa các khối lớn
```

Quy chuẩn kích thước:

- Button/input mặc định cao `40px`.
- Button compact trong toolbar cao `32–36px`.
- Table row compact `44px`, comfortable `52px`.
- Icon button tối thiểu `36x36px`.
- Khu vực click/tap tối thiểu `40x40px`.
- Border radius mặc định dùng token `rounded-lg`.
- Card lớn có thể dùng `rounded-xl`.
- Không trộn quá nhiều bán kính bo góc trong cùng màn hình.

Người dùng được chọn:

- `Compact`: phù hợp media buyer cần xem nhiều dòng.
- `Comfortable`: mặc định, phù hợp đa số khách hàng.

Lưu lựa chọn density theo user/workspace, không theo từng bảng riêng.

### 11.4. Màu sắc

Nguồn màu chính là semantic tokens trong:

```text
src/app/globals.css
```

Ưu tiên:

```text
bg-background
bg-card
text-foreground
text-muted-foreground
border-border
bg-primary
text-primary-foreground
bg-secondary
bg-muted
bg-destructive
```

Không tạo palette riêng cho Facebook Ads nếu token LadiPage đã đáp ứng.

#### Màu thương hiệu LadiPage

- Primary action dùng `primary`.
- Selected tab, focus ring và active navigation dùng `primary`.
- Không hard-code đồng thời `lime-500`, `brand-500` và `#009640` trong component mới.
- Nếu component cũ chưa dùng semantic token, chuẩn hoá component dùng chung trước khi tái sử dụng.

#### Màu Facebook

`#1877F2` chỉ dùng ở:

- Icon Facebook/Meta.
- Connection provider badge.
- Nút “Kết nối với Facebook” nếu cần nhận diện provider.
- External link dẫn sang Meta Ads Manager.

Không dùng xanh Facebook cho:

- Nút `Tạo chiến dịch`.
- Selected tab.
- Checkbox.
- Progress.
- Primary navigation.
- Toàn bộ background/header của module.

#### Màu trạng thái

| Ý nghĩa | Token/màu | Ví dụ |
|---|---|---|
| Thành công/đang hoạt động | `success` | Active, publish thành công |
| Cảnh báo | `warning` | Learning limited, budget gần hết |
| Lỗi/nguy hiểm | `error` hoặc `destructive` | Disapproved, xoá, mất quyền |
| Thông tin | blue-light/secondary | Đang sync, thông tin Meta |
| Trung tính | gray/muted | Paused, draft, archived |
| Hành động chính | `primary` | Tạo, lưu, tiếp tục |

Không chỉ dùng màu để truyền đạt trạng thái. Luôn có text và khi cần có icon.

#### Light mode

- Nền trang: `background`.
- Card/table: `card`.
- Khu vực phụ: `muted` hoặc gray-50.
- Border nhẹ, không tạo quá nhiều card lồng nhau.
- Shadow chỉ dùng cho dropdown, drawer, modal và sticky surface.

#### Dark mode

- Dùng đúng các CSS variables của `.dark`.
- Không dùng nền đen tuyệt đối.
- Không đảo màu ảnh/creative preview.
- Giữ độ tương phản text, border và trạng thái.
- Tránh badge neon hoặc xanh quá chói trên nền tối.

### 11.5. Typography

Sử dụng Inter như UI chính.

Quy chuẩn:

| Thành phần | Kích thước/gợi ý |
|---|---|
| Page title | 20–24px, semibold |
| Section title | 16–18px, semibold |
| Card metric | 20–24px, semibold |
| Body/control | 13–14px |
| Table header | 12–13px, medium |
| Helper/meta text | 12px |

Nguyên tắc:

- Không dùng font weight `black` quá nhiều.
- Không viết hoa toàn bộ label/button.
- Tên campaign được ưu tiên hơn ID.
- ID và metadata dùng màu muted, có nút copy rõ ràng.
- Số liệu dùng tabular numerals nếu font/style hỗ trợ.
- Giá trị tiền luôn hiển thị currency, không chỉ hiển thị số.
- Không dùng câu chữ khoa trương như “siêu tối ưu”, “thắng chắc”, “AI thần tốc”.

### 11.6. Icon

Sử dụng `lucide-react` hoặc icon library chung hiện có. Không thêm một bộ icon thứ hai chỉ cho Facebook Ads.

Quy chuẩn:

- Icon control phổ biến: `16px`.
- Icon navigation: `18px`.
- Empty state illustration/icon: `32–48px`.
- Stroke thống nhất, ưu tiên `1.75–2`.
- Icon mặc định dùng `currentColor`.
- Icon phải đi cùng tooltip nếu button không có text.
- Không dùng emoji làm icon chức năng.
- Không dùng icon 3D, gradient hoặc nhiều màu trong toolbar.
- Facebook logo là ngoại lệ nhận diện provider, không dùng thay icon chức năng.

Mapping đề xuất:

| Chức năng | Icon |
|---|---|
| Ads Manager | `LayoutDashboard` hoặc `PanelsTopLeft` |
| Campaign | `Megaphone` |
| Ad Set | `Layers3` |
| Ad | `RectangleHorizontal` hoặc `Image` |
| Reports | `BarChart3` |
| Rules | `Workflow` hoặc `Zap` |
| Assets | `FolderKanban` |
| Connections | `Plug` |
| Create | `Plus` |
| Filter | `ListFilter` |
| Columns | `Columns3` |
| Export | `Download` |
| Duplicate | `Copy` |
| Pause | `Pause` |
| Activate | `Play` |
| External Meta link | `ExternalLink` |

### 11.7. Button

Chuẩn hoá button dùng chung thay vì viết class riêng cho từng màn hình.

Variants cần có:

```text
primary
secondary
outline
ghost
destructive
link
```

Sizes:

```text
sm: toolbar/table action
md: form/default
lg: chỉ dùng CTA quan trọng ở empty/onboarding state
icon: icon-only action
```

Nguyên tắc:

- Mỗi khu vực chỉ có tối đa một primary button.
- Header Ads Manager: `Tạo chiến dịch` là primary.
- `Làm mới`, `Cột`, `Bộ lọc`, `Xuất` là outline/ghost.
- `Tiếp tục` trong wizard là primary.
- `Quay lại` là ghost/outline.
- `Lưu nháp` là secondary.
- `Publish` có confirmation và mô tả “Tạo ở trạng thái tạm dừng”.
- `Xoá` là destructive nhưng không đặt cạnh primary nếu dễ bấm nhầm.
- Icon đặt trước text, trừ chevron/progress đặt sau.
- Loading giữ nguyên chiều rộng button để layout không nhảy.
- Disabled phải kèm nguyên nhân gần control hoặc tooltip; không chỉ làm mờ.
- Không dùng gradient, glow, bounce hoặc pulse liên tục cho CTA.

### 11.8. Form và campaign wizard

- Form chia theo section có tiêu đề và mô tả ngắn.
- Không hiển thị tất cả field cho mọi objective.
- Chỉ hiển thị field phù hợp với lựa chọn trước đó.
- Advanced settings mặc định collapse.
- Validation xuất hiện gần field, không dồn toàn bộ lên toast.
- Helper text giải thích ảnh hưởng thay vì lặp lại label.
- Input tiền hiển thị currency và đơn vị Meta sử dụng.
- Schedule hiển thị timezone của ad account.
- Audience selector cho biết include/exclude rõ ràng.
- Creative preview nằm cạnh form ở desktop, dưới form ở màn hình nhỏ.
- Sticky footer wizard chứa Back, Save draft và Continue/Review.
- Khi rời trang có thay đổi chưa lưu, hiển thị cảnh báo có ngữ cảnh.

### 11.9. Data table

Ưu tiên khả năng đọc thay vì trang trí.

- Header nền trung tính, không dùng primary background.
- Row hover rất nhẹ.
- Selected row dùng primary tint nhẹ và checkbox rõ ràng.
- Không zebra stripe nếu table đã có border/hierarchy.
- Campaign/Ad Set/Ad thể hiện bằng indentation và icon nhỏ.
- Tên entity tối đa hai dòng; phần còn lại ellipsis + tooltip.
- Số căn phải, text căn trái, status căn trái/giữa nhất quán.
- Cột quan trọng sticky: selection, delivery, name.
- Không render toàn bộ breakdown trong một cell.
- Empty value dùng `—`, không dùng `0` nếu dữ liệu chưa có.
- Khi sync, giữ dữ liệu cũ và hiển thị trạng thái refreshing.
- Skeleton phải giống cấu trúc bảng, không dùng spinner che toàn màn hình.

### 11.10. Badge và trạng thái

Badge phải ngắn, ít màu và có ý nghĩa ổn định.

Ví dụ tiếng Việt:

```text
Đang hoạt động
Tạm dừng
Bản nháp
Đang xét duyệt
Bị từ chối
Có vấn đề
Đang đồng bộ
Đã lưu
Lưu thất bại
```

Không hiển thị nguyên enum như:

```text
PENDING_REVIEW
WITH_ISSUES
CAMPAIGN_PAUSED
```

Enum vẫn có thể xuất hiện trong tooltip kỹ thuật hoặc error details.

### 11.11. Modal, drawer và toast

#### Modal

Chỉ dùng cho:

- Xác nhận activate.
- Xác nhận bulk action.
- Xoá draft.
- Thao tác có ảnh hưởng tiền hoặc delivery.

Modal phải mô tả:

- Đối tượng bị tác động.
- Số lượng.
- Trạng thái trước/sau.
- Khả năng hoàn tác.

#### Drawer

Dùng cho:

- Chi tiết Campaign/Ad Set/Ad.
- Chỉnh nhanh tên, budget hoặc status.
- Xem delivery issue.
- Xem audit history.

#### Toast

- Chỉ xác nhận kết quả ngắn.
- Không dùng toast làm nơi duy nhất hiển thị lỗi form.
- Không hiển thị raw Meta error dài trong toast.
- Toast lỗi có link “Xem chi tiết” mở drawer/error panel.

### 11.12. Motion và phản hồi

- Transition thông thường `150–200ms`.
- Drawer/modal `200–250ms`.
- Tôn trọng `prefers-reduced-motion`.
- Không dùng animation lặp liên tục cho metric hoặc CTA.
- Không fake progress chạy nhanh rồi đứng ở 90%.
- Publish progress phản ánh đúng state Backend.
- Optimistic update chỉ dùng cho thao tác có thể rollback an toàn.

### 11.13. Ngôn ngữ và giọng điệu

Nội dung cần tự nhiên, bình tĩnh và minh bạch.

Nên dùng:

```text
Tạo chiến dịch
Lưu bản nháp
Kiểm tra trước khi đăng
Tạo ở trạng thái tạm dừng
Meta đang xét duyệt quảng cáo này
Chưa thể đồng bộ dữ liệu. Dữ liệu gần nhất được cập nhật lúc 10:30.
```

Không nên dùng:

```text
Chạy ads ngay!
Bùng nổ doanh số
AI tối ưu tuyệt đối
Chiến dịch chiến thắng
Đừng bỏ lỡ
```

Recommendation phải phân biệt:

- Dữ liệu thực tế.
- Cảnh báo theo rule.
- Gợi ý được tính toán.
- Hành động sẽ được thực hiện.

Không trình bày recommendation như một kết quả chắc chắn.

### 11.14. Onboarding và empty state

Empty state theo đúng nguyên nhân:

1. Chưa kết nối Meta.
2. Đã kết nối nhưng chưa có ad account.
3. Chưa có campaign.
4. Bộ lọc không có kết quả.
5. Không đủ quyền.
6. Dữ liệu đang đồng bộ lần đầu.
7. Meta API đang lỗi.

Mỗi trạng thái có:

- Tiêu đề ngắn.
- Mô tả nguyên nhân.
- Một hành động chính.
- Một hành động trợ giúp nếu cần.

Không chèn mock campaign vào production để màn hình trông “có dữ liệu”.

### 11.15. Responsive

Desktop `>= 1280px`:

- Hiển thị đầy đủ sub-navigation, summary và table.
- Creative preview nằm cạnh form.

Tablet `768–1279px`:

- Sub-navigation collapse.
- Summary cuộn ngang hoặc grid hai cột.
- Toolbar gom action ít dùng vào menu `Thêm`.

Mobile `< 768px`:

- Ưu tiên report/monitoring và quick status.
- Table chuyển sang danh sách card theo entity.
- Không cố nhét toàn bộ custom columns.
- Wizard một cột.
- Bulk edit phức tạp có thể cảnh báo nên dùng desktop.

### 11.16. Accessibility

- Contrast tối thiểu WCAG AA.
- Focus ring luôn nhìn thấy.
- Toàn bộ toolbar và table điều khiển được bằng bàn phím.
- Checkbox có accessible name.
- Icon-only button có `aria-label`.
- Table sort thông báo bằng `aria-sort`.
- Modal giữ focus và trả focus về trigger khi đóng.
- Status không phụ thuộc riêng vào màu.
- Chart có bảng dữ liệu hoặc mô tả thay thế.
- Error summary liên kết tới field lỗi.

### 11.17. Design review checklist

Trước khi merge một màn hình:

- [ ] Có dùng Admin Layout/App Sidebar hiện tại không?
- [ ] Có dùng semantic theme tokens không?
- [ ] Có hard-code màu xanh Facebook ngoài provider identity không?
- [ ] Có tái sử dụng Button/Input/Dropdown/Modal chung không?
- [ ] Một vùng có nhiều hơn một primary CTA không?
- [ ] Light và dark mode đều đọc tốt không?
- [ ] Loading có giữ dữ liệu cũ khi refresh không?
- [ ] Empty state có đúng nguyên nhân không?
- [ ] Status có text ngoài màu không?
- [ ] Keyboard và focus state hoạt động không?
- [ ] Nội dung có hứa hẹn quá mức hoặc tạo cảm giác giả tạo không?
- [ ] Publish/budget/status action có xác nhận và mô tả hậu quả không?
- [ ] Responsive không làm mất hành động quan trọng không?
- [ ] Giao diện có giống một phần của LadiPage hơn là bản clone AdsMeta không?

## 12. Các phase Frontend

### FE-0 — Foundation

- [ ] Sửa UTF-8/mojibake.
- [ ] Tạo shared API types.
- [ ] Tạo Facebook Ads API client.
- [ ] Tạo error mapper.
- [ ] Loại bỏ token/cookie khỏi persisted store.
- [ ] Cập nhật navigation.
- [ ] Tạo route skeleton.

### FE-1 — Read-only Ads Manager

- [ ] Account selector.
- [ ] Header/date/filter.
- [ ] Summary cards.
- [ ] Entity tabs.
- [ ] Campaign table.
- [ ] Ad Set table.
- [ ] Ad table.
- [ ] Pagination.
- [ ] Sorting.
- [ ] Custom columns.
- [ ] Loading/empty/error states.

### FE-2 — Draft wizard

- [ ] Wizard shell.
- [ ] Campaign step.
- [ ] Ad Set step.
- [ ] Ad step.
- [ ] Review step.
- [ ] Objective-dependent fields.
- [ ] Asset selectors.
- [ ] Autosave.
- [ ] Validation mapping.

### FE-3 — Publish

- [ ] Publish confirmation.
- [ ] Job progress.
- [ ] WebSocket/polling.
- [ ] Field-level errors.
- [ ] Retry/resume.
- [ ] Success result.
- [ ] Deep link sang Meta.

### FE-4 — Management

- [ ] Pause/resume.
- [ ] Bulk status.
- [ ] Budget edit.
- [ ] Duplicate.
- [ ] Details drawer.
- [ ] Audit history.

### FE-5 — Reports và automation

- [ ] Saved reports.
- [ ] CSV export.
- [ ] Charts.
- [ ] Performance alerts.
- [ ] Budget rules.
- [ ] Health score.
- [ ] Recommendations.

## 13. Kiểm thử Frontend

### Unit

- Format metrics/currency.
- Objective rules.
- Draft reducers/store.
- Error mapping.
- Column presets.

### Component

- Account selector.
- Entity tabs.
- Table selection.
- Filters.
- Wizard steps.
- Validation messages.
- Publish progress.

### Integration

- Load Campaign/Ad Set/Ad.
- Filter và pagination.
- Draft autosave.
- Version conflict.
- Publish success.
- Publish validation failure.
- Retryable API failure.

### E2E

```text
Connect Meta
-> Select ad account
-> View campaign
-> Create draft
-> Configure Campaign
-> Configure Ad Set
-> Configure Ad
-> Validate
-> Publish PAUSED
-> View result in Ads Manager
```

### Definition of Done

- Responsive từ laptop trở lên; mobile có layout rút gọn.
- Không có token/cookie Meta trong browser storage.
- Không gọi domain Facebook từ Frontend.
- Filter/sort/pagination là server-side.
- Draft không mất khi reload.
- Validation hiển thị đúng field.
- Publish có progress và retry rõ ràng.
- Không activate quảng cáo nếu chưa có xác nhận riêng.
- Dùng cùng semantic color tokens, typography, icon và button với LadiPage.
- Light/dark mode đạt contrast tối thiểu WCAG AA.
- Không hard-code xanh Facebook làm màu hành động chính.
- Nội dung và recommendation không hứa hẹn kết quả chắc chắn.
