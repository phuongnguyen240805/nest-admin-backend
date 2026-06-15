# ladipage-backend

Backend cho LadiPage / Liora Landing Page Builder.

## Mục tiêu tái sử dụng

App này được xây dựng chủ yếu bằng cách **tái sử dụng gần như toàn bộ** từ `libs/nest-core` + các lib hỗ trợ (`@liora/database`, `@liora/dto`, `@liora/supabase`...).

### Những gì đã tái dùng trực tiếp (từ nest-core)

- **Auth + RBAC + Tenant**: AuthModule, TenantModule, Jwt/Rbac guards, decorators.
- **Billing / Credit / Plan / Payment**: BillingModule (Subscription, CreditWallet, Organization, Stripe full stack + webhook declarative).
- **File / Media**: ToolsModule (Upload), NetdiskModule, Storage — bọc lại trong FileManagerModule.
- **Realtime**: SseModule + SocketModule (Redis adapter).
- **AI**: AgentModule (có thể extend cho Flowise).
- **Public / Embed**: PublicApiModule (dùng cho script nhúng + quota check).
- **Cross-cutting**: SharedModule (Redis, Mailer, Schedule, Logger...), idempotence, transform response, exception filter, pagination, CRUD factory...

## Cấu trúc

```
src/
├── app/
│   ├── app.module.ts      # Import hầu hết reusable modules từ nest-core
│   └── ...
├── modules/
│   ├── funnelx/
│   ├── website/
│   ├── publish/           # Publish flow + embed script
│   ├── file-manager/      # Wrapper của Netdisk + Upload
│   ├── credit/            # Wrapper + business rule của Billing
│   ├── payment/           # Stripe (đã có sẵn trong Billing)
│   ├── flowise/
│   └── ...
└── main.ts
```

## Chạy dev

```bash
pnpm nx serve ladipage-backend
```

Truy cập:
- API: http://localhost:7101/api
- Swagger: http://localhost:7101/docs

## Production build

```bash
pnpm nx build ladipage-backend
```
