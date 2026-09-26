import {
  buildEditorSsoUrls,
  buildPublicPageUrl,
  canonicalInstaticPageId,
  ladipagePageIdFromInstatic,
} from './instatic-ids'

describe('instatic-ids', () => {
  it('canonicalizes ladipage ids once', () => {
    expect(canonicalInstaticPageId('p1')).toBe('page_p1')
    expect(canonicalInstaticPageId('page_p1')).toBe('page_p1')
  })

  it('derives ladipage id from canonical instatic page id', () => {
    expect(ladipagePageIdFromInstatic('page_p1')).toBe('p1')
    expect(ladipagePageIdFromInstatic('home')).toBeNull()
  })

  it('builds absolute SSO editor URLs', () => {
    const urls = buildEditorSsoUrls('https://editor.example', 'tok+1')
    expect(urls.cmsPath).toBe('/admin/api/cms/auth/ladipage-sso?token=tok%2B1')
    expect(urls.editorUrl).toBe(
      'https://editor.example/admin/api/cms/auth/ladipage-sso?token=tok%2B1',
    )
  })

  it('builds /p/{slug} public URLs', () => {
    expect(buildPublicPageUrl('https://app.example', 'hello')).toBe(
      'https://app.example/p/hello',
    )
    expect(buildPublicPageUrl('', 'hello')).toBeNull()
  })
})
