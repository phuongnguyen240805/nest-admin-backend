libs/nest-core/src/modules/billing/
├── billing.module.ts                 # Giữ nguyên, nhưng import internal Stripe stuff
├── billing.controller.ts
├── dto/
├── entities/
├── services/
│   ├── billing.service.ts            # Refactor dần delegate sang StripeService mới
│   ├── subscription.service.ts
│   └── organization.service.ts
└── stripe/                           # <-- MỚI: toàn bộ Stripe ported code sống đây
    ├── index.ts                      # Barrel nội bộ (StripeService, StripeUtils, tokens, webhook exports)
    ├── stripe.module.ts              # StripeModule.forRootAsync (dùng ConfigService)
    ├── stripe.service.ts             # Port từ reyco1 (createCheckout..., construct...)
    ├── stripe.constants.ts
    ├── utils/
    │   └── stripe.utils.ts
    ├── interfaces/
    ├── dto/                          # Các DTO checkout/sub (có thể đơn giản hóa)
    ├── decorators/
    │   └── stripe-webhook-handler.decorator.ts
    ├── controllers/
    │   └── stripe-webhook.controller.ts   # @Controller('webhooks/stripe') + @Public()
    ├── modules/
    │   └── stripe-webhook.module.ts
    └── services/
        └── stripe-webhook-explorer.service.ts