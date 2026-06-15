# LadiPage Backend Structure

## High-level

- Tận dụng tối đa `nest-core` cho auth, tenant, monetization (credit/plan/stripe), file, realtime, AI.
- Các module trong `src/modules/` chủ yếu là **domain logic** của landing page builder + thin wrappers để extend nest-core khi cần.

## Reusable từ nest-core (import trực tiếp)

- BillingModule → credit, plan, payment
- NetdiskModule + ToolsModule (Upload) → file-manager
- AuthModule + TenantModule
- SseModule + SocketModule
- PublicApiModule (cho embed + public routes)
- AgentModule (cho AI features)

## Các module cần phát triển (theo tree ban đầu)

- funnelx
- website (+ template)
- ecom-store
- domain (custom domain + DNS + SSL)
- publish (quan trọng nhất)
- builder-bridge
- flowise
- sdk

## Gợi ý khi implement module mới

```ts
@Module({
  imports: [
    BillingModule,   // credit + plan gating
    TenantModule,
    FileManagerModule, // hoặc ToolsModule + NetdiskModule
    SseModule,
    // ...
  ],
})
export class PublishModule {}
```

Sử dụng:
- `SubscriptionService` / `BillingService` để check/update credit
- `@Idempotence()` cho publish action
- `SseService` để push progress
- BaseCrudFactory nếu cần admin CRUD nhanh
```

## Port mặc định

7101 (dev)

## Swagger

`/docs`

## structure
src/modules/
├── workspace/
├── funnelx/              # Vẫn tự xây (quan trọng)
├── website/              # Dùng Puck ở frontend, backend chỉ lưu data
├── ecom-store/
├── domain/
├── publish/              # Tích hợp Dub + PostHog
├── credit/
├── plan/
├── payment/              # Stripe (từ nest-core)
├── file-manager/         # Từ nest-core
├── integration/          # Mới - chứa các service tích hợp
│   ├── posthog.service.ts
│   ├── dub.service.ts
│   ├── chatwoot.service.ts
│   ├── formbricks.service.ts
│   └── flowise.service.ts
└── flowise/              # Module riêng cho AI workflow