import { customerCareAiRetryDelayMs, customerCareAutoReplySafety, normalizeCustomerCareIntent } from './customer-care-ai-automation.policy'

describe('CustomerCareAiAutomationService policy helpers', () => {
  it.each([
    ['provide_order_details', 'ORDER_DETAILS'],
    ['order-detail', 'ORDER_DETAILS'],
    ['track order', 'ORDER_TRACKING'],
    ['payment_status', 'PAYMENT_STATUS'],
  ])('normalizes intent %s to %s', (input, expected) => {
    expect(normalizeCustomerCareIntent(input)).toBe(expected)
  })

  it('allows order details only when an authoritative order code exists', () => {
    expect(customerCareAutoReplySafety({
      confidence: 0.95,
      proposedActions: [],
      facts: [{ type: 'order', label: 'DH1006' }],
    }, 'ORDER_DETAILS', 0.85)).toEqual({ ok: true, reason: 'ok' })

    expect(customerCareAutoReplySafety({
      confidence: 0.95,
      proposedActions: [],
      facts: [{ type: 'order', label: null }],
    }, 'ORDER_DETAILS', 0.85)).toEqual({ ok: false, reason: 'order-code-missing' })
  })

  it('waits for the provider reset window on 402/429 responses', () => {
    expect(customerCareAiRetryDelayMs(1, new Error('request failed (402) (reset after 1m 32s)'))).toBe(97_000)
    expect(customerCareAiRetryDelayMs(1, new Error('request failed (429)'))).toBe(90_000)
  })

  it('keeps bounded exponential backoff for ordinary failures', () => {
    expect(customerCareAiRetryDelayMs(1, new Error('network error'))).toBe(5_000)
    expect(customerCareAiRetryDelayMs(3, new Error('network error'))).toBe(20_000)
  })
})
