import { HtmlToEditorConverter } from './html-to-editor.converter'

describe('HtmlToEditorConverter', () => {
  it('sets preserveHtml on html_code block for publish', () => {
    const html = '<!DOCTYPE html><html><body><h1>Test</h1></body></html>'
    const result = HtmlToEditorConverter.toPreserveEditorData(
      html,
      'page-1',
      'Test Page',
      {
        generationSource: 'ai',
        generationJobId: 'job-1',
        industry: 'spa',
        businessName: 'Spa ABC',
      },
    )

    expect(result.sections).toHaveLength(1)
    const section = result.sections[0] as {
      type: string
      props: Record<string, unknown>
    }
    expect(section.type).toBe('html_code')
    expect(section.props.code).toBe(html)
    expect(section.props.preserveHtml).toBe(true)
    expect(section.props.mode).toBe('preserve')
    expect(result.pageSettings.generationSource).toBe('ai')
    expect(result.pageSettings.generationJobId).toBe('job-1')
  })
})