POST /auth/register
        │
        ▼
AntiSpamRegisterGuard.canActivate()
  ├── [email required?]     → Nếu USE_SUPABASE_AUTH=true và không có email → 403
  ├── [email format check]  → regex validation
  ├── [whitelist domain]    → đọc SUPABASE_ALLOWED_DOMAINS từ ConfigService
  ├── [blocklist domain]    → đọc SUPABASE_BLOCKED_DOMAINS từ ConfigService
  ├── [IP rate limit]       → Redis: liora:auth:register:ip:<ip>  (default: 3/10min)
  └── [Email rate limit]    → Redis: liora:auth:register:email:<email> (default: 2/24h)
        │
        ▼
AuthController.register()
  ├── USE_SUPABASE_AUTH=true
  │     ├── SupabaseAuthService.signUp(email, password)
  │     │     └── Returns { success, supabaseUserId, message? }
  │     ├── UserService.register(dto)  — local user creation (md5 + salt)
  │     └── If message → return { message: "Please confirm email..." }
  └── USE_SUPABASE_AUTH=false
        └── UserService.register(dto)  — flow CŨ hoàn toàn (backward compatible)