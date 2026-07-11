┌────────────────────────────────────────────────────────────────────┐
│                     HOST PLATFORM (Super System)                   │
│  - Identity / Auth / Billing / Permission / Storage / Analytics    │
│  - App Con Runtime (Sandbox + Bridge + Design Token + Data)        │
│  - Marketplace + Versioning + Isolation                            │
└───────────────┬─────────────────────────────┬──────────────────────┘
                │                             │
    ┌───────────▼───────────┐     ┌───────────▼───────────┐
    │   App Con 1           │     │   App Con 2           │
    │   "LadiPage Mode"     │     │   "nexu Studio"       │
    │   (Marketing Builder) │     │   (Agent Design OS)   │
    │                       │     │                       │
    │  - Instatic Marketing │     │  - open-design        │
    │  - Form + Conversion  │     │  - html-anything      │
    │  - PostHog + A/B      │     │  - motion-anything    │
    │  - Templates          │     │  - html-video         │
    │  - Landing Page focus │     │  - looper             │
    └───────────────────────┘     └───────────────────────┘
                │                             │
                └─────────────┬───────────────┘
                              │
                    Có thể có thêm App Con khác:
                    - App Con 3: E-commerce
                    - App Con 4: Email Builder
                    - App Con 5: Video Studio
                    - App Con 6: Agent Marketplace
                    - ...





Cloudflare
├── DNS + WAF + CDN + Load Balancing (Free/Pro)
├── R2                          → Media + Published static files
├── Pages                       → Host LadiPage published sites (Free)
└── Workers (optional)          → Edge auth check / redirect / A/B

Coolify (1–2 VPS)
├── NestJS Host Platform
│   ├── API + App Con Runtime
│   ├── LadiPage App Con (editor + publish logic)
│   └── nexu App Con bridge
├── BullMQ Workers
└── Dragonfly

Supabase Cloud (Pro)
├── Postgres + RLS
├── Auth
└── Realtime





User thêm domain: shop.customer.com
         ↓
NestJS gọi Cloudflare API → tạo Custom Hostname
         ↓
User trỏ DNS (CNAME) shop.customer.com → fallback.yoursaas.com
         ↓
Cloudflare tự động:
  - Validate domain
  - Cấp SSL miễn phí
  - Proxy traffic về origin của bạn (R2 / Worker / NestJS)
         ↓
Trang live với domain riêng của user



Kiến trúc kết hợp (Wildcard + Custom Domain)
┌────────────────────────────────────────────────────┐
│                  Cloudflare                        │
│  ├── Wildcard: *.yoursaas.com     → Miễn phí       │
│  └── Custom Hostnames             → $0.10/domain   │
└────────────────────┬───────────────────────────────┘
                     │
                     ▼
              Cloudflare Worker
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   Subdomain?              Custom Domain?
   (shop.yoursaas.com)     (shop.customer.com)
         │                       │
         └───────────┬───────────┘
                     ▼
              Lấy Site từ Database
                     │
                     ▼
              Serve từ R2




Mặc định: Mọi site đều có subdomain.yoursaas.com (wildcard – free)
Nâng cao: User muốn domain riêng → dùng Cloudflare for SaaS
NestJS quản lý việc tạo / xóa / check status Custom Hostname
Worker hoặc NestJS dựa vào Host header để biết serve site nào
