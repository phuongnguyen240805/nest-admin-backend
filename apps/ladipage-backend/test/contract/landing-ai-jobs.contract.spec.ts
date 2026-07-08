import { LANDING_AI_QUEUES } from '../../src/modules/landing-ai/queues/constants'

describe('Landing AI queue contract', () => {
  it('exposes stable queue names for BullMQ registration', () => {
    expect(LANDING_AI_QUEUES.GENERATE).toBe('landing-ai-generate')
    expect(LANDING_AI_QUEUES.UPDATE).toBe('landing-ai-update')
  })
})