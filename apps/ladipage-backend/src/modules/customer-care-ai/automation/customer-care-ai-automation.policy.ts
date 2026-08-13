export function normalizeCustomerCareIntent(value: unknown) {
  const normalized = String(value ?? 'UNKNOWN').trim().toUpperCase().replace(/[\s-]+/g, '_')
  const aliases: Record<string, string> = {
    PROVIDE_ORDER_DETAILS: 'ORDER_DETAILS',
    ORDER_DETAIL: 'ORDER_DETAILS',
    TRACK_ORDER: 'ORDER_TRACKING',
    TRACKING_ORDER: 'ORDER_TRACKING',
  }
  return aliases[normalized] ?? normalized
}

export function customerCareAutoReplySafety(
  result: any,
  intent: string,
  minConfidence: number,
): { ok: boolean; reason: string } {
  const confidence = Number(result?.confidence)
  if (!Number.isFinite(confidence) || confidence < minConfidence) {
    return { ok: false, reason: `confidence-below-threshold:${Number.isFinite(confidence) ? confidence : 'missing'}` }
  }
  if (Array.isArray(result?.proposedActions) && result.proposedActions.length > 0) {
    return { ok: false, reason: 'action-proposal-requires-human' }
  }

  const facts = Array.isArray(result?.facts) ? result.facts : []
  const order = facts.find((fact: any) => fact?.type === 'order')
  if (!order) return { ok: false, reason: 'authoritative-order-fact-missing' }

  const known = (value: unknown) => {
    const normalized = String(value ?? '').trim().toUpperCase()
    return Boolean(normalized) && normalized !== 'UNKNOWN'
  }
  if (intent === 'ORDER_STATUS') {
    return known(order.businessStatus)
      ? { ok: true, reason: 'ok' }
      : { ok: false, reason: 'business-status-unknown' }
  }
  if (intent === 'ORDER_DETAILS') {
    return known(order.label)
      ? { ok: true, reason: 'ok' }
      : { ok: false, reason: 'order-code-missing' }
  }
  if (intent === 'PAYMENT_STATUS') {
    return known(order.paymentStatus)
      ? { ok: true, reason: 'ok' }
      : { ok: false, reason: 'payment-status-unknown' }
  }
  if (intent === 'SHIPPING_STATUS' || intent === 'ORDER_TRACKING') {
    return known(order.fulfillmentStatus)
      ? { ok: true, reason: 'ok' }
      : { ok: false, reason: 'fulfillment-status-unknown' }
  }
  return { ok: false, reason: `unsupported-auto-reply-intent:${intent}` }
}

export function customerCareAiRetryDelayMs(attempts: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const reset = message.match(/reset after\s+(?:(\d+)m)?\s*(?:(\d+)s)?/i)
  if (/\b(402|429)\b/.test(message)) {
    const resetMs = ((Number(reset?.[1] ?? 0) * 60) + Number(reset?.[2] ?? 0)) * 1_000
    return Math.max(90_000, resetMs + 5_000)
  }
  return Math.min(60_000, Math.max(5_000, 5_000 * (2 ** Math.max(0, attempts - 1))))
}
