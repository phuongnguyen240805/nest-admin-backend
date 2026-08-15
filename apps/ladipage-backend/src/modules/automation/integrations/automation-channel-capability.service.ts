import { Injectable } from '@nestjs/common'

export interface AutomationChannelCapability extends Record<string, unknown> {
  provider: string
  protectedCore: boolean
  transportReady: boolean
  implementation: 'existing-core' | 'reference-only'
  chatbotXReference: string
  capabilities: Record<string, boolean>
}

@Injectable()
export class AutomationChannelCapabilityService {
  list(): AutomationChannelCapability[] {
    return [
      this.existing('zalo_personal', 'integrations/zalo', {
        text: true, image: true, file: true, sticker: false,
        buttons: false, quickReplies: false, carousel: false, comments: false,
      }),
      this.existing('facebook_personal', 'integrations/messenger', {
        text: true, image: true, file: true, sticker: false,
        buttons: false, quickReplies: false, carousel: false, comments: false,
      }),
      this.reference('zalo_oa', 'integrations/zalo', {
        text: true, image: true, file: true, buttons: true, quickReplies: true, carousel: false, comments: false,
      }),
      this.reference('telegram', 'integrations/telegram', {
        text: true, image: true, file: true, buttons: true, quickReplies: true, carousel: false, comments: false,
      }),
      this.reference('tiktok', 'integrations/tiktok', {
        text: true, image: false, file: false, buttons: false, quickReplies: false, carousel: false, comments: true,
      }),
      this.reference('instagram', 'integrations/instagram', {
        text: true, image: true, file: false, buttons: true, quickReplies: true, carousel: false, comments: true,
      }),
      this.reference('whatsapp', 'integrations/whatsapp', {
        text: true, image: true, file: true, buttons: true, quickReplies: true, carousel: false, comments: false,
      }),
      this.reference('webchat', 'integrations/webchat', {
        text: true, image: true, file: true, buttons: true, quickReplies: true, carousel: true, comments: false,
      }),
    ]
  }

  get(provider: string): AutomationChannelCapability | null {
    const normalized = String(provider ?? '').trim().toLowerCase()
    return this.list().find((item) => item.provider === normalized) ?? null
  }

  private existing(
    provider: string,
    reference: string,
    capabilities: Record<string, boolean>,
  ): AutomationChannelCapability {
    return {
      provider,
      protectedCore: true,
      transportReady: true,
      implementation: 'existing-core',
      chatbotXReference: reference,
      capabilities,
    }
  }

  private reference(
    provider: string,
    reference: string,
    capabilities: Record<string, boolean>,
  ): AutomationChannelCapability {
    return {
      provider,
      protectedCore: false,
      transportReady: false,
      implementation: 'reference-only',
      chatbotXReference: reference,
      capabilities,
    }
  }
}
