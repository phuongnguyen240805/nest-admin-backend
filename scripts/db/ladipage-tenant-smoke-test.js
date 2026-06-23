#!/usr/bin/env node
/**
 * Ladipage-backend tenant + business API smoke test (port 7002).
 * Usage: node scripts/db/ladipage-tenant-smoke-test.js
 */
require('dotenv').config()

const PORT = process.env.LADIPAGE_PORT || 7002
const BASE = `http://127.0.0.1:${PORT}`
const API = `${BASE}/api`

const results = []

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function request(method, url, options = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout ?? 20000),
  })
  let json = null
  const text = await res.text()
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, ok: res.ok, json, text }
}

async function obtainNestToken() {
  const useSupabase = process.env.USE_SUPABASE_AUTH === 'true'
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY
  const serviceKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (useSupabase && supabaseUrl && anonKey && serviceKey) {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const client = createClient(supabaseUrl, anonKey)

    const testEmail = process.env.SMOKE_TEST_EMAIL || '1743369777@qq.com'
    const testPassword = process.env.SMOKE_TEST_PASSWORD || 'SmokeTest123!'

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    })

    if (createErr && !String(createErr.message || '').includes('already') && createErr.status !== 422) {
      record('Supabase user setup', false, createErr.message)
      return null
    }

    const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    if (signInErr) {
      record('Supabase signIn', false, signInErr.message)
      return null
    }

    record('Supabase signIn', true, testEmail)

    const exchange = await request('POST', `${API}/auth/exchange`, {
      body: { supabaseAccessToken: signIn.session.access_token },
    })

    const token = exchange.json?.data?.token ?? exchange.json?.token
    if (exchange.ok && token) {
      record('POST /auth/exchange', true, 'Nest JWT issued')
      return token
    }

    record('POST /auth/exchange', false, `HTTP ${exchange.status} ${JSON.stringify(exchange.json)?.slice(0, 300)}`)
    return null
  }

  // Legacy login fallback
  const login = await request('POST', `${API}/auth/login`, {
    body: {
      email: process.env.SMOKE_TEST_EMAIL || 'admin@liora.dev',
      password: process.env.SMOKE_TEST_PASSWORD || 'a123456',
      captchaId: 'smoke',
      verifyCode: '0000',
    },
  })
  const token = login.json?.data?.token ?? login.json?.token
  if (login.ok && token) {
    record('POST /auth/login (legacy)', true, 'Nest JWT issued')
    return token
  }

  record('Auth token', false, `Supabase disabled or login failed HTTP ${login.status}`)
  return null
}

async function testProtected(name, method, path, token, options = {}) {
  const res = await request(method, `${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    ...options,
  })
  const code = res.json?.code
  const pass = res.ok && (code === undefined || code === 200)
  record(name, pass, `HTTP ${res.status}${code != null ? `, code=${code}` : ''}`)
  return res
}

async function testExpectStatus(name, method, path, token, expectedStatus, options = {}) {
  const res = await request(method, `${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    ...options,
  })
  const pass = res.status === expectedStatus
  record(name, pass, `HTTP ${res.status} (expected ${expectedStatus})`)
  return res
}

function isCrmEnabled() {
  const raw = process.env.CRM_ENABLED ?? process.env.CRM_V2_ENABLED ?? 'false'
  return raw === 'true' || raw === '1'
}

async function runCrmSmoke(token, auth) {
  const enabled = isCrmEnabled()
  record('CRM_ENABLED flag', true, String(enabled))

  if (!enabled) {
    await testExpectStatus('GET /crm/opportunities (CRM off → 503)', 'GET', '/crm/opportunities', token, 503)
    await testExpectStatus('GET /crm/pipelines/default (CRM off → 503)', 'GET', '/crm/pipelines/default', token, 503)
    await testExpectStatus('GET /crm/activities (CRM off → 503)', 'GET', '/crm/activities', token, 503)
    await testExpectStatus('GET /crm/objects (CRM off → 503)', 'GET', '/crm/objects', token, 503)
    return
  }

  await testProtected('GET /crm/pipelines/default', 'GET', '/crm/pipelines/default', token)
  await testProtected('GET /crm/opportunities', 'GET', '/crm/opportunities?page=1&pageSize=5', token)
  await testProtected('GET /crm/tasks', 'GET', '/crm/tasks?page=1&pageSize=5', token)
  await testProtected('GET /crm/notes', 'GET', '/crm/notes?page=1&pageSize=5', token)
  await testProtected('GET /crm/activities', 'GET', '/crm/activities?page=1&pageSize=5', token)
  await testProtected('GET /crm/custom-fields', 'GET', '/crm/custom-fields?page=1&pageSize=5', token)
  await testProtected('GET /crm/companies', 'GET', '/crm/companies?page=1&pageSize=5', token)

  const personRes = await request('POST', `${API}/crm/customers`, {
    ...auth,
    body: {
      name: 'CRM Smoke Person',
      phone: '0900000099',
      email: 'crm-smoke@test.local',
    },
  })
  const personId = personRes.json?.data?.id ?? personRes.json?.data?.items?.[0]?.id
  const personPass = personRes.ok && (personRes.json?.code === 200 || personRes.json?.code === undefined) && personId
  record('POST /crm/customers (v2 person)', personPass, `HTTP ${personRes.status}, id=${personId || 'missing'}`)

  const pipelineRes = await request('GET', `${API}/crm/pipelines/default`, auth)
  const stages = pipelineRes.json?.data?.stages ?? pipelineRes.json?.data?.items ?? []
  const stageId = stages[0]?.id

  let opportunityId = null
  if (personId && stageId) {
    const oppRes = await request('POST', `${API}/crm/opportunities`, {
      ...auth,
      body: { name: 'Smoke Deal', amount: 500000, stageId, personId },
    })
    opportunityId = oppRes.json?.data?.id
    const oppPass = oppRes.ok && (oppRes.json?.code === 200 || oppRes.json?.code === undefined) && opportunityId
    record('POST /crm/opportunities (v2 deal)', oppPass, `HTTP ${oppRes.status}, id=${opportunityId || 'missing'}`)
  } else {
    record('POST /crm/opportunities (v2 deal)', false, 'skipped — missing personId or stageId')
  }

  if (personId) {
    const taskRes = await request('POST', `${API}/crm/tasks`, {
      ...auth,
      body: { title: 'Smoke Task', personId, status: 'TODO' },
    })
    const taskPass = taskRes.ok && (taskRes.json?.code === 200 || taskRes.json?.code === undefined)
    record('POST /crm/tasks (v2)', taskPass, `HTTP ${taskRes.status}`)

    const noteRes = await request('POST', `${API}/crm/notes`, {
      ...auth,
      body: { body: 'Smoke note', personId },
    })
    const notePass = noteRes.ok && (noteRes.json?.code === 200 || noteRes.json?.code === undefined)
    record('POST /crm/notes (v2)', notePass, `HTTP ${noteRes.status}`)
  }

  if (personId) {
    const actRes = await request('GET', `${API}/crm/activities?personId=${personId}`, auth)
    const actPass = actRes.ok && (actRes.json?.code === 200 || actRes.json?.code === undefined)
    record('GET /crm/activities (person timeline)', actPass, `HTTP ${actRes.status}`)
  }

  const dashRes = await request('GET', `${API}/dashboard/summary`, auth)
  const dashPass = dashRes.ok && (dashRes.json?.code === 200 || dashRes.json?.code === undefined)
  record('GET /dashboard/summary (v2 counts)', dashPass, `HTTP ${dashRes.status}`)

  const analyticsRes = await request('GET', `${API}/analytics/reports/customers`, auth)
  const analyticsPass = analyticsRes.ok && (analyticsRes.json?.code === 200 || analyticsRes.json?.code === undefined)
  record('GET /analytics/reports/customers (v2)', analyticsPass, `HTTP ${analyticsRes.status}`)

  const orderRes = await request('POST', `${API}/ecom/orders`, {
    ...auth,
    body: {
      customerName: 'CRM Order',
      customerPhone: '0900000099',
      customerEmail: 'crm-smoke@test.local',
      items: [{ productName: 'CRM Product', quantity: 1, unitPrice: 200000 }],
    },
  })
  const orderPass = orderRes.ok && (orderRes.json?.code === 200 || orderRes.json?.code === undefined)
  record('POST /ecom/orders (v2 person link)', orderPass, `HTTP ${orderRes.status}`)

  const objectsRes = await request('GET', `${API}/crm/objects`, auth)
  if (objectsRes.status === 403) {
    record('GET /crm/objects (enterprise gate)', true, 'HTTP 403 — expected on non-Enterprise tier')
  } else {
    const objectsPass = objectsRes.ok && (objectsRes.json?.code === 200 || objectsRes.json?.code === undefined)
    record('GET /crm/objects (enterprise)', objectsPass, `HTTP ${objectsRes.status}`)
  }

  if (opportunityId) {
    await testProtected('GET /crm/opportunities/:id', 'GET', `/crm/opportunities/${opportunityId}`, token)
  }
}

async function main() {
  console.log(`=== Ladipage Tenant Smoke Test (port ${PORT}) ===\n`)

  const docs = await fetch(`${BASE}/docs/json`, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  record('Server reachable', !!docs?.ok, BASE)

  if (!docs?.ok) {
    process.exit(1)
  }

  const token = await obtainNestToken()
  if (!token) {
    console.log('\n=== Summary ===')
    console.log(`0 passed, ${results.filter(r => !r.pass).length} failed`)
    process.exit(1)
  }

  const payload = decodeJwtPayload(token)
  const hasOrg = !!payload?.organizationId
  const hasTenant = payload?.tenantId != null || payload?.activeTenantId != null
  record('JWT has organizationId', hasOrg, payload?.organizationId || 'missing')
  record('JWT has tenantId', hasTenant, String(payload?.tenantId ?? payload?.activeTenantId ?? 'missing'))

  const auth = { headers: { Authorization: `Bearer ${token}` } }

  // Billing & Plans
  await testProtected('GET /plans', 'GET', '/plans', token)
  await testProtected('GET /billing/usage', 'GET', '/billing/usage', token)

  // Settings
  await testProtected('GET /settings/workspace', 'GET', '/settings/workspace', token)
  await testProtected('GET /settings/integrations', 'GET', '/settings/integrations', token)

  // Dashboard
  await testProtected('GET /dashboard/summary', 'GET', '/dashboard/summary', token)
  await testProtected('GET /dashboard/onboarding', 'GET', '/dashboard/onboarding', token)

  // Analytics
  await testProtected('GET /analytics/reports/sales', 'GET', '/analytics/reports/sales', token)
  await testProtected('GET /analytics/reports/customers', 'GET', '/analytics/reports/customers', token)

  // Ecom
  await testProtected('GET /ecom/orders', 'GET', '/ecom/orders?page=1&pageSize=5', token)
  await testProtected('GET /ecom/products', 'GET', '/ecom/products?page=1&pageSize=5', token)
  await testProtected('GET /ecom/reviews', 'GET', '/ecom/reviews?page=1&pageSize=5', token)
  await testProtected('GET /ecom/tags (order)', 'GET', '/ecom/tags?entity=order&page=1&pageSize=5', token)
  await testProtected('GET /ecom/categories', 'GET', '/ecom/categories?page=1&pageSize=5', token)

  const tagRes = await request('POST', `${API}/ecom/tags`, {
    ...auth,
    body: { entity: 'order', name: `Smoke Tag ${Date.now()}`, color: '#fb923c' },
  })
  const tagPass =
    tagRes.status !== 422 &&
    tagRes.ok &&
    (tagRes.json?.code === 200 || tagRes.json?.code === undefined)
  record(
    'POST /ecom/tags (color field)',
    tagPass,
    tagRes.status === 422
      ? `HTTP 422 — rebuild & restart ladipage-backend (stale DTO)`
      : `HTTP ${tagRes.status}`,
  )

  const catRes = await request('POST', `${API}/ecom/categories`, {
    ...auth,
    body: {
      name: `Smoke Cat ${Date.now()}`,
      visible: true,
      imageUrl: 'https://example.com/cat.png',
    },
  })
  const catPass =
    catRes.status !== 422 &&
    catRes.ok &&
    (catRes.json?.code === 200 || catRes.json?.code === undefined)
  record(
    'POST /ecom/categories (visible field)',
    catPass,
    catRes.status === 422
      ? `HTTP 422 — rebuild & restart ladipage-backend (stale DTO)`
      : `HTTP ${catRes.status}`,
  )

  const orderRes = await request('POST', `${API}/ecom/orders`, {
    ...auth,
    body: {
      customerName: 'Smoke Test',
      customerPhone: '0900000001',
      customerEmail: 'smoke@test.local',
      items: [{ productName: 'Smoke Product', quantity: 1, unitPrice: 100000 }],
    },
  })
  const orderPass = orderRes.ok && (orderRes.json?.code === 200 || orderRes.json?.code === undefined)
  record('POST /ecom/orders', orderPass, `HTTP ${orderRes.status}`)

  const productRes = await request('POST', `${API}/ecom/products`, {
    ...auth,
    body: {
      name: `Smoke Product ${Date.now()}`,
      sku: `SMK-${Date.now()}`,
      price: 0,
      stock: 0,
      status: 'ACTIVE',
      type: 'digital',
      typeName: 'Sản phẩm số',
    },
  })
  const productPass =
    productRes.status !== 404 &&
    productRes.ok &&
    (productRes.json?.code === 200 || productRes.json?.code === undefined)
  record(
    'POST /ecom/products',
    productPass,
    productRes.status === 404
      ? 'HTTP 404 Product not found — rebuild & restart ladipage-backend (transaction/detail bug)'
      : `HTTP ${productRes.status}`,
  )

  // CRM v1
  await testProtected('GET /crm/customers', 'GET', '/crm/customers?page=1&pageSize=5', token)
  const crmSearch = await request('GET', `${API}/crm/customers?search=0900000001`, auth)
  const crmPass = crmSearch.ok && (crmSearch.json?.code === 200 || crmSearch.json?.code === undefined)
  record('GET /crm/customers (auto-link)', crmPass, `HTTP ${crmSearch.status}`)
  await testProtected('GET /crm/segments', 'GET', '/crm/segments?page=1&pageSize=5', token)
  await testProtected('GET /crm/tags', 'GET', '/crm/tags?page=1&pageSize=5', token)
  await testProtected('GET /crm/custom-fields', 'GET', '/crm/custom-fields?targetType=person&page=1&pageSize=5', token)

  const crmTagRes = await request('POST', `${API}/crm/tags`, {
    ...auth,
    body: { name: `Smoke CRM Tag ${Date.now()}` },
  })
  const crmTagPass = crmTagRes.ok && (crmTagRes.json?.code === 200 || crmTagRes.json?.code === undefined)
  record('POST /crm/tags', crmTagPass, `HTTP ${crmTagRes.status}`)
  const crmTagId = crmTagRes.json?.data?.id

  const crmSegRes = await request('POST', `${API}/crm/segments`, {
    ...auth,
    body: { name: `Smoke CRM Segment ${Date.now()}` },
  })
  const crmSegPass = crmSegRes.ok && (crmSegRes.json?.code === 200 || crmSegRes.json?.code === undefined)
  record('POST /crm/segments', crmSegPass, `HTTP ${crmSegRes.status}`)
  const crmSegId = crmSegRes.json?.data?.id

  const crmCfRes = await request('POST', `${API}/crm/custom-fields`, {
    ...auth,
    body: {
      fieldName: `smoke_field_${Date.now()}`,
      displayName: 'Smoke Custom Field',
      dataType: 'TEXT',
      targetType: 'person',
    },
  })
  const crmCfPass =
    (crmCfRes.ok && (crmCfRes.json?.code === 200 || crmCfRes.json?.code === undefined)) ||
    crmCfRes.status === 403
  record(
    'POST /crm/custom-fields (person)',
    crmCfPass,
    crmCfRes.status === 403
      ? 'HTTP 403 — Pro tier field quota reached (endpoint OK)'
      : `HTTP ${crmCfRes.status}`,
  )

  const crmCustRes = await request('POST', `${API}/crm/customers`, {
    ...auth,
    body: {
      name: `Smoke CRM Customer ${Date.now()}`,
      phone: `09${String(Date.now()).slice(-8)}`,
      email: `smoke.crm.${Date.now()}@test.local`,
      status: 'ACTIVE',
      tagIds: crmTagId ? [crmTagId] : undefined,
      segmentIds: crmSegId ? [crmSegId] : undefined,
    },
  })
  const crmCustPass = crmCustRes.ok && (crmCustRes.json?.code === 200 || crmCustRes.json?.code === undefined)
  const crmCustTags = crmCustRes.json?.data?.tags
  const crmCustSegment = crmCustRes.json?.data?.segment
  record(
    'POST /crm/customers (tag/segment bridge)',
    crmCustPass && Array.isArray(crmCustTags) && crmCustTags.length > 0,
    crmCustPass
      ? `HTTP ${crmCustRes.status}, tags=${JSON.stringify(crmCustTags)}, segment=${crmCustSegment ?? 'none'}`
      : `HTTP ${crmCustRes.status}`,
  )

  // CRM (Phase 9)
  console.log('\n--- CRM smoke ---')
  await runCrmSmoke(token, auth)

  // Tenant guard rejection without token
  const noAuth = await request('GET', `${API}/ecom/orders`)
  record('GET /ecom/orders (no auth → 401)', noAuth.status === 401, `HTTP ${noAuth.status}`)

  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`)

  if (failed > 0) {
    console.log('\nFailed:')
    for (const r of results.filter(x => !x.pass)) {
      console.log(`  - ${r.name}: ${r.detail}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})