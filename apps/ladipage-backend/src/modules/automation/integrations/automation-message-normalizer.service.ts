import { Injectable } from '@nestjs/common'

import { isAutomationRichMessageEnabled } from '../runtime/automation-feature-gate'

type JsonRecord = Record<string, unknown>

export interface NormalizedAutomationMessage {
  messageType: 'text' | 'image' | 'file' | 'sticker'
  content: string
  attachments: number[]
  fallbackUsed: boolean
  warnings: string[]
}

@Injectable()
export class AutomationMessageNormalizerService {
  normalize(configValue: unknown): NormalizedAutomationMessage {
    const config = this.record(configValue)
    const message = this.record(config.message)
    const nestedContent = this.record(message.content)
    const nestedMessage = this.record(nestedContent.message)
    const directContent = this.firstString(
      config.text,
      config.content,
      message.text,
      nestedMessage.text,
      message.title,
    )
    const directAttachments = this.numberArray(config.attachments ?? message.attachments)
    const directType = this.messageType(config.messageType ?? config.message_type ?? message.type)

    const details = this.record(config.details)
    const chatBotXSteps = this.array(details.steps ?? config.steps)
    if (!chatBotXSteps.length || !isAutomationRichMessageEnabled()) {
      return {
        messageType: directType,
        content: directContent,
        attachments: directAttachments,
        fallbackUsed: false,
        warnings: [],
      }
    }

    const textParts: string[] = directContent ? [directContent] : []
    const attachments = new Set<number>(directAttachments)
    const warnings: string[] = []
    let preferredType: NormalizedAutomationMessage['messageType'] = directType

    for (const rawStep of chatBotXSteps) {
      const step = this.record(rawStep)
      const type = this.normalizeType(step.stepType ?? step.type)
      if (!type) continue

      if (type === 'SEND_TEXT' || type === 'TEXT') {
        const text = this.firstString(step.text, step.content, this.record(step.data).text)
        if (text) textParts.push(text)
        this.appendButtons(textParts, step.buttons)
        continue
      }

      if (['SEND_IMAGE', 'IMAGE', 'SEND_FILE', 'FILE', 'SEND_VIDEO', 'VIDEO', 'SEND_AUDIO', 'AUDIO', 'SEND_GIF', 'GIF'].includes(type)) {
        const attachmentIds = this.numberArray(step.attachments ?? step.attachmentIds ?? step.attachmentId)
        attachmentIds.forEach((id) => attachments.add(id))
        const url = this.firstString(step.url, step.src, this.record(step.file).url)
        if (url) textParts.push(url)
        if (type.includes('IMAGE') && attachmentIds.length) preferredType = 'image'
        else if (attachmentIds.length) preferredType = 'file'
        if (!attachmentIds.length) warnings.push(`${type} fell back to text/url because Customer Care has no native attachment id`)
        this.appendButtons(textParts, step.buttons)
        continue
      }

      if (type.includes('CAROUSEL') || type.includes('TEMPLATE') || type.includes('OPTION_LIST') || type.includes('WHATSAPP_FLOW')) {
        const label = this.firstString(step.title, step.name, step.text)
        if (label) textParts.push(label)
        this.appendButtons(textParts, step.buttons ?? step.items ?? step.options)
        warnings.push(`${type} used safe text fallback; native provider payload was not sent`)
        continue
      }

      if (type === 'TYPING' || type === 'CHOOSE_CHANNEL' || type === 'GET_USER_DATA') continue
      warnings.push(`Unsupported rich-message step ${type} was ignored safely`)
    }

    const quickReplies = this.array(details.quickReplies ?? config.quickReplies)
    const labels = quickReplies
      .map((item) => this.firstString(this.record(item).label, this.record(item).text))
      .filter(Boolean)
    if (labels.length) {
      textParts.push(`Lựa chọn: ${labels.join(' · ')}`)
      warnings.push('Quick replies used text fallback; protected Zalo/Facebook transport was not modified')
    }

    const uniqueText = [...new Set(textParts.map((item) => item.trim()).filter(Boolean))].join('\n')
    return {
      messageType: preferredType,
      content: uniqueText,
      attachments: [...attachments],
      fallbackUsed: warnings.length > 0,
      warnings,
    }
  }

  private appendButtons(target: string[], value: unknown): void {
    const labels = this.array(value)
      .map((item) => {
        const record = this.record(item)
        const label = this.firstString(record.label, record.title, record.text, record.name)
        const before = this.record(record.beforeStep)
        const url = this.firstString(record.url, before.url, before.link)
        return [label, url].filter(Boolean).join(' — ')
      })
      .filter(Boolean)
    if (labels.length) target.push(labels.map((label) => `• ${label}`).join('\n'))
  }

  private messageType(value: unknown): NormalizedAutomationMessage['messageType'] {
    const type = String(value ?? '').trim().toLowerCase()
    return type === 'image' || type === 'file' || type === 'sticker' ? type : 'text'
  }

  private normalizeType(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
  }

  private numberArray(value: unknown): number[] {
    const source = Array.isArray(value) ? value : [value]
    return source.map(Number).filter((item) => Number.isInteger(item) && item > 0)
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }
}
