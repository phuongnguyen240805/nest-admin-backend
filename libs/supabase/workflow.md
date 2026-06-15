# Supabase Auth Hybrid Flow

## Register

```
POST /auth/register
        │
        ▼
AntiSpamRegisterGuard.canActivate()
  ├── [email required]      → USE_SUPABASE_AUTH=true → 403 if missing
  ├── [email format]        → regex
  ├── [whitelist domain]    → SUPABASE_ALLOWED_DOMAINS
  ├── [blocklist domain]    → SUPABASE_BLOCKED_DOMAINS
  ├── [IP rate limit]       → Redis: liora:auth:register:ip:<ip>
  └── [Email rate limit]    → Redis: liora:auth:register:email:<email>
        │
        ▼
AuthController.register()
  USE_SUPABASE_AUTH=true
    ├── SupabaseAuthService.signUp(email, password)
    │     └── { supabaseUserId, message? }
    └── UserService.register(dto, supabaseUserId)
          └── sys_user.supabase_user_id = supabaseUserId
```

## Login (unified — Supabase only when enabled)

```
Client (browser/app)
  ├── supabase.auth.signInWithPassword({ email, password })
  │     └── session.access_token  (Supabase JWT)
  └── POST /auth/exchange { supabaseAccessToken }
        │
        ▼
AuthService.loginWithSupabaseAccessToken()
  ├── SupabaseAuthService.verifyAccessToken()  → auth.getUser(token)
  ├── find sys_user by supabase_user_id
  ├── fallback: find by email → link supabase_user_id
  └── issueLoginToken() → Nest internal JWT (RBAC, Redis cache)
        │
        ▼
Client uses Nest JWT for all /api/* requests (existing JwtAuthGuard)
```

## Legacy login (USE_SUPABASE_AUTH=false)

```
POST /auth/login { username, password, captcha }
  └── AuthService.login() — md5+salt, unchanged
```

## Environment keys

```
SUPABASE_URL=https://<ref>.supabase.co

# Public — auth client (Nest + browser)
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# or: SUPABASE_ANON_KEY=eyJ... (role: anon)

# Secret — admin client only, never in frontend
SUPABASE_SECRET_KEY=sb_secret_... | eyJ... (role: service_role)
```

## Database

```
DB_TYPE=postgres
DATABASE_URL=postgresql://...@db.supabase.co:5432/postgres
DB_SSL=true
```

## Auth ↔ DB linkage (Phase 6.5)

```
auth.users (Supabase)          sys_user (app DB)
─────────────────────          ─────────────────
id (uuid)          ──────────► supabase_user_id (uuid, unique)
email              ◄────────── email (fallback auto-link)
```

| Step | Where | What happens |
|------|-------|--------------|
| Register | `POST /auth/register` | Supabase `signUp` → `sys_user.supabase_user_id` set |
| Login | Client SDK `signInWithPassword` | Returns Supabase `access_token` |
| Exchange | `POST /auth/exchange` | Verify token via `getUser` → issue Nest JWT |
| Auto-link | `AuthService` | If no `supabase_user_id`, match by email and link |

**RLS (Phase 6):** `sys_*` and `tenants/*` → RLS **OFF**. Nest connects via pooler with service credentials. See `docker/deploy/sql/supabase/02-rls-phase6.sql`.

**Optional later:** trigger on `auth.users` INSERT, Database Webhook → Nest sync endpoint.