import {
  buildLioraSeoPixelScript,
  htmlHasSeoPixel,
  htmlHasUmamiWebsite,
  injectHtmlBeforeHeadClose,
} from './ai-seo-publish.hook'

describe('ai-seo-publish.hook', () => {
  it('injects snippet before </head>', () => {
    const html = '<html><head><title>t</title></head><body></body></html>'
    const out = injectHtmlBeforeHeadClose(html, '<script id="x"></script>')
    expect(out).toContain('<script id="x"></script></head>')
  })

  it('is idempotent for the same snippet', () => {
    const snippet = '<script id="x"></script>'
    const html = `<html><head>${snippet}</head></html>`
    const out = injectHtmlBeforeHeadClose(html, snippet)
    expect(out.split(snippet).length - 1).toBe(1)
  })

  it('appends when head is missing', () => {
    const out = injectHtmlBeforeHeadClose('<body>a</body>', '<script></script>')
    expect(out.endsWith('<script></script>')).toBe(true)
  })

  it('detects seo pixel and umami website id', () => {
    const pixel = buildLioraSeoPixelScript('proj-1')
    expect(htmlHasSeoPixel(pixel, 'proj-1')).toBe(true)
    expect(htmlHasSeoPixel(pixel, 'other')).toBe(false)
    expect(htmlHasUmamiWebsite('<script data-website-id="w1"></script>', 'w1')).toBe(true)
  })
})
