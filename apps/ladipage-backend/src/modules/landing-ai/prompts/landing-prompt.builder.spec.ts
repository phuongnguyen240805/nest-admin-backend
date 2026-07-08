import { LandingPromptBuilder } from './landing-prompt.builder'

describe('LandingPromptBuilder', () => {
  it('includes user prompt and business context', () => {
    const text = LandingPromptBuilder.buildTextPrompt(
      'Lumière Spa',
      {
        businessName: 'Lumière Spa',
        industry: 'Spa làm đẹp',
        location: 'Hà Nội',
        goal: 'generate_leads',
        style: 'modern',
        prompt: 'Cần form ưu đãi 20%',
      },
      'ai',
    )

    expect(text).toContain('Lumière Spa')
    expect(text).toContain('Spa làm đẹp')
    expect(text).toContain('Cần form ưu đãi 20%')
    expect(text.toLowerCase()).toContain('mobile-first')
  })
})