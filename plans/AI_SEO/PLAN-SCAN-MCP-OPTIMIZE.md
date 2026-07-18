# Plan: Tối ưu Scan AI-SEO · Nest→MCP · Score cards · AI tối ưu landing

> **Phạm vi:** Bổ sung gap Adapter Nest → OpenSEO MCP, FE scan → score cards, AI tối ưu landing (audit page + tasks + deploy).  
> **Không bao gồm code implementation** — chỉ cấu trúc, mục tiêu, phase, DoD, PR plan.  
> **Ngày soạn:** 2026-07-18  
> **Nền:** Audit runtime (OpenSEO MCP live :7003, 19 tools research) + code Nest/FE hiện tại + plans `AI-SEO-LANDING-INTEGRATION.md`, `plan-be-ai-seo-openseo.md`, `checklist-openseo.md`.

---

## 0. Mục tiêu đạt được (Outcome)

### 0.1 Mục tiêu sản phẩm

| # | Mục tiêu | Định nghĩa xong (user thấy gì) |
|---|----------|--------------------------------|
| G1 | **Scan tin cậy** | Bấm “Quét” → job hoàn thành → score cards cập nhật (technical / content / UX / authority / grader) |
| G2 | **Scan đúng URL landing đã publish** | Audit/overview dùng `publicUrl` (custom domain hoặc `/p/{slug}` absolute), không dùng hostname local/UUID |
| G3 | **Task tối ưu từ scan** | Sau scan có danh sách task (meta, H1, content, technical) approve / reject / deploy |
| G4 | **Deploy meta vào landing live** | Deploy task → cập nhật meta landing + revalidate public page; lần scan sau phản ánh thay đổi |
| G5 | **Adapter MCP đầy đủ (research suite)** | Nest gọi có kiểm soát: domain overview, keywords, backlinks, SERP, GSC inspect — có cache + quota |
| G6 | **AI coach hỗ trợ tối ưu** | Agent/chat dùng dữ liệu scan + tool MCP (khi có) để đề xuất actionable, không còn agent static rỗng |

### 0.2 Mục tiêu kỹ thuật

| # | Mục tiêu | Định nghĩa xong |
|---|----------|-----------------|
| T1 | Nest là **single orchestration** | FE không gọi OpenSEO trực tiếp; chỉ Nest MCP client |
| T2 | Fail-soft + actionable errors | OpenSEO down / domain invalid / quota → 503/422 message rõ, không silent empty score |
| T3 | Tenant isolation | Mọi job/task/scan join `tenantId`; không lộ `openseoProjectId` như capability FE |
| T4 | Dual path scan | Path A: `get_domain_overview` (MCP v0.0.x hiện tại); Path B: `start_audit` khi OpenSEO/image hỗ trợ |
| T5 | Score contract ổn định | FE mapper một shape `holisticScores` + `AiSeoScores` dù nguồn overview hay audit thật |

### 0.3 Ngoài phạm vi plan này

- OpenSEO fork / implement `start_audit` trong OpenSEO (track riêng; plan chỉ **consume** khi tool xuất hiện)
- Billing DataForSEO chi tiết per-workspace (chỉ giữ quota gate + cache)
- Full suite Authority / Local / Rank tracker UI (chỉ wire adapter + data sẵn cho phase sau)
- App Store gate / RBAC chi tiết (tham chiếu plan landing integration)

---

## 1. Hiện trạng (baseline 2026-07-18)

### 1.1 Đã có

| Lớp | Hiện trạng |
|-----|------------|
| OpenSEO | Docker/local `:7003`, MCP live, `whoami` OK, 1 project Default |
| Nest client | `OpenSeoClientService`: health, list/bind project, startAudit fallback overview, keywords, GSC tools |
| Nest scan | `POST /projects/:id/scan` → ensure link → startAudit → task + holisticScores (domain-overview path) |
| FE | Nest mode bật; Scan button + job poll; score cards trên project card |
| Keywords | Research + cache Redis/DB |
| Tasks | CRUD status approve/reject/deploy — **deploy chỉ ghi metadata SEO project** |

### 1.2 Gap (baseline → target)

| Gap ID | Vùng | Mô tả | Ảnh hưởng |
|--------|------|-------|-----------|
| **A1** | Adapter Nest→MCP | Chưa wire tools: backlinks, SERP, ranked keywords, domain keyword suggestions, competitors | Score/task nghèo; không tận dụng MCP 19 tools |
| **A2** | Adapter | `create_project` / `start_audit` không có trên MCP → bind Default project + overview only | Mọi tenant có thể share 1 OpenSEO Default |
| **A3** | Adapter | Domain public required; local/`*.landing.local` fail | Scan publish localhost gần như luôn fail |
| **A4** | Adapter | Không health surface cho FE; error mapping chưa chuẩn hóa | UX “Quét thất bại” mơ hồ |
| **S1** | FE scan→scores | Domain-overview scores là **heuristic**, không Lighthouse | Cards “có số” nhưng không phản ánh page HTML |
| **S2** | FE scan→scores | `startUrl` = `https://{hostname}` — chưa ưu tiên `publicUrl` page publish | Scan sai URL |
| **S3** | FE scan→scores | Job domain-overview complete ngay; poll/invalidate OK nhưng **landing page scanStatus** ít khi sync | Bảng landing pages vẫn “Chưa quét” |
| **S4** | FE scan→scores | Score cards empty state / error state / partial score chưa productized | User không biết vì sao 0 điểm |
| **L1** | AI tối ưu landing | `scanLandingPage` = scan project, **không** audit URL page | Không tối ưu theo landing |
| **L2** | AI tối ưu landing | Scan **không sinh** task ON_PAGE/CONTENT | Task board trống hoặc manual |
| **L3** | AI tối ưu landing | Deploy không ghi `published_meta` / re-publish HTML | “Tối ưu” không lên live |
| **L4** | AI tối ưu landing | Agents/chat static — không MCP / không context scan | Không AI coach thật |
| **L5** | AI tối ưu landing | Không auto-scan sau publish (optional product) | User phải bấm Quét thủ công |

---

## 2. Kiến trúc đích (logical)

```
┌──────────────┐  scan / tasks / deploy   ┌─────────────────────┐
│ FE AI-SEO    │ ───────────────────────► │ Nest AiSeoModule    │
│ score cards  │ ◄── scores + tasks ───── │  orchestration      │
│ task board   │                          │  quota · cache · map│
└──────────────┘                          └──────────┬──────────┘
                                                     │ MCP tools/call
                                          ┌──────────▼──────────┐
                                          │ OpenSEO :7003 /mcp  │
                                          │ research tools now  │
                                          │ (+ audit later)     │
                                          └─────────────────────┘
                                                     │
                     publicUrl /p/slug or custom ◄───┘ crawl/overview domain
┌──────────────┐  deploy meta + revalidate  ┌─────────────────────┐
│ Landing L1   │ ◄───────────────────────── │ Nest publish / CMS  │
│ published_*  │                            │ (single write path) │
└──────────────┘                            └─────────────────────┘
```

### 2.1 Hai lớp scan (bắt buộc thiết kế dual-path)

| Path | Nguồn | Khi nào | Output |
|------|--------|---------|--------|
| **A — Domain intelligence** | `get_domain_overview` (+ optional backlinks/ranked keywords) | MCP hiện tại; domain public | Holistic scores heuristic + domain metrics snapshot |
| **B — Page audit** | `start_audit` / Lighthouse / on-page (khi tool có) **hoặc** Nest-side lightweight HTML fetch + rule engine (MVP-B) | Prefer publicUrl landing | Page scores + **structured issues → tasks** |

**Quyết định kiến trúc (xem §6):** MVP ship Path A đầy đủ + **Path B-lite** (Nest fetch public HTML + rules) để có task tối ưu landing **không chờ** OpenSEO `start_audit`.

### 2.2 Pipeline tối ưu landing (target)

```
Publish (có publicUrl)
  → ensure SEO project + link page
  → (optional) enqueue scan job
       → Path A domain overview
       → Path B-lite page rules on publicUrl
       → map issues → lp_seo_task
  → FE: scores + task board
  → User approve → Deploy
       → patch published_meta (+ optional HTML head)
       → revalidate L3
       → mark task deployed
```

---

## 3. Cấu trúc plan theo 3 trụ gap

### Trụ 1 — Adapter Nest → MCP (A*)

**Mục tiêu:** Client MCP “đủ tools + ổn định + quan sát được”, không phình business logic.

#### 3.1.1 Phạm vi adapter

| Nhóm tool MCP | Priority | Nest surface | Dùng cho |
|---------------|----------|--------------|----------|
| `whoami`, `list_projects` | P0 | health + bind project | Connectivity |
| `get_domain_overview` | P0 | scan Path A | Scores baseline |
| `research_keywords`, `get_keyword_metrics`, `list/save_keywords` | P0 | keywords API (đã partial) | Research |
| `get_domain_keyword_suggestions` | P1 | scan enrichment / tasks seed | Content tasks |
| `get_backlinks_overview`, `get_backlinks_profile` | P1 | authority scores / metrics | Authority card |
| `get_ranked_keywords` | P1 | content/authority signals | Ranked set |
| `get_serp_results`, `find_serp_competitors` | P2 | SERP preview API | Competitive |
| `get_search_console_performance`, `inspect_urls` | P1 | GSC (0 credit) | Index + opportunities |
| Local tools | P3 | later suite | Local SEO app |
| `start_audit` / skills | P2** | scan Path B full | Khi OpenSEO expose |

#### 3.1.2 Deliverables adapter

1. **Tool catalog** trong Nest (registry): name, credit class, timeout, tenant-safe args.  
2. **Normalize errors:** unavailable / invalid domain / quota / tool missing → stable error codes.  
3. **Project binding policy:** match by domain → Default → create when tool exists; **không** im lặng map mọi hostname vào Default nếu domain mismatch (flag `binding: matched | fallback | none`).  
4. **Observability:** log tool, latency, credits (nếu có), projectId OpenSEO (server-only).  
5. **Health endpoint** đã có → FE/ops dashboard “OpenSEO: ok | down”.

#### 3.1.3 Mục tiêu đo (Adapter)

| Metric | Target |
|--------|--------|
| `GET /ai-seo/health` ok khi OpenSEO up | 100% env dev/staging |
| Scan Path A success rate domain public + DFS key | ≥ 90% |
| Tool coverage used / available (research) | ≥ 8/19 tools wire hoặc deliberate defer |
| Time-to-fail invalid domain | < 2s, message actionable |

---

### Trụ 2 — FE scan → score cards (S*)

**Mục tiêu:** Nút Quét → job → cards phản ánh đúng dữ liệu + trạng thái rõ.

#### 3.2.1 Luồng FE target

```
Scan click
  → POST scan (depth quick|full)
  → { jobId, status, mode: domain_overview | page_audit | hybrid }
  → poll job 2s
  → on success: invalidate projects + landing-pages + tasks
  → score cards re-render from project.holisticScores / scores mapper
  → error banner if status failed (message từ Nest)
```

#### 3.2.2 Score contract (ổn định cho FE)

| Field FE | Nguồn Path A | Nguồn Path B-lite / full |
|----------|--------------|---------------------------|
| `technicalScore` | heuristic overview / backlinks tech proxy | page rules: title length, meta, headings, canonical |
| `contentScore` | organic keywords / suggestions | H1, content length, keyword presence |
| `uxScore` | traffic proxy | perf heuristics if available / static rules |
| `authorityScore` | backlinks + referring domains | same + optional GSC |
| `graderScore` | average weighted | weighted page + domain |
| `lastScanAt` | project.lastAnalysisAt | same |
| `taskStatus` | pending/running/done/failed | same |

**Quy tắc UI:**

- Score `null` / chưa scan → “—” không phải `0` (tránh hiểu nhầm 0 điểm).  
- Partial (Path A ok, Path B fail) → badge “Domain only” vs “Full page”.  
- Failed → giữ scores cũ + toast/error text.

#### 3.2.3 startUrl resolution (bắt buộc)

Thứ tự ưu tiên:

1. Linked landing `pageUrl` / `published_url` (absolute public)  
2. Project `publicUrl` cached sau publish  
3. `https://{hostname}` nếu hostname public registrable  
4. Else **block scan** với message: cần publish + domain public / custom domain  

#### 3.2.4 Landing page row sync

- Scan project → cập nhật `lp_seo_project_page.scanStatus`, `scores`, `lastScanJobId` cho **mọi page linked** (hoặc page được chọn).  
- FE bảng landing pages phản ánh completed + điểm.

#### 3.2.5 Mục tiêu đo (Scan → cards)

| Metric | Target |
|--------|--------|
| Happy path domain public: click → cards update | < 30s Path A |
| Invalid domain: message rõ, không spinner vô hạn | 100% |
| Landing table sync scanStatus | 100% linked pages |
| Empty vs zero score UX | Spec UI pass review |

---

### Trụ 3 — AI tối ưu landing: audit page + tasks + deploy (L*)

**Mục tiêu:** Đóng vòng “phát hiện → đề xuất → áp dụng lên landing live”.

#### 3.3.1 Page audit (Path B-lite — MVP không chờ OpenSEO audit)

**Input:** `publicUrl` (GET HTML, timeout, size cap, robots-respect optional).  

**Rule packs (v1):**

| Pack | Issues ví dụ | Task type |
|------|--------------|-----------|
| Meta | missing/short/long title, description | ON_PAGE |
| Headings | missing H1, multiple H1 | ON_PAGE |
| Content | thin content threshold | CONTENT |
| Links | no canonical, broken internal (basic) | TECHNICAL |
| Social | missing OG (optional) | ON_PAGE |
| SEO pixel | missing Liora pixel if expected | INSTALL |

**Output:** list `Issue { code, severity, selector?, current, suggested, evidence }`.

Path B-full (sau): thay/cộng Lighthouse + OpenSEO `start_audit` khi có.

#### 3.3.2 Task generation

Sau scan hybrid:

1. Map issues → `lp_seo_task` (`type`, `payload`, `status=pending`).  
2. Dedup theo `(projectId, type, code, pageId)` trong N ngày.  
3. Gắn `websitePageId` / landing page id.  
4. FE Task board + landing task drawer hiện task mới.

Enrichment (P1): dùng `get_domain_keyword_suggestions` / research để gợi ý title/H1 copy.

#### 3.3.3 Deploy pipeline

| Step | Hành động | Owner |
|------|-----------|--------|
| 1 | User approve task | FE |
| 2 | Deploy | Nest task service |
| 3 | Map suggestion → fields landing (`seoTitle`, `seoDescription`, …) | Nest + Landing publish/CMS |
| 4 | Persist `published_meta` / page_settings | Single write path |
| 5 | Revalidate `/p/slug` (và edge nếu có) | Publish revalidate |
| 6 | Task `deployed` + audit log actor | Nest |
| 7 | Optional re-scan page rules | Job |

**Fail policy:** Deploy fail → task không `deployed`; message rõ; không partial silent.

#### 3.3.4 AI coach (sau data loop ổn)

| Phase | Hành vi |
|-------|---------|
| MVP | Chat/agent nhận **context** (scores + top tasks + hostname) từ Nest; LLM platform (nếu đã có) — **không** fake OpenSEO |
| P1 | Tool-calling: Nest proxy chọn MCP tools theo intent (keywords, overview, serp) |
| P2 | Skill `seo-coach` nếu OpenSEO expose |

Agents static `DEFAULT_AGENTS` → chuyển thành **templates prompt** + backend tools, không trả list giả là “AI đã nối OpenSEO”.

#### 3.3.5 Mục tiêu đo (Landing optimize)

| Metric | Target |
|--------|--------|
| Scan hybrid tạo ≥ 1 task trên page thiếu meta | Demo fixture 100% |
| Deploy meta → live HTML head match | E2E staging pass |
| Revalidate visible < 60s | Staging |
| Agent trả lời có trích scores/tasks thật | Manual QA |

---

## 4. Phase triển khai (không code — thứ tự)

### Phase 0 — Chốt quyết định (0.5–1 ngày)

- [ ] ADR: Path B-lite (Nest HTML rules) vs chờ OpenSEO audit  
- [ ] ADR: Binding OpenSEO project (strict domain match vs fallback Default)  
- [ ] ADR: Deploy fields (meta only vs HTML head rewrite)  
- [ ] Env checklist: `OPENSEO_*`, DataForSEO key staging, public domain test landing  

**Exit:** 3 ADR merged hoặc ghi trong Key Decisions (§6).

### Phase 1 — Scan đúng URL + score cards tin cậy (P0)

**Trụ 2 + một phần Trụ 1**

1. Resolve `startUrl` / hostname policy (S2, A3).  
2. Block scan non-public domain + FE error.  
3. Scan response `mode` + job status chuẩn.  
4. Sync landing page scanStatus/scores (S3).  
5. Score UI empty/partial/error (S4).  
6. Health badge OpenSEO (A4).  

**Exit DoD Phase 1:**

- Domain public: Quét → cards cập nhật, không 0 giả khi chưa scan.  
- Domain local: message “cần domain public / custom domain”.  
- Landing table status khớp job.

### Phase 2 — Adapter MCP mở rộng (P0–P1)

**Trụ 1**

1. Wire backlinks + domain keyword suggestions + ranked keywords vào enrichment scan.  
2. Binding policy + telemetry.  
3. GSC inspect optional post-publish.  
4. Error code catalog.  

**Exit DoD Phase 2:**

- ≥ 3 tool nhóm domain/keywords/backlinks dùng trong production path.  
- Binding không gán nhầm domain A vào metrics domain B (strict mode).

### Phase 3 — Page audit lite + task generation (P0 product)

**Trụ 3 L1–L2**

1. Fetch publicUrl + rule packs.  
2. Hybrid scan (A + B-lite).  
3. Issue → task mapper + dedup.  
4. FE task board refresh sau scan.  

**Exit DoD Phase 3:**

- Landing thiếu title → task ON_PAGE sau scan.  
- Scan lại không spam duplicate task (dedup).

### Phase 4 — Deploy → live landing (P0 product)

**Trụ 3 L3**

1. Deploy API → update landing meta.  
2. Revalidate public.  
3. E2E: deploy → curl/public view meta.  
4. Actor audit log.  

**Exit DoD Phase 4:**

- Meta live khớp suggestion đã deploy.  
- Unpublish policy: deploy disabled khi page offline.

### Phase 5 — AI coach + optional auto-scan (P1)

**Trụ 3 L4–L5 + MCP tools in chat**

1. Context injection scores/tasks.  
2. Optional tool proxy keywords/overview.  
3. Optional auto-scan after publish (feature flag).  

**Exit DoD Phase 5:**

- Chat không còn agent “fake”; có context thật hoặc disabled state.  
- Flag auto-scan off by default.

### Phase 6 — Path B-full khi OpenSEO audit available (P2)

1. Detect tool `start_audit` capability.  
2. Prefer full audit; fallback hybrid.  
3. Map Lighthouse issues → tasks.  

**Exit:** Feature flag; staging có/không tool đều green.

---

## 5. PR Plan (incremental)

| PR | Tiêu đề | Phạm vi chính | Phụ thuộc | DoD ngắn |
|----|---------|---------------|-----------|----------|
| **PR-1** | Scan URL resolution + domain gate | Nest scan startUrl; FE error | — | Invalid domain blocked |
| **PR-2** | Job/score contract + landing sync | Jobs service, page scores, FE poll invalidate | PR-1 | Cards + table sync |
| **PR-3** | Score cards UX states | FE only | PR-2 | Empty/partial/error |
| **PR-4** | MCP adapter expansion | OpenSeoClient + scan enrichment | PR-1 | Backlinks/keywords wired |
| **PR-5** | Binding policy + health UI | Nest bind, FE health | PR-4 | No silent Default mismatch |
| **PR-6** | Page audit lite rules | Nest HTML fetch + rules | PR-1 | Issues list API/internal |
| **PR-7** | Task generation from issues | Task service + FE board | PR-6 | Tasks after scan |
| **PR-8** | Deploy meta → landing + revalidate | Task deploy + publish/CMS | PR-7 | Live meta E2E |
| **PR-9** | AI coach context (+ tools optional) | Agents/chat Nest | PR-2, PR-7 | Real context |
| **PR-10** | Auto-scan after publish (flag) | Publish hook | PR-1, PR-7 | Flag off default |
| **PR-11** | Full audit path (capability detect) | Client + scan | PR-4 | Fallback hybrid |

**Gợi ý parallel:** PR-3 ∥ PR-4; PR-6 có thể start sau PR-1; PR-9 sau PR-7.

---

## 6. Key Decisions

| ID | Quyết định | Rationale |
|----|------------|-----------|
| **D1** | Dual-path scan: Path A MCP overview + **Path B-lite Nest HTML rules** cho MVP task | MCP hiện không có `start_audit`; không block product chờ upstream |
| **D2** | Strict domain public để Path A; Path B-lite chỉ cần URL crawl được (có thể `/p/slug` public) | Overview DataForSEO cần registrable domain; page rules chỉ cần HTTP 200 HTML |
| **D3** | OpenSEO project binding: prefer domain match; fallback Default **chỉ** khi explicit config `OPENSEO_ALLOW_DEFAULT_FALLBACK=true` | Tránh metrics domain sai |
| **D4** | Deploy v1 = **meta only** (`seoTitle` / `seoDescription` / `published_meta`) + revalidate; chưa full HTML rewrite | An toàn, reversible, khớp task board hiện tại |
| **D5** | FE chỉ Nest API (`NEXT_PUBLIC_AI_SEO_USE_NEST=true` production path); BFF scan legacy freeze write | Một orchestration |
| **D6** | Score `null` = chưa scan; `0` = đã scan kém | Tránh UX hiểu nhầm |
| **D7** | AI coach phase sau data loop (PR-9); không claim “OpenSEO AI” khi chỉ static list | Trung thực product |
| **D8** | Fail-soft: lỗi MCP không xóa scores cũ; publish vẫn độc lập | Đã align publish fail-soft |

---

## 7. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|------------|
| DataForSEO key/quota thiếu | Cao | Cache 24h; quota message; staging key riêng |
| OpenSEO single Default project multi-tenant bleed | Cao | D3 strict binding; tenant isolation tests |
| HTML fetch SSR/block bot | Trung bình | User-Agent, timeout, fallback “cannot fetch” task |
| Deploy ghi nhầm page | Cao | Tenant + ownership assert; E2E isolation |
| Heuristic scores bị hiểu là Lighthouse | Trung bình | Label “Domain intelligence” vs “Page audit” trên UI |
| Scope creep suite Authority/Local | Trung bình | Phase 6+; adapter only wire data, UI sau |

---

## 8. Kiểm thử & DoD tổng (gate ship)

### 8.1 Test matrix

| Case | Expect |
|------|--------|
| OpenSEO down | Health false; scan 503; cards giữ cũ |
| Domain `example.com` + key | Path A success; scores > null |
| Landing only `/p/slug` localhost | Path A block; Path B-lite optional nếu URL public reachable |
| Missing meta page | ≥1 task ON_PAGE |
| Deploy title | Public meta title đổi sau revalidate |
| Tenant B không thấy job tenant A | 404 |
| Re-scan | Dedup tasks; scores refresh |

### 8.2 DoD “MVP tối ưu SEO landing” (ship)

- [ ] G1–G4 đạt trên staging  
- [ ] T1–T5 đạt  
- [ ] PR-1 → PR-8 merged  
- [ ] Docs: operator runbook OpenSEO + DataForSEO  
- [ ] Không regress publish fail-soft  

### 8.3 DoD “Full intelligence” (post-MVP)

- [ ] G5–G6  
- [ ] PR-9 → PR-11  
- [ ] Capability detect full audit  

---

## 9. Timeline gợi ý

| Phase | Ước lượng | Kết quả |
|-------|-----------|---------|
| 0 ADR | 0.5–1d | Quyết định khóa |
| 1 Scan URL + cards | 3–4d | G1–G2 baseline |
| 2 Adapter expand | 2–3d | A1 partial |
| 3 Audit lite + tasks | 4–5d | G3 |
| 4 Deploy live | 3–4d | G4 |
| 5 AI coach + flag | 3–4d | G6 partial |
| 6 Full audit | khi upstream sẵn | Path B-full |

**MVP ship (G1–G4):** ~2.5–3.5 tuần (1–2 eng)  
**Full (G5–G6 + audit full):** +1–2 tuần + phụ thuộc OpenSEO

---

## 10. Open Questions (cần Product/Tech)

1. **Path B-lite Nest HTML rules** có chấp nhận làm “page audit” chính thức trên UI không, hay chỉ internal cho tasks?  
2. **Auto-scan sau publish** mặc định on hay off?  
3. Deploy có được phép sửa **body content** (H1 text) hay chỉ meta head?  
4. Multi-page / 1 domain: 1 SEO project nhiều landing — task có bắt buộc `pageId` không? (Khuyến nghị: có)  
5. Ngân sách DataForSEO staging — soft quota bao nhiêu call/ngày?

---

## 11. Tài liệu liên quan

| Doc | Vai trò |
|-----|---------|
| `plans/AI_SEO/AI-SEO-LANDING-INTEGRATION.md` | Publish ↔ AI-SEO E2E |
| `plans/AI_SEO/DATA-ISOLATION.md` | Tenant rules |
| `docs/Kho-ung-dung/plan-be-ai-seo-openseo.md` | Adapter vision |
| `docs/Kho-ung-dung/checklist-openseo.md` | MCP capability map |
| `docs/landing/publish-landingpage.md` | Publish + ensure sequence |
| Code: `openseo-client.service.ts`, `ai-seo-project.service.ts` scan, FE `SeoProjectScanButton` | Baseline implementation |

---

## 12. Tóm tắt một trang

**Vấn đề:** OpenSEO đã nối MCP nhưng scan ≈ domain overview; score heuristic; không task tối ưu page; deploy chưa lên live; AI agents giả.  

**Hướng:**  
1) Adapter đủ tools + binding chặt + domain gate.  
2) FE scan tin cậy + score contract + sync landing.  
3) Hybrid audit (MCP domain + Nest page rules) → tasks → deploy meta → revalidate.  
4) AI coach sau khi data loop thật.  

**Thành công:** User publish landing domain public → Quét → thấy điểm + task → Deploy → meta live đổi.  

---

*Document status: Plan only — no implementation. Ready for Phase 0 ADR + PR-1.*
