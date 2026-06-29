# Plan: Kết hợp reverse-skill + CDP/HAR/Heap/Frida + Grok/Codex Analysis
## Bắt đầy đủ Request cho 5 chức năng còn thiếu trong ladipage-backend

**Ngày:** 2026-06-27  
**Mục tiêu:** Hoàn thiện backend cho **Báo cáo, Landing pages, Ladiwork, Kho ứng dụng, Automation** bằng cách capture contract API production một cách hệ thống và chính xác nhất.  
**Phương pháp chính:** 
- Tận dụng **tools/cdp-reverse-engineer** hiện có (CDP core + Playwright + exporters).
- **Kết hợp reverse-skill** (https://github.com/zhaoxuya520/reverse-skill) làm router + methodology + execution surface mạnh hơn cho JS/Web RE.
- 4 lớp capture đầy đủ: **CDP + HAR + Heap Snapshot + Frida**.
- **Grok/Codex analysis loop** (phân tích sâu, map sang code backend, propose implementation).

---

## 1. Hiện trạng & Gap

### 1.1. Công cụ hiện có (rất mạnh)
- `tools/cdp-reverse-engineer/`
  - Config phase sẵn: `phase1-landing*`, `phase4-baocao*`, `phaseA-kho-ung-dung*`, `phaseB-ladiwork*`, `phaseC-automation*`.
  - Collectors: network, websocket, state, (đang có heap hints).
  - Exporters: ladipage-flow, ts-types (libs/ladipage-types), contract-fixtures (test/contract), nestjs hints.
- `plans/`: `plan-capture-heap-cdp-frida-har.md`, `plan-reverse-engineering-ladipage.md`, phase-specific plans.
- Output đã có nhiều dữ liệu merged.

### 1.2. Những gì còn thiếu / yếu
- Landing pages (publish, page CRUD, domain, builder bridge, staff, tags...): nhiều route TODO trong `ladipage-rpc`.
- Reports (baocao): một số report stub (automation/jobs trả 0).
- Ladiwork: chỉ seed + vài handler RPC, thiếu mutation thật, board đầy đủ.
- Kho ứng dụng: chỉ `application/list + update` (seed), thiếu activate/pin/full catalog behavior.
- Automation (LadiFlow): dispatcher + TODOs, thiếu flow editor, broadcast, integration, execution surface.
- Nhiều mutation phức tạp (drag-drop editor, flow save) bị headless CDP bỏ sót.
- JS side (request builder, state management, owner-id vs store-id) chưa phân tích sâu.

### 1.3. Giá trị của reverse-skill
- **routing.md + SKILL.md**: Bắt buộc route trước khi capture → tránh đoán mò.
- **browser-automation**: Playwright tốt hơn (snapshot → element refs `@e1` thay vì selector brittle).
- **js-reverse + jshookmcp**: 
  - Tìm initiator của request (ai gọi fetch/XHR).
  - Hook runtime, SourceMap, AST deobfuscate request builder.
  - Break on XHR, evaluate script.
- **anything-analyzer**: bổ sung capture + AI analysis HTTP.
- **Frida patterns + field-journal**: tự evolution + best practice cho dynamic analysis.
- Tích hợp MCP, hooks, tự bootstrap tool (jshookmcp, Playwright...).

**Kết hợp =** Existing CDP tool (đã custom cho LadiPage) + reverse-skill methodology + execution layer mạnh + AI (Grok/Codex) phân tích sâu → contract chính xác → implement nhanh, ít sai lệch.

---

## 2. Kiến trúc tổng thể (Workflow)

```
1. Setup & Bootstrap
   - Clone/use reverse-skill (nếu muốn full)
   - Register MCP (jshookmcp, anything-analyzer)
   - Inject routing vào Claude/Codex hooks (đọc SKILL.md + routing.md trước)
   - Chuẩn bị Frida + Chrome remote debug

2. Per-Feature Capture Loop (5 chức năng)
   Route qua reverse-skill (js-reverse hoặc browser-automation)
        ↓
   4 lớp capture (CDP enhanced + HAR + Heap + Frida)
        ↓
   Export (giữ nguyên pipeline cdp-reverse-engineer)
        ↓
   Grok/Codex Analysis
        - Đọc output/*.json + heapsnapshot + har
        - Map route → RPC resource/action hoặc REST
        - Đề xuất DTO, mapper, handler, seed/service
        - Viết contract test fixture
        ↓
   Implement & Verify trong ladipage-backend
        - Update ladipage-types
        - Wire LadipageRpc / LadiflowRpc registrar
        - Thêm service + mapper thực
        - Chạy contract test / smoke
        ↓
   Field-journal / update plan (evolution)

3. Merge & Schema Pipeline (giữ nguyên)
   npm run merge:schema && export:ts-types && export:contract-fixtures
```

---

## 3. Setup Prerequisites (Windows - PowerShell)

### 3.1. reverse-skill (khuyến nghị clone song song)
```powershell
# Nơi đặt (không nhất thiết trong monorepo)
cd D:\Tools
git clone https://github.com/zhaoxuya520/reverse-skill.git
cd reverse-skill

# Bắt buộc
powershell -ExecutionPolicy Bypass -File skills/scripts/refresh-tool-index.ps1

# Đọc và bootstrap
# Sau đó đọc RULES.md (AI tự config)
```

### 3.2. MCP Integration (cho Claude Code / Codex / Cursor)
Thêm vào MCP config (ví dụ `.claude/mcp.json` hoặc tương đương):

```json
{
  "mcpServers": {
    "jshook": {
      "command": "npx",
      "args": ["-y", "@jshookmcp/jshook@latest"],
      "env": { "JSHOOK_BASE_PROFILE": "search" }
    },
    "anything-analyzer": {
      "url": "http://localhost:23816/mcp"
    }
  }
}
```

Chạy bootstrap nếu cần:
```powershell
powershell -File D:\Tools\reverse-skill\skills\scripts\bootstrap-reverse.ps1 -Capability @('jshookmcp', 'anything-analyzer') -StartServices
```

### 3.3. Chuẩn bị cho 4 lớp trong monorepo
- Giữ nguyên `tools/cdp-reverse-engineer`
- Bổ sung:
  - `src/cdp/heap-collector.ts` (nếu chưa)
  - `src/har/parse-har.ts`
  - `frida/scripts/hook-*.js` (hook fetch + ladiflow specific)
  - Cập nhật `merge-captures.ts` để union cả Frida + HAR parsed.

### 3.4. Auth session (dùng chung)
```powershell
cd tools/cdp-reverse-engineer
npm run capture:ladipage:login     # hoặc manual + lưu storageState
npm run capture:ladipage:session
```

---

## 4. 4 Lớp Capture — Chuẩn hóa (Kết hợp reverse-skill)

### Lớp 1: CDP (Playwright + CDP domains) — Nguồn chính
- Dùng tool hiện tại, nhưng **kích hoạt qua browser-automation patterns** khi cần (snapshot trước click).
- Bật thêm:
  - `HeapProfiler.enable` + `takeHeapSnapshot`
  - `Runtime.enable` (để dump `window.__NEXT_DATA__`, LadiPage globals, Zustand/Redux nếu có)
- Config mẫu đã có → chỉ cần làm robust hơn với element-ref từ reverse-skill.

### Lớp 2: HAR (Chrome thật)
- Preserve log + disable cache.
- Export sau khi thực hiện mutation phức tạp (flow editor, board drag, publish).

### Lớp 3: Heap Snapshot
- Trigger điểm: sau module boot, sau list response, sau mở editor/detail, sau mutation.
- Phân tích (bằng tay hoặc script + AI): tìm object chứa `authorization`, `ownerId`, `storeId`, flow graph, application catalog, task/board state.

### Lớp 4: Frida+
- Attach Chrome (remote debugging port 9222).
- Script chính:
  - `hook-fetch.js` / `hook-xhr.js` (log mọi POST *.ladipage.com / *.ladiflow.com / *.ldpform.net)
  - `hook-ladiflow.js` (đặc biệt owner-id header, WS emit)
- Output JSONL → merge vào unique routes.

**Quy tắc**: Mỗi lần capture phải chạy đủ 4 lớp (hoặc giải thích tại sao thiếu 1 lớp). Luôn union routes.

---

## 5. Phased Execution (5 Chức năng)

### Phase 0 (chung) — Auth + Infrastructure + Reports baseline
- Chạy lại phase4-baocao (đã có config).
- Bổ sung report automation/jobs thật (nếu stub ở FE).

### Phase 1 — Landing Pages (mở rộng phase1)
**Routes cần bắt đầy đủ**:
- `ladi-page/list`, `ladi-page/show`, `ladi-page/create|update|delete|publish`
- `domain/*`, `page-tag/*`, `staff/*`
- `form-config/*`, `data-form-error/*`, `page-checkout/*`
- Publish flow (build + asset upload)

**URL FE**: `/ladipage`, `/editor`, `/ladipage/templates`, `/ladipage/domains`

**Đặc biệt**:
- Dùng js-reverse + jshookmcp để tìm request builder (thường bị obfuscate).
- Heap dump editor state.
- HAR bắt publish/upload.

### Phase A — Kho ứng dụng (App Store)
Config sẵn: `phaseA-kho-ung-dung-read/mutations`

Cần thêm:
- Activate / deactivate / install flow (có thể gộp trong `application/update`)
- Pin / unpin
- Catalog đầy đủ + pricing / trial info
- `store/info`, `store/show`

Dùng browser-automation cho menu launcher ổn định hơn.

### Phase B — Ladiwork
Config sẵn.

Cần:
- Board / Kanban view (list by stage, drag)
- Deal create/update/delete, summary, filters
- Pipeline CRUD
- Member performance, attention stats (dashboard)
- Cross-ref với CRM (customer, tag, segment)

Heap quan trọng để map deal object graph.

### Phase C — Automation (LadiFlow) — Khó nhất
Config sẵn + `api-probe-phaseC`.

Cần bắt:
- `flow/list`, `flow/show`, `flow/save` (editor graph)
- `broadcast/*`
- `integration/*`, `flow-tag/*`
- Trigger / action / condition nodes
- WebSocket realtime (api.ladiflow.com)
- Report automation

**Bắt buộc**: 
- Activate app trước (từ Phase A).
- Dùng jshookmcp + Frida cho flow editor (drag node → save payload).
- HAR cho mutation editor.

### Phase X (bổ sung) — Reports đầy đủ + cross features
- Sales, Business, Customers, Automation report thực.
- Top product, funnel, segment breakdown.
- Kết hợp data từ Ecom + CRM + Ladiwork.

---

## 6. Grok/Codex Analysis Loop (Sau mỗi capture batch)

Sau khi có output mới:

1. Đọc toàn bộ:
   - `ladipage-post-apis.json` / `ladiflow-post-apis.json`
   - `state.json`
   - `websockets.json`
   - Sample bodies (read + mutation)
   - Heap snapshot (tìm key objects)
   - HAR parsed (nếu có)

2. Phân tích:
   - Request pattern: POST /2.0/{resource}/{action} hoặc /1.0/ cho ladiflow.
   - Headers bắt buộc: `authorization`, `store-id` / `owner-id`.
   - Body shape (lang, pagination, filter, mutation payload).
   - Response shape → map sang types.
   - Error cases.

3. Map sang backend:
   - Resource/action → LadipageRpc dispatcher hoặc Ladiflow.
   - Đề xuất registrar + service (seed → real DB hoặc proxy).
   - Tạo/update mapper (reverse của FE → BE entity).
   - DTO từ sample bodies.
   - RPC context (storeId, ownerId).

4. Produce:
   - Updated `libs/ladipage-types/src/...`
   - Contract fixture JSON (test/contract/phaseX)
   - Mappers mới (nếu cần)
   - Service skeleton + TODO tests
   - Diff cho `ladipage-rpc` / `ladiflow-rpc` / modules tương ứng.

5. Verify loop:
   - Implement handler.
   - Chạy backend → replay request (từ capture) qua tool hoặc curl.
   - So sánh response.
   - Cập nhật contract test.

Lặp cho đến khi mọi route quan trọng có response shape khớp (hoặc documented difference).

---

## 7. Deliverables

| Chức năng          | Types                  | Fixtures                  | RPC / REST                | BE Module / Service              | Docs |
|--------------------|------------------------|---------------------------|---------------------------|----------------------------------|------|
| Báo cáo            | analytics + dashboard  | phase4 + report*          | /analytics/reports/*      | analytics.service mở rộng        | - |
| Landing pages      | landing/*              | phase1 + new              | ladipage-rpc (page, domain...) | publish + website + domain + builder-bridge | reverse/phase1-*.md |
| Kho ứng dụng       | landing/application    | phaseA                    | application/list+update   | app-store (mở rộng lifecycle)    | - |
| Ladiwork           | ladiwork/*             | phaseB                    | ladiflow: crm-pipeline, crm-deal, ladiwork-dashboard | ladiwork services + dashboard    | plan-w2-1... |
| Automation         | automation/*           | phaseC                    | ladiflow + v5 (flow, broadcast...) | automation module + ladiflow mappers | - |

**Chung**:
- Cập nhật `output/merged/schema-tables-merged.json`
- `docs/reverse/phase*-full-capture.md` (kết hợp reverse-skill experience)
- Field-journal entry (nếu dùng reverse-skill) hoặc update plans.

---

## 8. Lịch & Lệnh Thực Hiện (Gợi ý)

### Tuần 1: Setup + Reports + Kho ứng dụng + Landing cơ bản
```powershell
# 1. Bootstrap reverse-skill + MCP
# 2. Chạy lại phase4 + phaseA (headed cho mutations)
cd tools/cdp-reverse-engineer
# Dùng browser-automation hoặc cdp tool

# 3. Phân tích Grok
# 4. Implement app-store + analytics đầy đủ + một số landing RPC
```

### Tuần 2: Ladiwork (board + deal + mutation)
- Capture read + detail + mutations (headed + HAR + Frida).
- Heap cho board state.

### Tuần 3: Automation (flow editor là ưu tiên)
- Activate app trước.
- Capture flow editor (jshookmcp + Frida bắt buộc).
- WS + broadcast.

Song song hàng ngày:
```powershell
npm run merge:schema
npm run export:ts-types
npm run export:contract-fixtures
```

---

## 9. Rủi ro & Mitigation

| Rủi ro                              | Mitigation (reverse-skill + kỹ thuật) |
|-------------------------------------|---------------------------------------|
| Headless fail / anti-bot            | jshookmcp + Frida + headed + HAR     |
| Selector thay đổi (SPA)             | browser-automation snapshot + ref    |
| Flow editor drag-drop không capture | jshookmcp break + Frida hook + HAR   |
| Heap file khổng lồ                  | Chỉ snapshot tại trigger points      |
| owner-id vs store-id lẫn lộn        | Frida + state.json + js-reverse      |
| Legal/ToS                           | Chỉ account test cá nhân             |

---

## 10. Evolution & Documentation

- Sau mỗi phase thành công: viết field-journal (theo template reverse-skill) hoặc cập nhật `plans/plan-*.md` + `docs/reverse/`.
- Update `tools/cdp-reverse-engineer` scripts nếu phát hiện pattern mới.
- Thêm reusable hook scripts vào `frida/scripts/`.
- Cập nhật routing knowledge (nếu mở rộng reverse-skill local).

---

## 11. Action Items Ngay (Bắt đầu)

1. Clone + bootstrap reverse-skill (nếu chưa).
2. Đăng ký jshookmcp + test MCP call được.
3. Chạy một capture nhỏ với browser-automation (hoặc enhance current tool) cho Phase A mutation.
4. Chụp Heap + Frida lần đầu cho Ladiwork hoặc Automation.
5. Grok đọc output mới nhất + đề xuất implementation cho ít nhất 2 route còn thiếu (ví dụ `application/update` thật + một flow list).
6. Tạo PR/branch cho capture kết quả + types + 1-2 handler.

---

**Kết luận**: Kết hợp này cho phép capture **đầy đủ, có cấu trúc, dễ reproduce, và có bằng chứng JS/runtime** cho 5 chức năng còn thiếu. Existing CDP tool cung cấp pipeline xuất contract/types, reverse-skill cung cấp execution + methodology tốt hơn, Grok/Codex đóng vai trò "human reverse engineer" phân tích và dịch sang backend implementation.

Bắt đầu bằng setup + một phase nhỏ (Kho ứng dụng hoặc Ladiwork read) để validate workflow kết hợp.

Sau khi xong plan này, có thể dùng `/execute-plan` hoặc spawn subagent để thực thi từng phase capture + implement.
