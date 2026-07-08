import { LandingAiMetricsService } from './landing-ai-metrics.service'

describe('LandingAiMetricsService', () => {
  it('tracks success rate and latency percentiles', () => {
    const service = new LandingAiMetricsService()

    service.recordJob({
      jobId: 'job-1',
      pageId: 'page-1',
      type: 'ai',
      tenantId: 1,
      success: true,
      totalDurationMs: 100,
    })
    service.recordJob({
      jobId: 'job-2',
      pageId: 'page-2',
      type: 'clone',
      tenantId: 1,
      success: true,
      totalDurationMs: 300,
    })
    service.recordJob({
      jobId: 'job-3',
      pageId: 'page-3',
      type: 'ppc',
      tenantId: 1,
      success: false,
      totalDurationMs: 500,
    })

    const snapshot = service.getSnapshot()
    expect(snapshot.totalJobs).toBe(3)
    expect(snapshot.successCount).toBe(2)
    expect(snapshot.failureCount).toBe(1)
    expect(snapshot.successRate).toBeCloseTo(2 / 3)
    expect(snapshot.p50LatencyMs).toBe(300)
    expect(snapshot.p95LatencyMs).toBe(500)
  })
})