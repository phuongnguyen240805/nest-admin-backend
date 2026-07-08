import type { LandingAiJobParamsDto } from '../dto/create-landing-ai-job.dto'

const GOAL_LABELS: Record<string, string> = {
  generate_leads: 'Thu thập thông tin khách hàng (form leads)',
  sell_products: 'Bán sản phẩm trực tiếp',
  brand_intro: 'Giới thiệu dịch vụ và đặt lịch tư vấn',
  call_now: 'Khách hàng gọi điện trực tiếp',
  buy_now: 'Thanh toán nhận ưu đãi ngay',
}

const STYLE_LABELS: Record<string, string> = {
  modern: 'Hiện đại, sắc sảo, clean',
  premium: 'Sang trọng, tối giản, dark mode',
  bold: 'Nổi bật, vibrant, trẻ trung',
  friendly: 'Thân thiện, organic, hài hòa',
}

export class LandingPromptBuilder {
  static buildTextPrompt(
    name: string,
    params: LandingAiJobParamsDto,
    type: 'ai' | 'clone' | 'ppc',
  ): string {
    const businessName = params.businessName ?? name
    const industry = params.industry ?? 'kinh doanh'
    const location = params.location ?? 'Việt Nam'
    const goal = GOAL_LABELS[params.goal ?? ''] ?? params.goal ?? 'Thu thập leads'
    const style = STYLE_LABELS[params.style ?? ''] ?? params.style ?? 'Hiện đại'

    const sections: string[] = [
      `Tạo landing page tiếng Việt cho "${businessName}".`,
      `Lĩnh vực: ${industry}. Khu vực: ${location}.`,
      `Mục tiêu: ${goal}. Phong cách: ${style}.`,
    ]

    if (params.prompt?.trim()) {
      sections.push(`Yêu cầu chi tiết: ${params.prompt.trim()}`)
    }

    if (type === 'ppc') {
      if (params.keyword) sections.push(`Từ khóa quảng cáo: ${params.keyword}`)
      if (params.offer) sections.push(`Ưu đãi: ${params.offer}`)
      if (params.cta) sections.push(`Nhãn CTA: ${params.cta}`)
    }

    if (type === 'clone' && params.cloneMode === 'seo_landing_page' && params.keyword) {
      sections.push(`Tối ưu SEO cho từ khóa: "${params.keyword}"`)
    }

    sections.push(
      'Bắt buộc: hero, lợi ích, social proof, form thu leads, CTA rõ ràng. Mobile-first.',
    )

    return sections.join('\n')
  }

  static buildCloneImagePrompt(params: LandingAiJobParamsDto): string {
    if (params.cloneMode === 'seo_landing_page' && params.keyword) {
      return `Sao chép layout từ screenshot và tối ưu SEO cho từ khóa: "${params.keyword}".`
    }
    return 'Sao chép chính xác giao diện từ screenshot được cung cấp.'
  }
}