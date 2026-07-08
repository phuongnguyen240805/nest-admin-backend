import { LandingPagesStorageService } from './landing-pages-storage.service'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

function mockSlugLookup(existing: { id: string } | null) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: existing, error: null }),
        }),
      }),
    }),
  }
}

describe('LandingPagesStorageService', () => {
  const mockFrom = jest.fn()
  const mockClient = { from: mockFrom }
  const supabaseService = {
    hasAdminClient: jest.fn(() => true),
    getAdminClient: jest.fn(() => mockClient),
  }

  function createService() {
    return new LandingPagesStorageService(supabaseService as never)
  }

  const editorData = { version: 1, pages: [] }

  beforeEach(() => {
    mockFrom.mockReset()
    supabaseService.hasAdminClient.mockReturnValue(true)
    supabaseService.getAdminClient.mockReturnValue(mockClient)
  })

  it('upserts landing_pages with Supabase user_id when linked', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'landing_pages') {
        return { ...mockSlugLookup(null), upsert }
      }
      return {}
    })

    const service = createService()
    const result = await service.upsertLandingPage({
      pageId: 'page-1',
      name: 'Test Page',
      slug: 'test-page',
      supabaseUserId: USER_ID,
      editorData: editorData as never,
    })

    expect(result.slug).toBe('test-page')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'page-1',
        slug: 'test-page',
        user_id: USER_ID,
      }),
      { onConflict: 'id' },
    )
  })

  it('appends numeric suffix when user slug already exists for another page', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    let slugLookupCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'landing_pages') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((_col: string, slug: string) => ({
                maybeSingle: jest.fn().mockImplementation(async () => {
                  slugLookupCount += 1
                  if (slug === 'lumiere-spa') {
                    return { data: { id: 'other-page-id' }, error: null }
                  }
                  return { data: null, error: null }
                }),
              })),
            }),
          }),
          upsert,
        }
      }
      return {}
    })

    const service = createService()
    const result = await service.upsertLandingPage({
      pageId: '11111111-1111-4111-8111-111111111111',
      name: 'Lumière Spa',
      slug: 'lumiere-spa',
      supabaseUserId: USER_ID,
      editorData: editorData as never,
    })

    expect(result.slug).toBe('lumiere-spa-2')
    expect(slugLookupCount).toBeGreaterThanOrEqual(2)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'lumiere-spa-2' }),
      { onConflict: 'id' },
    )
  })

  it('throws when Supabase user_id is missing', async () => {
    const service = createService()

    await expect(
      service.upsertLandingPage({
        pageId: 'page-2',
        name: 'Legacy Page',
        slug: 'legacy-page',
        supabaseUserId: null,
        editorData: editorData as never,
      }),
    ).rejects.toThrow('supabaseUserId is required')
  })

  it('throws when admin client unavailable', async () => {
    supabaseService.hasAdminClient.mockReturnValue(false)
    const service = createService()

    await expect(
      service.upsertLandingPage({
        pageId: 'page-3',
        name: 'Offline',
        slug: 'offline',
        supabaseUserId: USER_ID,
        editorData: editorData as never,
      }),
    ).rejects.toThrow('Supabase admin client unavailable')
  })

  it('retries without optional AI metadata when Supabase schema cache is stale', async () => {
    const upsert = jest.fn()
      .mockResolvedValueOnce({
        error: {
          message: "Could not find the 'ai_source_html' column of 'landing_pages' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'landing_pages') {
        return { ...mockSlugLookup(null), upsert }
      }
      return {}
    })

    const service = createService()
    await service.upsertLandingPage({
      pageId: 'page-4',
      name: 'AI Page',
      slug: 'ai-page',
      supabaseUserId: USER_ID,
      editorData: editorData as never,
      aiSourceHtml: '<html>AI</html>',
      generationMeta: { mock: true },
    })

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ai_source_html: '<html>AI</html>',
        generation_meta: { mock: true },
      }),
      { onConflict: 'id' },
    )
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({
        ai_source_html: expect.anything(),
        generation_meta: expect.anything(),
      }),
      { onConflict: 'id' },
    )
  })
})