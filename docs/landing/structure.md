bước 1: 
User → NestJS → Tạo Order (với plan + organization)
   ↓
PayOS (tạo link thanh toán / QR)
   ↓
Webhook PayOS → NestJS Webhook Handler
   ↓
Cập nhật Supabase + Logto
   ↓
Kích hoạt feature cho Organization


bước 2: Next.js (Puck)
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

