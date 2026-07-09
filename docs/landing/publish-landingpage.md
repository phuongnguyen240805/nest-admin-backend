Next.js (Puck)
   ↓ (HTTP - nhanh)
NestJS API (tạo job)
   ↓
BullMQ Queue (Redis)
   ↓
BullMQ Worker(s)  ← Xử lý AI thật sự (có thể scale riêng)
   ├── ScreenshotToCodeService (WS → screenshot-to-code)
   ├── LLM Service (HTML → Puck JSON / Text → Page)
   └── Progress update → Supabase Realtime
   ↓
Lưu Puck JSON vào Supabase (pages.puck_data)
   ↓
Notify user (Supabase Realtime / WS Gateway)



User
  ├── Editor (Next.js - Dynamic)
  │     └── Puck Editor (kéo thả, AI import, preview realtime)
  │
  └── Public Landing Page
        ├── Cloudflare DNS + Workers (proxy + custom domain routing)
        └── Public Renderer (Next.js - ISR)
              ├── Route: /p/[slug]
              ├── generateMetadata (meta_title, meta_description, og_image)
              ├── <Render config={puckConfig} data={puckData} />
              └── PostHog tracking (deep behavior)

NestJS (Backend)
  ├── Cập nhật Supabase (pages + page_versions)
  ├── Gọi revalidatePath đến Public Renderer
  └── Quản lý custom domain mapping







 ┌ Giai đoạn 1 — ship trước ┐
 │    ┌─────────────────┐   │
 │    │ L1: API publish │   │
 │    └────────┬────────┘   │
 │             │            │
 │             ▼            │
 │ ┌───────────────────────┐│
 │ │ published_html + slug ││◄───────────┐
 │ └───────────┬───────────┘│            │
 │             │            │            │
 │             ▼            │            │
 │      ┌─────────────┐     │            │
 │      │ L3: /p/slug │     │            │
 │      └─────────────┘     │            │
 └─────────────┬────────────┘            │
               ╎                         │
               ▼mở rộng, không refactor  │
┌ Giai đoạn 2 — thêm sau (o… ┐           │
│  ┌───────────────────────┐ │           │
│  │ Custom domain mapping │ │           │
│  └───────────┬───────────┘ │           │
│              │             │           │
│              ▼             ├───────────┘
│ ┌─────────────────────────┐│
│ │ Cloudflare DNS + Worker ││
│ └─────────────────────────┘│
└────────────────────────────┘






Luồng AI-SEO + Publish Giai đoạn 1

┌──────┐                      ┌─────────┐ ┌────────────────┐                    ┌───────────────┐  ┌─────────┐         ┌──────────┐
│ User │                      │ Builder │ │ L1 Publish API │                    │ AI-SEO (Nest) │  │ /p/slug │         │ OTTO SDK │
└───┬──┘                      └────┬────┘ └────────┬───────┘                    └───────┬───────┘  └────┬────┘         └─────┬────┘
    │                              │               │                                    │               │                    │
    │Connect landing ↔ SEO project │               │                                    │               │                    │
    ├─────────────────────────────▶│               │                                    │               │                    │
    │                              │               │                                    │               │                    │
    │                   Publish    │               │                                    │               │                    │
    ├─────────────────────────────────────────────▶│                                    │               │                    │
    │                              │               │                                    │               │                    │
    │                              │               ├──╮                                 │               │                    │
    │                              │               │  │ Render HTML                     │               │                    │
    │                              │               │◄─╯                                 │               │                    │
    │                              │               │                                    │               │                    │
    │                              │               ├──╮                                 │               │                    │
    │                              │               │  │ AiSeoPublishHook inject script  │               │                    │
    │                              │               │◄─╯                                 │               │                    │
    │                              │               │                                    │               │                    │
    │                              │               │    ensureForLandingPage(pageId)    │               │                    │
    │                              │               ├───────────────────────────────────▶│               │                    │
    │                              │               │                                    │               │                    │
    │                              │               ├──╮                                 │               │                    │
    │                              │               │  │ Lưu published_html              │               │                    │
    │                              │               │◄─╯                                 │               │                    │
    │                              │               │                                    │               │                    │
    │              publicUrl /p/slug               │                                    │               │                    │
    │◄╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤                                    │               │                    │
    │                              │               │                                    │               │                    │
    │                              │               │                                 ┌────────────────────────────────────────┐
    │                              │               │                                 │       Scan / tasks dùng URL này        │
    │                              │               │                                 └────────────────────────────────────────┘
    │                              │               │                                    │               │                    │
    │                              │    Khách hoặc crawler mở /p/slug                   │               │                    │
    ├──────────────────────────────────────────────────────────────────────────────────────────────────▶│                    │
    │                              │               │                                    │               │                    │
    │                              │               │                                    │               │HTML có script OTTO │
    │                              │               │                                    │               ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌▶│
    │                              │               │                                    │               │                    │
    │                              │               │                                    │      Metadata, crawl metrics       │
    │                              │               │                                    │◄╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
    │                              │               │                                    │               │                    │
┌───┴──┐                      ┌────┴────┐ ┌────────┴───────┐                    ┌───────┴───────┐  ┌────┴────┐         ┌─────┴────┐
│ User │                      │ Builder │ │ L1 Publish API │                    │ AI-SEO (Nest) │  │ /p/slug │         │ OTTO SDK │
└──────┘                      └─────────┘ └────────────────┘                    └───────────────┘  └─────────┘         └──────────┘