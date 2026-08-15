import { Injectable } from '@nestjs/common'

export type KeywordMatchMode = 'EXACT' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH'

export interface KeywordRule {
  keywords: string[]
  mode?: KeywordMatchMode
  matchAll?: boolean
  caseSensitive?: boolean
}

@Injectable()
export class KeywordMatcherService {
  matches(input: string, rule: KeywordRule): boolean {
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : []
    const normalize = (value: string) => {
      const trimmed = String(value ?? '').trim()
      return rule.caseSensitive ? trimmed : trimmed.toLocaleLowerCase('vi')
    }
    const text = normalize(input)
    const normalizedKeywords = keywords.map(normalize).filter(Boolean)
    if (!text || normalizedKeywords.length === 0) return false

    const checks = normalizedKeywords.map((keyword) => {
      switch (rule.mode ?? 'CONTAINS') {
        case 'EXACT': return text === keyword
        case 'STARTS_WITH': return text.startsWith(keyword)
        case 'ENDS_WITH': return text.endsWith(keyword)
        case 'CONTAINS':
        default: return text.includes(keyword)
      }
    })

    return rule.matchAll ? checks.every(Boolean) : checks.some(Boolean)
  }
}
