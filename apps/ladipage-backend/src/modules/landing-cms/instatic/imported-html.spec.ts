import {
  collectLinkedStylesheets,
  extractLandingHtml,
  rewriteImportedLandingHtml,
} from './imported-html'

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

  it('fetches same-origin linked stylesheets', async () => {
    const html =
      '<link rel="stylesheet" href="https://ladipage.example/templates/x/assets/css/styles.css">'
    const fetchImpl = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://ladipage.example/templates/x/assets/css/styles.css')
      return new Response('.bd-grid{display:grid}', { status: 200 })
    }) as typeof fetch
    const css = await collectLinkedStylesheets(html, 'https://ladipage.example', fetchImpl)
    expect(css).toContain('.bd-grid{display:grid}')
  })

  it('harvests inline style tags including :root variables', async () => {
    const html =
      '<style>:root{--text-color:#707070;--body-color:#FBFEFD}body{color:var(--text-color)}.bd-grid{display:grid}</style><div class="bd-grid"></div>'
    const css = await collectLinkedStylesheets(html, 'https://ladipage.example')
    expect(css).toContain('--text-color:#707070')
    expect(css).toContain('--body-color:#FBFEFD')
    expect(css).toContain('.bd-grid{display:grid}')
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
