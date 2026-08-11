import { createHmac, timingSafeEqual } from 'node:crypto'

export function buildSepayQrUrl(input: {
  account: string
  bank: string
  amount: number
  referenceCode: string
  template?: string
  holder?: string
  store?: string
}): string {
  const url = new URL('https://vietqr.app/img')
  url.searchParams.set('acc', input.account)
  url.searchParams.set('bank', input.bank)
  url.searchParams.set('amount', String(Math.round(input.amount)))
  url.searchParams.set('des', input.referenceCode)
  url.searchParams.set('template', input.template?.trim() || 'compact')
  if (input.holder?.trim()) url.searchParams.set('holder', input.holder.trim())
  if (input.store?.trim()) url.searchParams.set('store', input.store.trim())
  return url.toString()
}

export function verifySepayHmac(input: {
  secret: string
  rawBody: string
  timestampHeader: string
  signatureHeader: string
  nowSeconds?: number
  maxSkewSeconds?: number
}): boolean {
  const timestamp = Number(input.timestampHeader)
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const maxSkewSeconds = input.maxSkewSeconds ?? 300
  if (!input.secret || !Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > maxSkewSeconds) {
    return false
  }
  const expected = `sha256=${createHmac('sha256', input.secret)
    .update(`${input.timestampHeader}.${input.rawBody}`)
    .digest('hex')}`
  const received = Buffer.from(input.signatureHeader || '', 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer)
}

export function extractLioraPaymentReference(code?: string | null, content?: string): string | null {
  const direct = code?.trim().toUpperCase()
  if (direct && /^LIO\d+P\d+$/.test(direct)) return direct
  const match = (content ?? '').toUpperCase().match(/\bLIO\d+P\d+\b/)
  return match?.[0] ?? null
}

export function parseSepayTransactionDate(value: string): Date | null {
  const normalized = value.trim().replace(' ', 'T')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) return null
  const parsed = new Date(`${normalized}+07:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
