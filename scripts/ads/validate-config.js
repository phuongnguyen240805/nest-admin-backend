#!/usr/bin/env node

const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const dotenv = require('dotenv')

const file = resolve(process.argv[2] || '.env.ads-platforms')
const config = { ...process.env, ...dotenv.parse(readFileSync(file)) }
const issues = []

function required(name, provider, options = {}) {
  const value = String(config[name] || '').trim()
  const placeholder = /(changeme|change-me|your_|example\.com|placeholder|xxx|<|>)/i.test(value)
  const valid = Boolean(value) && !placeholder
  if (!valid) issues.push({ provider, name, reason: value ? 'PLACEHOLDER' : 'EMPTY' })
  if (valid && options.url) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
        issues.push({ provider, name, reason: 'HTTPS_REQUIRED' })
      }
    } catch {
      issues.push({ provider, name, reason: 'INVALID_URL' })
    }
  }
  return value
}

const keyFile = String(config.ADS_VAULT_MASTER_KEY_FILE || '').trim()
const encodedKey = keyFile ? readFileSync(resolve(keyFile), 'utf8').trim() : required('ADS_VAULT_MASTER_KEY', 'CORE')
if (encodedKey && !issues.some((item) => item.name === 'ADS_VAULT_MASTER_KEY')) {
  try {
    if (Buffer.from(encodedKey, 'base64').length !== 32) throw new Error()
  } catch {
    issues.push({ provider: 'CORE', name: 'ADS_VAULT_MASTER_KEY', reason: 'MUST_BE_32_BYTE_BASE64' })
  }
}
required('ADS_OAUTH_RETURN_ORIGINS', 'CORE')

for (const name of ['META_APP_ID', 'META_APP_SECRET']) required(name, 'META')
for (const name of ['META_REDIRECT_URI']) required(name, 'META', { url: true })
for (const name of ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET']) required(name, 'TIKTOK')
for (const name of ['TIKTOK_API_BASE_URL', 'TIKTOK_AUTH_URL', 'TIKTOK_REDIRECT_URI']) {
  required(name, 'TIKTOK', { url: true })
}

const shopeePartner = config.SHOPEE_ADS_PARTNER_ENABLED === 'true'
const shopeePublish = config.SHOPEE_ADS_PUBLISH_ENABLED === 'true'
if (shopeePublish && !shopeePartner) {
  issues.push({ provider: 'SHOPEE', name: 'SHOPEE_ADS_PUBLISH_ENABLED', reason: 'REQUIRES_PARTNER_ENABLED' })
}
if (shopeePartner) {
  for (const name of ['SHOPEE_ADS_CLIENT_ID', 'SHOPEE_ADS_CLIENT_SECRET', 'SHOPEE_ADS_ALLOWED_HOSTS']) {
    required(name, 'SHOPEE')
  }
  for (const name of ['SHOPEE_ADS_API_BASE_URL', 'SHOPEE_ADS_AUTH_URL', 'SHOPEE_ADS_REDIRECT_URI']) {
    required(name, 'SHOPEE', { url: true })
  }
}

const grouped = ['CORE', 'META', 'TIKTOK', 'SHOPEE'].map((provider) => ({
  provider,
  ready: !issues.some((issue) => issue.provider === provider),
  issues: issues.filter((issue) => issue.provider === provider),
}))
console.log(JSON.stringify({ file, providers: grouped }, null, 2))
process.exit(issues.length ? 1 : 0)

