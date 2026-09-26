import { extractLandingHtml, rewriteImportedLandingHtml } from './imported-html'

describe('imported-html', () => {
  it('prefers published_html over ai_source_html', () => {
    expect(
      extractLandingHtml({
        aiSourceHtml: '<p>ai</p>',
        publishedHtml: '<p>published</p>',
        editorData: { html: '<p>editor</p>' },
      }),
    ).toBe('<p>published</p>')
  })

  it('extracts preserveHtml html_code from visual-editor sections', () => {
    const html = extractLandingHtml({
      editorData: {
        sections: [
          {
            type: 'custom_section',
            children: [
              {
                type: 'html_code',
                props: { preserveHtml: true, code: '<html><body>restaurant</body></html>' },
              },
            ],
          },
        ],
      },
    })
    expect(html).toContain('restaurant')
  })

  it('rewrites restaurant template relative images to the LadiPage origin', () => {
    const html =
      '<img src="assets/img/plate1.png" /><div style="background:url(assets/img/home.png)"></div>'
    const out = rewriteImportedLandingHtml(html, 'https://ladipage.example')
    expect(out).toContain(
      'src="https://ladipage.example/templates/bedimcode/responsive-website-restaurant/assets/img/plate1.png"',
    )
    expect(out).toContain(
      'url(https://ladipage.example/templates/bedimcode/responsive-website-restaurant/assets/img/home.png)',
    )
  })

  it('prefixes /templates root-relative URLs', () => {
    const html =
      '<img src="/templates/bedimcode/responsive-website-restaurant/assets/img/plate1.png" />'
    const out = rewriteImportedLandingHtml(html, 'https://ladipage.example')
    expect(out).toContain(
      'src="https://ladipage.example/templates/bedimcode/responsive-website-restaurant/assets/img/plate1.png"',
    )
  })
})
