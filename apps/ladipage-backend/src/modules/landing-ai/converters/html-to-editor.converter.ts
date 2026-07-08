export interface EditorDataShape {
  pageId: string
  pageName: string
  sections: Array<Record<string, unknown>>
  pageSettings: Record<string, unknown>
  schemaVersion: number
}

const SCHEMA_VERSION = 2

const STYLE_COLORS: Record<string, string> = {
  modern: '#3B82F6',
  premium: '#1F2937',
  bold: '#EC4899',
  friendly: '#10B981',
}

export type LandingAiGenerationSource = 'ai' | 'clone' | 'ppc'

export interface PreserveEditorDataOptions {
  style?: string
  industry?: string
  businessName?: string
  generationSource?: LandingAiGenerationSource
  generationJobId?: string
}

export class HtmlToEditorConverter {
  static toPreserveEditorData(
    html: string,
    pageId: string,
    pageName: string,
    options?: PreserveEditorDataOptions,
  ): EditorDataShape {
    const style = options?.style ?? 'modern'
    const primaryColor = STYLE_COLORS[style] ?? '#3B82F6'

    return {
      pageId,
      pageName,
      sections: [
        {
          id: `ai_html_${Date.now()}`,
          type: 'html_code',
          label: 'AI Generated Page',
          props: {
            code: html,
            height: 1200,
            preserveHtml: true,
            mode: 'preserve',
          },
        },
      ],
      pageSettings: {
        seoTitle: `${pageName} - ${options?.industry ?? 'landing page'}`,
        seoDescription: `Website giới thiệu ${options?.businessName ?? pageName}`,
        bgColor: style === 'premium' ? '#09090b' : '#ffffff',
        primaryColor,
        fontFamily: 'Inter, sans-serif',
        maxWidth: 1280,
        ...(options?.generationSource
          ? { generationSource: options.generationSource }
          : {}),
        ...(options?.generationJobId
          ? { generationJobId: options.generationJobId }
          : {}),
      },
      schemaVersion: SCHEMA_VERSION,
    }
  }

  static buildMockHtml(
    pageName: string,
    prompt: string,
    businessName?: string,
  ): string {
    const title = businessName ?? pageName
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: Inter, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 48px 20px; }
    h1 { font-size: 2.2rem; margin-bottom: 12px; }
    p { line-height: 1.6; color: #475569; }
    .cta { display: inline-block; margin-top: 24px; padding: 12px 20px; background: #7c3aed; color: #fff; border-radius: 10px; text-decoration: none; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${title}</h1>
    <p>${prompt || 'Landing page được tạo bởi Liora AI (mock mode).'}</p>
    <a class="cta" href="#contact">Đăng ký tư vấn</a>
  </div>
</body>
</html>`
  }
}