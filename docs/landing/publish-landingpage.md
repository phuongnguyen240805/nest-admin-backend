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