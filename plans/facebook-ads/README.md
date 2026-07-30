# Facebook Ads Manager

Tài liệu triển khai tính năng quản lý và chạy quảng cáo Meta cho hệ thống LadiPage.

## Phạm vi

- Frontend: `D:\monorepo-project-workspace\ladipage-fe-v2`
- Backend: `D:\monorepo-project-workspace\liora-monorepo\apps\ladipage-backend`
- UI tham chiếu: `D:\monorepo-project-workspace\clone-UI-adsmeta`
- Extension tham chiếu hành vi: `D:\monorepo-project-workspace\extension marketing seo và ads\AdsMeta — Facebook Ads Manager`

## Tài liệu

- [Kế hoạch Backend](./PLAN-BE.md)
- [Kế hoạch Frontend](./PLAN-FE.md)
- [Báo cáo FE Mock đã triển khai](./REPORT-FE-MOCK.md)

## Nguyên tắc kiến trúc

1. Frontend không lưu Facebook cookie hoặc Meta access token.
2. Frontend không gọi Facebook Graph API trực tiếp.
3. Backend quản lý Meta OAuth, token vault và toàn bộ Marketing API.
4. Các thao tác publish chạy qua queue, có idempotency, retry và audit log.
5. Campaign, Ad Set, Creative và Ad mới được tạo ở trạng thái `PAUSED`.
6. Backend và Frontend dùng chung API contract/OpenAPI.
7. Không sao chép bundle minify của AdsMeta; chỉ tái tạo luồng sử dụng bằng component của LadiPage.
8. Facebook Ads dùng cùng layout, typography, màu semantic, icon và button của LadiPage.
9. Màu xanh Facebook chỉ dùng cho nhận diện kết nối Meta, không dùng làm màu hành động chính.
10. Giao diện ưu tiên cảm giác quen thuộc, rõ ràng và đáng tin cậy; không dùng hiệu ứng trang trí hoặc nội dung quảng cáo giả tạo.

## Luồng hệ thống

```text
ladipage-fe-v2
    -> LadiPage Backend API
        -> PostgreSQL
        -> Redis/BullMQ
            -> Facebook Ads Worker
                -> Meta Marketing API
```

## Thứ tự triển khai chung

| Giai đoạn | Backend | Frontend |
|---|---|---|
| 0 | OAuth, token vault, Meta API client | Dọn token/cookie client, API client |
| 1 | Đồng bộ tài sản và Campaign hierarchy | Ads Manager read-only |
| 2 | Insights và summary API | Metrics, bộ lọc, tuỳ chỉnh cột |
| 3 | Draft CRUD và validation | Wizard Campaign/Ad Set/Ad |
| 4 | Publish queue và state machine | Publish progress và xử lý lỗi |
| 5 | Status, budget, duplicate, bulk actions | Giao diện quản lý hàng loạt |
| 6 | Reports, alerts, automation | Reports, rules và recommendation |

## Definition of Done cho MVP

- Người dùng kết nối tài khoản Meta qua OAuth chính thức.
- Chọn được ad account trong workspace hiện tại.
- Xem Campaign, Ad Set, Ad và Insights theo khoảng ngày.
- Tạo và autosave campaign draft.
- Validate được draft trước khi publish.
- Publish qua backend job ở trạng thái `PAUSED`.
- Theo dõi được tiến trình và lỗi publish.
- Pause/resume chỉ thực hiện sau xác nhận người dùng.
- Không có Facebook cookie/token trong localStorage, IndexedDB hoặc response trả về Frontend.
