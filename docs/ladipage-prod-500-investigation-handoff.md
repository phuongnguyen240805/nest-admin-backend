# Incident Handoff — LadiPage PROD 500 Investigation

## VAI TRÒ

Bạn là một **Senior Full-Stack Engineer / DevOps / SRE** có nhiều năm kinh nghiệm thực chiến trong:

- Next.js 16 / React 19
- OpenNext for Cloudflare
- Cloudflare Workers, Service Bindings, Wrangler
- NestJS
- Docker / Docker Compose
- Dokploy / Traefik
- PostgreSQL / Supabase
- Redis / BullMQ
- Authentication / JWT / BFF
- Production incident debugging
- Network / proxy / origin troubleshooting

Nhiệm vụ của bạn là truy vết một lỗi production xuyên suốt cả Frontend Cloudflare và Backend Dokploy.

Không được đoán mò. Hãy xây dựng hypothesis tree, xác minh từng tầng bằng log/source/request thực tế rồi loại trừ dần.

Không được in hoặc yêu cầu người dùng công khai secret/password/token.

Khi kiểm tra env chỉ in:
- tên biến
- SET/MISSING
- hostname/origin/path nếu cần

Không in credential/token/key.

---

## 1. REPOSITORIES / ENVIRONMENTS

### FRONTEND

Repository:

```text
phuongnguyen240805/ladipage-fe-v2
```

Local:

```text
D:\monorepo-project-workspace\ladipage-fe-v2
```

Stack:

```text
Next.js 16
OpenNext
Cloudflare Workers
Wrangler
```

Cloudflare production architecture hiện tại là multi-worker:

```text
ladipage                 = router
ladipage-core
ladipage-landing
ladipage-builder
ladipage-ai
ladipage-education
ladipage-ads
ladipage-commerce
ladipage-care
ladipage-cloudphone
ladipage-misc
ladipage-assets
```

Public main URL:

```text
https://ladipage.gofiber-phuongnguyen.workers.dev
```

### BACKEND

Repository:

```text
phuongnguyen240805/nest-admin-backend
```

Local:

```text
D:\monorepo-project-workspace\liora-monorepo
```

Relevant app:

```text
apps/ladipage-backend
```

Production:

```text
Dokploy / Docker
```

Nest API:

```text
port 7002
```

API internal prefix:

```text
/api
```

Có thêm process riêng:

```text
ladipage-worker
```

Đây là BullMQ/background worker, **KHÔNG phải Nest HTTP API process**.

---

## 2. LỖI PROD HIỆN TẠI

Browser gọi:

```http
GET https://ladipage.gofiber-phuongnguyen.workers.dev/api/backend/account/profile
```

Kết quả:

```text
500 Internal Server Error
```

Đã test health thông qua Cloudflare:

```http
GET https://ladipage.gofiber-phuongnguyen.workers.dev/api/backend/health/ready
```

Kết quả:

```text
500
```

Đã test trực tiếp split worker:

```http
GET https://ladipage-core.gofiber-phuongnguyen.workers.dev/api/backend/health/ready
```

Kết quả:

```text
500
```

Nhưng test trực tiếp bên trong chính container Backend PROD:

```js
fetch("http://127.0.0.1:7002/api/health/ready")
```

Kết quả:

```text
STATUS=200
BODY={"code":200,"data":{"status":"ok","service":"ladipage-backend"},"message":"success"}
```

Đây là dữ kiện quan trọng nhất hiện tại:

```text
Nest PROD container
http://127.0.0.1:7002/api/health/ready
= 200 OK

Cloudflare ladipage-core
/api/backend/health/ready
= 500

Cloudflare router ladipage
/api/backend/health/ready
= 500
```

Vì direct `ladipage-core` cũng 500 nên lỗi không thể chỉ nằm ở router `ladipage -> CORE service binding`.

Ưu tiên hiện tại phải là:

```text
ladipage-core runtime
        ↓
BFF /api/backend/*
        ↓
NEST_INTERNAL_URL
        ↓
public backend origin / Dokploy ingress
        ↓
Nest API
```

---

## 3. KIẾN TRÚC FE ĐÃ XÁC MINH TỪ SOURCE

Router:

```text
.cf-router/worker.mjs
```

Router có các service bindings:

```text
LANDING
BUILDER
AI
EDUCATION
ADS
COMMERCE
CARE
CLOUDPHONE
MISC
CORE
```

Nếu pathname không match các nhóm riêng thì:

```js
return env.CORE;
```

Do đó:

```text
/api/backend/health/ready
/api/backend/account/profile
```

đi vào:

```text
ladipage-core
```

Source BFF route:

```text
src/app/api/backend/[...path]/route.ts
```

Route gọi:

```ts
fetchBackend(request, backendPath, ...)
```

Source backend client:

```text
src/lib/backend/client.server.ts
```

Backend base URL được resolve như sau:

```ts
process.env.NEST_INTERNAL_URL
??
process.env.LADIPAGE_BACKEND_API_URL
??
"http://localhost:7002/api"
```

Lưu ý: source hiện tại dùng:

```text
NEST_INTERNAL_URL
```

Không phải:

```text
NEXT_INTERNAL_URL
```

Nếu `NEST_INTERNAL_URL` thiếu thì Cloudflare sẽ fallback:

```text
http://localhost:7002/api
```

điều này sai trên Cloudflare edge.

---

## 4. CLUE QUAN TRỌNG TRONG CODE

`src/app/api/backend/[...path]/route.ts` có `try/catch`.

Nếu `fetchBackend` throw vì:
- DNS
- connection refused
- network error
- timeout

route sẽ trả:

```text
502 Backend unavailable
```

hoặc:

```text
504 Backend request timed out
```

Nhưng hiện endpoint đang trả:

```text
500
```

Do đó phải phân biệt hai khả năng lớn:

### A. Upstream public origin trả 500

`fetch` tới upstream thành công nhưng upstream public origin thực tế trả 500, sau đó BFF forward nguyên status 500.

### B. 500 xảy ra trước hoặc ngoài try/catch

Có thể do:
- middleware
- OpenNext runtime
- server handler
- env access
- split-worker artifact
- exception khác trước `fetchBackend`

Đây là clue cần được truy vết đầu tiên.

Không được chỉ giả định "Cloudflare không gọi được backend".

---

## 5. ENV CLOUDFLARE — VẤN ĐỀ ĐÃ PHÁT HIỆN

Có file local:

```text
.env.cf.production
```

Trước đây user nghĩ deploy Cloudflare đang dùng file này.

Nhưng source deploy cho thấy ban đầu không phải vậy.

`package.json` có flow:

```text
build:cf
=
opennextjs-cloudflare build
```

```text
deploy:cf:all
=
build + scripts/deploy-cloudflare-all.mjs
```

`scripts/deploy-cloudflare-all.mjs` ban đầu deploy mỗi worker bằng:

```text
wrangler deploy
--config <worker-config>
--keep-vars
```

Điểm quan trọng:

```text
--keep-vars
```

không import `.env.cf.production`.

Nó chỉ giữ lại Variables đang tồn tại trên Cloudflare.

`.env.cf.production` cũng không phải filename mặc định Next.js tự load.

Next.js thông thường ưu tiên:

```text
.env.production.local
.env.local
.env.production
.env
```

Nó không mặc định hiểu:

```text
.env.cf.production
```

Do đó trước khi chỉnh deploy pipeline, `.env.cf.production` có thể tồn tại local nhưng không hề được đưa thành runtime bindings trên Cloudflare.

---

## 6. THAY ĐỔI DEPLOY ĐÃ THỰC HIỆN

Đã thêm logic inject:

```text
NEST_INTERNAL_URL
```

vào split workers bằng Wrangler `--var`.

Deploy sau đó thành công cho cả 10 split workers.

Log `ladipage-core` xác nhận:

```text
Your Worker has access to the following bindings:
env.NEST_INTERNAL_URL ("(hidden)") Environment Variable
```

Deploy thành công:

```text
ladipage-core
Current Version ID:
2a0bedcf-a1bd-4a12-a1c5-bca32909950b
```

Các worker khác cũng nhận `NEST_INTERNAL_URL`.

Router `ladipage` được deploy cuối cùng và service bindings đều OK.

Tuy nhiên script hiện vẫn dùng:

```text
--keep-vars
```

Do đó Cloudflare vẫn còn các variables cũ trên Dashboard.

---

## 7. CLOUDFLARE ENV CŨ

Cloudflare Dashboard hiện cho thấy Worker `ladipage` vẫn còn nhiều biến cũ, ví dụ:

```text
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_AUTH_MODE
NEXT_PUBLIC_CDN_BASE_URL
NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET
NEXT_PUBLIC_FB_GRAPH_VERSION
NEXT_PUBLIC_FB_SESSION_COOKIE_NAME
NEXT_PUBLIC_FREE_SITE_DOMAIN
...
```

Một số có nguồn gốc từ cấu hình cũ / Vercel.

Do đang dùng:

```text
--keep-vars
```

nên các variables cũ vẫn tồn tại.

Tuy nhiên cần nhớ:

```text
direct ladipage-core cũng đang 500
```

Vì vậy stale env của router `ladipage` không thể là nguyên nhân duy nhất.

Phải kiểm tra chính:

```text
ladipage-core
→ Settings
→ Variables and Secrets
```

---

## 8. .env.cf.production HIỆN TẠI

File đã được kiểm tra.

Nó có khoảng 51 variables và không có biến rỗng.

Các key quan trọng hiện có:

```text
NEST_INTERNAL_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_GOOGLE_CLIENT_ID
LANDING_ORIGIN_URL
NEXT_PUBLIC_CDN_BASE_URL
LANDING_ASSET_BASE_URL
NODE_ENV
...
```

`NEST_INTERNAL_URL` có dạng public HTTPS backend origin và có suffix:

```text
/api
```

Nó không phải `localhost` và không phải Docker hostname nội bộ.

File hiện thiếu so với `.env.example` một số biến:

```text
NEXT_PUBLIC_REALTIME_URL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
INSTATIC_REWRITE_TARGET_VITE
```

Có duplicate:

```text
NEXT_PUBLIC_INSTATIC_EDITOR_ORIGIN
```

Có một số Vercel env nên xem xét loại bỏ khỏi Cloudflare:

```text
VERCEL
VERCEL_ENV
VERCEL_OIDC_TOKEN
VERCEL_TARGET_ENV
VERCEL_URL
```

Đặc biệt `VERCEL_OIDC_TOKEN` không nên bị đưa thành text variable Cloudflare.

---

## 9. BUILD-TIME VS RUNTIME ENV

Không được trộn hai loại.

### BUILD TIME

```text
NEXT_PUBLIC_*
```

cần tồn tại lúc:

```text
pnpm build:cf
```

vì có thể được bake vào Next client bundle.

### RUNTIME SERVER

```text
NEST_INTERNAL_URL
SUPABASE_SECRET_KEY
LANDING_ORIGIN_URL
LANDING_PUBLISH_SOURCE
LANDING_ASYNC_PUBLISH_ENABLED
...
```

cần tồn tại trong runtime Cloudflare worker nếu server code cần chúng.

Chỉ có biến trong `.env.cf.production` không đảm bảo runtime Worker có biến đó.

Hiện mới xác nhận chắc chắn runtime split workers đã nhận:

```text
NEST_INTERNAL_URL
```

Không được kết luận toàn bộ `.env.cf.production` đã được sync.

---

## 10. BACKEND WORKER ISSUE TRƯỚC ĐÓ

Trước lỗi hiện tại có một incident riêng:

```text
ladipage-worker PROD/DEV crash Nest DI
```

Lỗi đầu:

```text
Nest can't resolve dependencies of MenuService
missing Symbol(REDIS_CLIENT)
```

Sau khi thêm Redis/Shared dependencies thì lỗi tiếp theo:

```text
UserService
missing QQService
```

Cuối cùng `WorkerAppModule` được sửa để import:

```text
SharedModule
```

Sau restart/redeploy:

```text
worker container running / healthy
```

và các `UnknownDependenciesException` cũ không xuất hiện ở recent logs.

Quan trọng: đây là process:

```text
worker.main.js
```

khác với API:

```text
main.js
```

Do đó worker background crash không giải thích được `/api/health/ready` của Nest HTTP API.

Worker hiện không phải nghi phạm chính của API 500.

---

## 11. NHỮNG NGHI PHẠM ĐÃ LOẠI KHỎI ƯU TIÊN

### A. Nest PROD API process chết

Đã loại.

```text
127.0.0.1:7002/api/health/ready = 200
```

### B. API không listen port 7002

Đã loại.

### C. ladipage-worker BullMQ crash gây health 500

Đã loại khỏi root cause hiện tại.

### D. Supabase/PostgreSQL là nguyên nhân trực tiếp của `/health/ready 500`

Không phải nghi phạm ưu tiên.

### E. Redis là nguyên nhân trực tiếp health 500

Không ưu tiên.

### F. JWT / login / user account là root cause ban đầu

Không ưu tiên vì `/api/backend/health/ready` cũng 500.

### G. Browser COOP warning

```text
Cross-Origin-Opener-Policy
window.postMessage
```

không phải nguyên nhân API health 500.

### H. Router `ladipage` service-binding là nguyên nhân duy nhất

Đã loại vì direct `ladipage-core` cũng 500.

### I. OpenNext build warning duplicate object key

Chưa có bằng chứng liên quan runtime 500.

### J. Node DEP0190 warning

Không làm deploy fail.

---

## 12. NGHI PHẠM CÒN LẠI — ƯU TIÊN

### H1 — PUBLIC BACKEND ORIGIN TRONG NEST_INTERNAL_URL CÓ VẤN ĐỀ

Mặc dù internal container:

```text
127.0.0.1:7002/api/health/ready = 200
```

public origin mà Cloudflare gọi có thể:
- 500
- TLS lỗi
- Traefik route sai
- Host routing sai
- domain sai
- redirect sai
- firewall/access rule
- origin không expose đúng `/api`
- đang trỏ tới deployment/container cũ

Đây phải là test số 1.

### H2 — NEST_INTERNAL_URL BINDING TỒN TẠI NHƯNG VALUE KHÔNG ĐÚNG

Deploy log chỉ chứng minh key tồn tại, không chứng minh hostname/path đúng.

Cần log sanitized:

```text
origin
hostname
pathname
```

### H3 — ladipage-core OPENNEXT RUNTIME THROW TRƯỚC BFF CATCH

Vì expected network-error status của route là 502, nhưng thực tế đang thấy 500.

Cần `wrangler tail`.

### H4 — MIDDLEWARE

Kiểm tra `middleware.ts` có intercept `/api/backend/*` hay không.

### H5 — SPLIT OPENNEXT CORE BUILD ARTIFACT

Có khả năng monolithic worker chạy nhưng split core artifact bị mismatch.

Nếu H1-H4 không ra nguyên nhân, compare:

```text
.open-next/worker.js
```

với:

```text
.open-next/server-functions/core/handler.mjs
```

### H6 — STALE CLOUDFLARE VARS / SECRETS

`--keep-vars` vẫn đang được dùng.

Có thể một runtime variable cũ ảnh hưởng middleware/auth/backend selection/OpenNext logic.

### H7 — BUILD-TIME ENV KHÔNG PHẢI `.env.cf.production`

Cần xác minh `pnpm deploy:cf:all` có thật sự làm build với `.env.cf.production`.

---

## 13. TRUY VẾT PROD — THỨ TỰ BẮT BUỘC

### BƯỚC 1 — TEST PUBLIC NEST ORIGIN TRỰC TIẾP

```powershell
node --env-file=.env.cf.production -e "
const u=new URL(process.env.NEST_INTERNAL_URL);
console.log({
  origin:u.origin,
  host:u.hostname,
  path:u.pathname
})
"
```

Sau đó gọi:

```powershell
Invoke-WebRequest `
  "https://BACKEND_PROD/api/health/ready" `
  -UseBasicParsing
```

Nếu public origin != 200:

```text
STOP debug FE
```

Debug Dokploy/Traefik/public ingress.

Nếu public origin = 200 thì chuyển Cloudflare.

### BƯỚC 2 — LẤY RESPONSE BODY/HEADERS THẬT CỦA CORE

```powershell
curl.exe -i `
  https://ladipage-core.gofiber-phuongnguyen.workers.dev/api/backend/health/ready
```

Phải ghi lại:
- status
- content-type
- server
- cf-ray
- body JSON/text

### BƯỚC 3 — TAIL ladipage-core REALTIME

```powershell
pnpm exec wrangler tail ladipage-core --format pretty
```

Sau đó request lại endpoint.

### BƯỚC 4 — KIỂM TRA ENV CỦA ladipage-core

```text
Cloudflare
Workers
ladipage-core
Settings
Variables and secrets
```

Tối thiểu kiểm tra:

```text
NEST_INTERNAL_URL
```

### BƯỚC 5 — TRACE SOURCE THEO REQUEST

```text
Cloudflare edge
→ worker.mjs
→ OpenNext handler
→ middleware
→ app/api/backend/[...path]/route.ts
→ fetchBackend()
→ backendBaseUrl()
→ fetch()
→ public Nest origin
```

Ở mỗi layer ghi:
- input URL
- output URL
- status
- exception

### BƯỚC 6 — BACKEND ACCESS LOG

Trong Dokploy/Nest log, xem Cloudflare request có tới:

```text
GET /api/health/ready
```

hay không.

---

## 14. TRUY VẾT DEV

Backend DEV:

```text
http://localhost:7002/api/health/ready
```

Frontend DEV BFF:

```text
http://localhost:3000/api/backend/health/ready
```

NEST_INTERNAL_URL DEV:

```text
http://localhost:7002/api
```

Lập matrix:

| Layer | DEV | PROD |
|---|---:|---:|
| Nest direct/internal | ? | 200 |
| Nest public origin | n/a | ? |
| FE BFF direct | ? | 500 |
| CF core | n/a | 500 |
| CF router | n/a | 500 |

Mục tiêu là xác định layer đầu tiên chuyển:

```text
200 -> 500
```

---

## 15. AUTH PROFILE — CHỈ QUAY LẠI SAU KHI HEALTH = 200

Endpoint ban đầu:

```text
/api/backend/account/profile
```

= 500

Nhưng không debug profile trước khi health fixed.

Sau khi health = 200, nếu profile vẫn lỗi thì trace:

```text
cookie/session
BFF access token
Authorization Bearer
Nest auth guard
request.user
UserService
```

Có một điểm source đáng kiểm tra:

```text
@AllowAnon()
```

nhưng implementation sử dụng:

```text
user.uid
```

Nếu request không có authenticated user, `user` có thể undefined và gây 500 thay vì 401.

Đây là issue riêng, không dùng để giải thích health 500.

---

## 16. CLOUDFLARE ENV PIPELINE CẦN AUDIT

Sau khi incident được fix, audit deployment design.

Mục tiêu:

```text
.env.cf.production
```

là source-of-truth cho build-time non-secret config.

Một file riêng:

```text
.env.cf.secrets.production
```

cho secret runtime.

Không đưa secret vào `--var`.

Ví dụ secret:

```text
SUPABASE_SECRET_KEY
DATABASE_URL
API_TOKEN
LANDING_PUBLISH_EXECUTOR_SECRET
VERCEL_OIDC_TOKEN nếu còn dùng
```

Không xóa service bindings:

```text
CORE
LANDING
BUILDER
AI
...
```

---

## 17. CÁC FILE FE CẦN ĐỌC ĐẦU TIÊN

```text
package.json
wrangler.jsonc
.cf-router/wrangler.jsonc
.cf-router/worker.mjs
.cf-workers/core/wrangler.jsonc
.cf-workers/core/worker.mjs
scripts/deploy-cloudflare-all.mjs
open-next.config.ts
middleware.ts
src/app/api/backend/[...path]/route.ts
src/lib/backend/client.server.ts
src/lib/backend/session.server.ts
.env.example
```

Local-only:

```text
.env.cf.production
```

Không commit secret.

---

## 18. CÁC FILE BE CẦN ĐỌC

```text
apps/ladipage-backend/src/main.ts
health controller/module
global prefix config
auth middleware/guard
account/profile controller
UserService
production exception filter
apps/ladipage-backend/Dockerfile.production
Dokploy production environment/config
```

Nếu cần worker context:

```text
apps/ladipage-backend/src/app/worker-app.module.ts
```

Nhưng worker không phải investigation priority cho HTTP health.

---

## 19. CÁC ĐIỂM BE CẦN XÁC MINH

Nest global prefix:

```text
/api
```

Health internal:

```text
/api/health/ready
```

Cloudflare BFF:

```text
/api/backend/health/ready
```

phải rewrite thành upstream:

```text
<NEST_INTERNAL_URL>/health/ready
```

Nếu:

```text
NEST_INTERNAL_URL=https://backend.example.com/api
```

thì final URL phải là:

```text
https://backend.example.com/api/health/ready
```

Không được thành:

```text
/api/api/health/ready
```

Cần log sanitized final URL.

---

## 20. KỶ LUẬT DEBUG

Không sửa 5 thứ cùng lúc.

Mỗi vòng:

1. Hypothesis
2. Evidence
3. One test
4. Result
5. Accept/reject hypothesis
6. Next layer

Luôn phân biệt:

```text
FACT
HYPOTHESIS
ACTION
RESULT
```

Không kết luận DB lỗi nếu request health chưa hề đụng DB.

Không kết luận router lỗi nếu direct core cũng lỗi.

Không kết luận `NEST_INTERNAL_URL` thiếu vì deploy hiện đã chứng minh binding tồn tại.

Câu hỏi hiện tại phải là:

```text
Binding tồn tại, nhưng value/path/origin/runtime execution có đúng không?
```

---

## 21. OUTPUT MONG MUỐN TỪ AI

Bắt đầu bằng incident map:

```text
Browser
↓
ladipage router
↓
CORE service binding
↓
ladipage-core
↓
Next middleware
↓
/api/backend/[...path]
↓
fetchBackend
↓
NEST_INTERNAL_URL
↓
Dokploy public origin
↓
Traefik
↓
Nest :7002
↓
/api/health/ready
```

Sau đó tạo bảng:

| Layer | Expected | Observed | Status | Evidence | Next test |
|---|---|---|---|---|---|

Sau đó chạy investigation theo thứ tự priority.

Đừng sửa code ngay khi chưa biết layer nào tạo ra 500.

---

## 22. FIRST TESTS TO RUN NOW

### TEST A

Lấy `NEST_INTERNAL_URL` sanitized từ `.env.cf.production`.

Sau đó request:

```text
<NEST_INTERNAL_URL>/health/ready
```

Nếu != 200:

```text
debug public Dokploy origin
```

### TEST B

```powershell
curl.exe -i `
  https://ladipage-core.gofiber-phuongnguyen.workers.dev/api/backend/health/ready
```

Lấy full status/body/headers.

### TEST C

```powershell
pnpm exec wrangler tail ladipage-core --format pretty
```

Trong lúc tail gọi lại endpoint.

### TEST D

Kiểm tra Dokploy API logs cùng timestamp.

Xem request từ Cloudflare có đến Nest hay không.

Chỉ sau 4 test trên mới quyết định patch tiếp theo.

---

## 23. ĐIỂM CHỐT HIỆN TẠI

Chúng ta đã vượt qua giai đoạn:

```text
NEST_INTERNAL_URL có tồn tại trên Cloudflare không?
```

Deploy log đã chứng minh `ladipage-core` nhận binding đó.

Câu hỏi hiện tại là:

```text
Giá trị đó có dẫn tới đúng public origin không?
Request có đến Nest không?
500 được sinh ra trước hay sau fetchBackend()?
```

Dấu hiệu kỹ thuật mạnh nhất lúc này:

```text
Nest container internal       200
Cloudflare ladipage-core      500
Cloudflare ladipage router    500
```

Và trong source, lỗi network của `fetchBackend()` bình thường phải thành:

```text
502
```

không phải:

```text
500
```

Vì vậy **response body + `wrangler tail ladipage-core`** là hai bằng chứng cần lấy đầu tiên.
