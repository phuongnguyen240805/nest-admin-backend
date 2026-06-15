/**
 * API smoke tests — requires nest-admin running on PORT (default 7001).
 * Usage: node scripts/db/api-smoke-test.js
 */
require('dotenv').config()

const PORT = process.env.NEST_ADMIN_PORT || process.env.PORT || 7001
const BASE = `http://127.0.0.1:${PORT}`
const API = `${BASE}/api`

const results = []

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function request(method, url, options = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout ?? 15000),
  })
  let json = null
  const text = await res.text()
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, ok: res.ok, json, text }
}

async function waitForServer(maxMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/docs/json`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    }
    catch { /* retry */ }
    await new Promise(r => setTimeout(r, 2000))
  }
  return false
}

async function main() {
  console.log(`=== API Smoke Tests (port ${PORT}) ===\n`)

  const docsProbe = await fetch(`${BASE}/docs/json`, { signal: AbortSignal.timeout(3000) }).catch(() => null)
  if (!docsProbe?.ok) {
    record('Server reachable', false, `no response on ${BASE}`)
    process.exit(1)
  }
  record('Server reachable', true, BASE)

  const root = await request('GET', `${BASE}/`)
  record('GET / (protected)', root.status === 401, `HTTP ${root.status}`)

  // Swagger
  const docs = await request('GET', `${BASE}/docs/json`)
  record('GET /docs/json', docs.ok, `HTTP ${docs.status}`)

  // Health requires JWT — expect 401 without token
  const healthNoAuth = await request('GET', `${API}/health/database`)
  record('GET /api/health/database (no auth)', healthNoAuth.status === 401, `HTTP ${healthNoAuth.status}`)

  // Legacy login blocked when Supabase auth enabled
  const loginBlocked = await request('POST', `${API}/auth/login`, {
    body: { username: 'admin', password: '123456', captchaId: 'x', verifyCode: 'x' },
  })
  const useSupabase = process.env.USE_SUPABASE_AUTH === 'true'
  if (useSupabase) {
    record('POST /auth/login blocked', loginBlocked.status === 400 || loginBlocked.status === 422 || loginBlocked.status === 500,
      `HTTP ${loginBlocked.status}`)
  }
  else {
    record('POST /auth/login', loginBlocked.ok, `HTTP ${loginBlocked.status}`)
  }

  // Supabase sign-in + exchange flow
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY
  const serviceKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY

  let nestToken = null

  if (supabaseUrl && anonKey && serviceKey && useSupabase) {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const client = createClient(supabaseUrl, anonKey)

    // Link to seeded admin sys_user via email auto-link on exchange
    const testEmail = '1743369777@qq.com'
    const testPassword = 'SmokeTest123!'

    let authUserId = null
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    })

    if (createErr?.message?.includes('already') || createErr?.status === 422) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
      const existing = list?.users?.find(u => u.email === testEmail)
      if (existing) {
        authUserId = existing.id
        await admin.auth.admin.updateUserById(existing.id, {
          password: testPassword,
          email_confirm: true,
        })
        record('Supabase admin user', true, 'existing user updated')
      }
      else {
        record('Supabase admin user', false, createErr.message)
      }
    }
    else if (createErr) {
      record('Supabase admin user', false, createErr.message)
    }
    else {
      authUserId = created.user.id
      record('Supabase admin user', true, 'created for seed admin email')
    }

    if (authUserId || created?.user) {
      const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      })

      if (signInErr) {
        record('Supabase signIn', false, signInErr.message)
      }
      else {
        record('Supabase signIn', true, 'access_token received')

        const exchange = await request('POST', `${API}/auth/exchange`, {
          body: { supabaseAccessToken: signIn.session.access_token },
        })

        const token = exchange.json?.data?.token ?? exchange.json?.token
        if (exchange.ok && token) {
          nestToken = token
          record('POST /auth/exchange', true, 'Nest JWT issued (admin auto-link)')
        }
        else {
          record('POST /auth/exchange', false, `HTTP ${exchange.status} ${JSON.stringify(exchange.json)?.slice(0, 200)}`)
        }
      }
    }
  }
  else {
    record('Supabase exchange flow', false, 'missing keys or USE_SUPABASE_AUTH=false')
  }

  // Protected API with Nest JWT
  if (nestToken) {
    const menus = await request('GET', `${API}/system/menus`, {
      headers: { Authorization: `Bearer ${nestToken}` },
    })
    const menuCount = Array.isArray(menus.json?.data) ? menus.json.data.length : null
    record('GET /api/system/menus (JWT)', menus.ok, `HTTP ${menus.status}${menuCount != null ? `, ${menuCount} menus` : ''}`)

    const healthAuth = await request('GET', `${API}/health/database`, {
      headers: { Authorization: `Bearer ${nestToken}` },
    })
    record('GET /api/health/database (JWT)', healthAuth.ok, `HTTP ${healthAuth.status}`)
  }
  else {
    record('GET /api/system/menus (JWT)', false, 'no token from exchange')
    record('GET /api/health/database (JWT)', false, 'skipped')
  }

  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})