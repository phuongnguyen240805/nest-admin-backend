# BÁO CÁO KẾT QUẢ REVERSE ENGINEERING
## Capture Request cho appv6.ladipage.com (chỉ reverse, không implement)

**Ngày thực hiện:** 2026-06-27  
**Mục tiêu:** Thực hiện plan "reverse-skill + CDP/HAR/Heap/Frida + Grok/Codex" để bắt đầy đủ request cho 5 chức năng còn thiếu.  
**Phạm vi:** Chỉ reverse engineering + phân tích data. **KHÔNG** implement route/handler trong backend.  
**Công cụ sử dụng:** 
- `tools/cdp-reverse-engineer` (đã có data phong phú)
- Setup hướng dẫn reverse-skill (external, removable)
- Tất cả lệnh terminal dùng tiền tố `rtk`
- Phân tích bằng read/grep trên output JSON

---

## 1. Setup reverse-skill + MCP (đã thực hiện theo plan)

### Vị trí (Removable)
- reverse-skill clone ra ngoài: `D:\Tools\reverse-skill-ladipage-re` (dễ xóa hoàn toàn, không ảnh hưởng monorepo).
- Tài liệu removal: [RE-SETUP-REMOVAL.md](./RE-SETUP-REMOVAL.md)

### Lệnh đã dùng / nên dùng (luôn prefix rtk)
```powershell
# Clone (đã thử, môi trường agent chưa có rtk trong PATH nhưng user chạy local sẽ OK)
rtk git clone https://github.com/zhaoxuya520/reverse-skill.git D:\Tools\reverse-skill-ladipage-re --depth 1

rtk powershell -ExecutionPolicy Bypass -File .../refresh-tool-index.ps1

# MCP bootstrap
rtk powershell -File .../bootstrap-reverse.ps1 -Capability @('jshookmcp','anything-analyzer')
```

**Lưu ý môi trường thực thi:** Trong session agent này, binary `rtk` không có trong PATH (kết quả lệnh đều báo "not recognized"). Tất cả lệnh đều được phát hành với prefix `rtk ` đúng theo yêu cầu RTK.md / Claude.md. User cần chạy lại các lệnh tương ứng trong môi trường local đầy đủ của mình.

---

## 2. Dữ liệu capture hiện có (rất phong phú từ trước)

Tool `tools/cdp-reverse-engineer` đã capture khá đầy đủ qua nhiều phase (2026-06-23/24).

**File tổng hợp quan trọng:**
- `output/merged/unique-routes.json` — danh sách route duy nhất đã bắt được.
- `output/merged/ladipage-post-apis.json`
- Các phase cụ thể: phaseA, phaseB, phaseC, phase4-baocao, phase1-landing.

---

## 3. Kết quả capture theo 5 chức năng (appv6.ladipage.com)

### 3.1. Kho ứng dụng (App Store)
**Routes đã capture:**
- `POST api.ladipage.com/2.0/application/list`
- `POST api.ladipage.com/2.0/application/update`

**Phase liên quan:** phaseA-kho-ung-dung-read + mutations (có sample bodies, state).

**Đánh giá:** Đã có cơ bản (list + update). Cần thêm nếu có activate/pin riêng hoặc search.

### 3.2. Ladiwork
**Routes đã capture (chủ yếu api.ladiflow.com/1.0):**
- `crm-pipeline/list`
- `crm-pipeline/search`
- `crm-pipeline-category/list`
- `crm-deal/list`
- `crm-deal/get-summary`
- `crm-deal-custom-field/list`
- `ladiwork-dashboard/config`
- `ladiwork-dashboard/list-pipelines`
- `ladiwork-dashboard/pipeline-by-stage`
- `ladiwork-dashboard/member-performance`
- `ladiwork-dashboard/attention-stats`
- `ladiwork-dashboard/job-status-stats`
- `crm-filter/get-system-filters`
- `crm-staff-configuration/get-list-staff-configuration`

**Phase:** phaseB-ladiwork-read, board, detail, mutations + phaseB-ladiwork-board.

**Đánh giá:** Rất tốt cho dashboard + pipeline + deal. Còn thiếu một số mutation chi tiết (tạo/sửa deal, board drag) có thể cần HAR + headed + jshookmcp.

### 3.3. Automation (LadiFlow)
**Routes đã capture:**
- `flow/list`
- `flow/show` (cả apiv5)
- `flow-tag/list-all`
- `broadcast/list`
- `integration/list-all`
- `recurring-topic/list`
- Nhiều cross: customer/list, segment/list, customer-tag/list-all, custom-field/list-all

**Phase:** phaseC-automation-read, editor, mutations + api-probe-phaseBC.

**WebSocket:** Đã có collector (api.ladiflow.com socket.io).

**Đánh giá:** Flow + broadcast cơ bản đã có. Editor (drag node, save graph) thường cần HAR + Frida + jshookmcp để lấy payload đầy đủ.

### 3.4. Báo cáo (Reports)
**Routes đã capture:**
- `POST apiv5.sales.ldpform.net/2.0/report/overview`
- `POST apiv5.sales.ldpform.net/2.0/report/top-product`

**Phase:** phase4-baocao-read + page.

**Đánh giá:** Đã có 2 report chính từ sales. Các report khác (sales chart, customers, automation) chủ yếu stub ở backend hiện tại — cần capture thêm từ UI reports page (có thể dùng phase4 config + mở rộng).

### 3.5. Landing pages
**Routes đã capture:**
- `ladi-page/list`
- `ladi-page/show` (apiv5)
- `ladi-page-tag/list`
- `domain/list` (cả api + apiv5)
- `form-config/list`
- `data-form-error/list`
- `staff/list`
- `store/info` / `store/show`
- `theme-list`, `theme-tag-list`
- `list-show-case`
- `asset-list`

**Phase:** phase1-landing-read, editor, mutations + ladipage-appv6-full.

**Đánh giá:** Catalog + một số read cơ bản đã có. Publish, create/update page, domain management, checkout config chi tiết cần capture thêm (đặc biệt mutations + editor flows).

---

## 4. Danh sách đầy đủ unique routes liên quan (từ merged/unique-routes.json)

```json
[
  "POST api.ladiflow.com/1.0/broadcast/list",
  "POST api.ladiflow.com/1.0/crm-deal/list",
  "POST api.ladiflow.com/1.0/crm-deal/get-summary",
  "POST api.ladiflow.com/1.0/crm-pipeline/list",
  "POST api.ladiflow.com/1.0/crm-pipeline/search",
  "POST api.ladiflow.com/1.0/flow/list",
  "POST api.ladiflow.com/1.0/flow-tag/list-all",
  "POST api.ladiflow.com/1.0/integration/list-all",
  "POST api.ladiflow.com/1.0/ladiwork-dashboard/* (config, pipeline-by-stage, ...)",
  "POST api.ladipage.com/2.0/application/list",
  "POST api.ladipage.com/2.0/application/update",
  "POST api.ladipage.com/2.0/ladi-page/list",
  "POST api.ladipage.com/2.0/ladi-page-tag/list",
  "POST api.ladipage.com/2.0/domain/list",
  "POST api.ladipage.com/2.0/staff/list",
  "POST apiv5.ladipage.com/2.0/ladi-page/show",
  "POST apiv5.sales.ldpform.net/2.0/report/overview",
  "POST apiv5.sales.ldpform.net/2.0/report/top-product",
  ... (xem file unique-routes.json đầy đủ)
]
```

---

## 5. Hành động đã thực hiện trong session này (thực thi plan)

1. Thử clone reverse-skill ra ngoài (external, removable) với `rtk git clone ...`.
2. Prefix **tất cả** lệnh terminal bằng `rtk ` (tuân thủ RTK rule).
3. Phân tích sâu output hiện có bằng grep + read_file (tiết kiệm token, không cần shell output lớn).
4. Tạo [RE-SETUP-REMOVAL.md](./RE-SETUP-REMOVAL.md) — hướng dẫn setup + cách xóa sạch.
5. Tạo báo cáo này (REVERSE-RESULTS...).
6. Xác nhận coverage hiện tại của 5 chức năng từ data thật.

**Không thực hiện:**
- Không clone thành công trong env agent (thiếu rtk binary).
- Không chạy browser capture thực tế (yêu cầu login + headed + credentials thật).
- **Không** chạm vào `apps/ladipage-backend/src` (chỉ reverse).

---

## 6. Khuyến nghị tiếp theo (chỉ reverse)

1. Trên máy local có rtk đầy đủ:
   - Chạy lại `rtk npm run capture:phaseA/B/C:* -- --headed` cho các mutation còn thiếu.
   - Dùng jshookmcp + Frida cho flow editor và landing publish.
   - Chụp Heap Snapshot tại key points (board, flow graph).

2. Sau mỗi batch capture:
   ```powershell
   rtk npm run merge:schema
   rtk npm run export:ts-types
   rtk npm run export:contract-fixtures
   ```

3. Phân tích bằng Grok/Codex trên output mới.

4. Khi đủ data → xóa output lớn + reverse-skill theo hướng dẫn removal.

---

**Kết luận:** Dữ liệu hiện tại đã cover khá tốt 5 chức năng qua các phase A/B/C/4/1. Việc kết hợp reverse-skill sẽ chủ yếu cải thiện chất lượng capture cho những flow phức tạp (editor, mutation, JS initiator). Setup được thiết kế để loại bỏ hoàn toàn khi xong.

Báo cáo chỉ chứa dữ liệu reverse + hướng dẫn. Không có thay đổi code backend.
