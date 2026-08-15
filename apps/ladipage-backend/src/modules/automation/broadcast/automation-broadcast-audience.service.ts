import { BadRequestException, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

import { BroadcastEntity } from '../entities'

type JsonRecord = Record<string, unknown>

export interface AutomationBroadcastAudienceItem {
  contactIdentityId: number | null
  conversationId: string
  channelAccountId: number
  provider: string
}

@Injectable()
export class AutomationBroadcastAudienceService {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(broadcast: BroadcastEntity, options: { allowAll?: boolean } = {}): Promise<AutomationBroadcastAudienceItem[]> {
    if (Array.isArray(broadcast.segments) && broadcast.segments.length > 0 && process.env.AUTOMATION_BROADCAST_ALLOW_UNRESOLVED_SEGMENTS !== 'true') {
      throw new BadRequestException('Broadcast segments are not mapped to Customer Care yet; refusing to broaden the audience implicitly')
    }

    const conditions = this.conditions(broadcast.conditions)
    const tagFilters = this.tagFilters(broadcast.tags)
    if (Array.isArray(broadcast.tags) && broadcast.tags.length > 0 && tagFilters.length === 0) {
      throw new BadRequestException('Broadcast tags could not be resolved safely')
    }
    const inferredProvider = this.inferProvider(broadcast.type)
    if (!conditions.length && !tagFilters.length && !inferredProvider && !options.allowAll) {
      throw new BadRequestException('Broadcast audience is empty. Add provider/tag/condition filters or explicitly set allow_all=true')
    }

    const maxAudience = this.intEnv('AUTOMATION_BROADCAST_MAX_AUDIENCE', 5000, 1, 100_000)
    const maxScanRows = this.intEnv(
      'AUTOMATION_BROADCAST_MAX_SCAN_ROWS',
      Math.max(10_000, maxAudience * 10),
      maxAudience,
      500_000,
    )
    const pageSize = Math.min(1000, Math.max(100, maxAudience + 1))
    const unique = new Map<string, AutomationBroadcastAudienceItem>()
    let scanned = 0
    let lastId: number | null = null
    let exhausted = false

    while (scanned < maxScanRows) {
      const params: unknown[] = [broadcast.tenantId, lastId, pageSize]
      let providerSql = ''
      if (inferredProvider) {
        params.push(inferredProvider)
        providerSql = ` AND conversation."provider" = $${params.length}`
      }
      const rows = await this.dataSource.query(
        `SELECT
           conversation."id" AS "sourceId",
           conversation."libredesk_conversation_uuid"::text AS "conversationId",
           conversation."channel_account_id" AS "channelAccountId",
           conversation."provider" AS "provider",
           conversation."contact_identity_id" AS "contactIdentityId",
           contact."tags" AS "tags"
         FROM "cc_conversation_link" conversation
         LEFT JOIN "cc_contact_identity" contact
           ON contact."id" = conversation."contact_identity_id"
          AND contact."tenant_id" = conversation."tenant_id"
         WHERE conversation."tenant_id" = $1
           AND ($2::integer IS NULL OR conversation."id" < $2)
           ${providerSql}
         ORDER BY conversation."id" DESC
         LIMIT $3`,
        params,
      ) as JsonRecord[]

      if (!rows.length) {
        exhausted = true
        break
      }
      scanned += rows.length

      for (const row of rows) {
        if (tagFilters.length && !tagFilters.some((tag) => this.matchesTag(row.tags, tag))) continue
        if (!conditions.every((condition) => this.matches(row, condition))) continue
        const conversationId = String(row.conversationId ?? '').trim()
        if (!conversationId || unique.has(conversationId)) continue
        unique.set(conversationId, {
          conversationId,
          channelAccountId: Number(row.channelAccountId),
          provider: String(row.provider ?? ''),
          contactIdentityId: row.contactIdentityId == null ? null : Number(row.contactIdentityId),
        })
        if (unique.size > maxAudience) {
          throw new BadRequestException(`Broadcast audience exceeds safety limit ${maxAudience}`)
        }
      }

      const sourceId = Number(rows[rows.length - 1]?.sourceId)
      if (!Number.isInteger(sourceId) || sourceId <= 0 || rows.length < pageSize) {
        exhausted = true
        break
      }
      lastId = sourceId
    }

    if (!exhausted && scanned >= maxScanRows) {
      throw new BadRequestException(
        `Broadcast audience scan exceeds safety limit ${maxScanRows}; narrow the audience filters before scheduling`,
      )
    }
    return [...unique.values()]
  }

  private conditions(value: unknown): JsonRecord[] {
    return Array.isArray(value)
      ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : []
  }

  private matches(row: JsonRecord, condition: JsonRecord): boolean {
    const field = String(condition.field ?? condition.key ?? '').toLowerCase()
    const operator = String(condition.operator ?? condition.op ?? 'eq').toLowerCase()
    const expected = condition.value
    let actual: unknown
    if (['provider', 'channel'].includes(field)) actual = row.provider
    else if (['channel_account_id', 'channelaccountid'].includes(field)) actual = row.channelAccountId
    else if (['contact_identity_id', 'contactidentityid'].includes(field)) actual = row.contactIdentityId
    else if (['conversation_id', 'conversationid'].includes(field)) actual = row.conversationId
    else if (['tag', 'tags'].includes(field)) actual = row.tags
    else return false

    if (operator === 'in' || operator === 'not_in') {
      const values = new Set((Array.isArray(expected) ? expected : [expected])
        .map((value) => String(value ?? '').trim().toLowerCase())
        .filter(Boolean))
      const matched = Array.isArray(actual)
        ? actual.some((item) => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              const tag = item as JsonRecord
              return [tag.id, tag._id, tag.name]
                .some((value) => values.has(String(value ?? '').trim().toLowerCase()))
            }
            return values.has(String(item ?? '').trim().toLowerCase())
          })
        : values.has(String(actual ?? '').trim().toLowerCase())
      return operator === 'not_in' ? !matched : matched
    }
    if (operator === 'contains') {
      if (Array.isArray(actual)) {
        const expectedText = String(expected).toLowerCase()
        return actual.some((item) => {
          if (item && typeof item === 'object') {
            const tag = item as JsonRecord
            return [tag.id, tag.name].some((value) => String(value ?? '').toLowerCase() === expectedText)
          }
          return String(item).toLowerCase() === expectedText
        })
      }
      return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
    }
    if (operator === 'neq' || operator === 'not_equals') return String(actual) !== String(expected)
    return String(actual) === String(expected)
  }

  private tagFilters(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    const result: string[] = []
    for (const item of value) {
      if (typeof item === 'string' || typeof item === 'number') {
        const text = String(item).trim().toLowerCase()
        if (text) result.push(text)
        continue
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as JsonRecord
        const text = String(record.id ?? record._id ?? record.name ?? '').trim().toLowerCase()
        if (text) result.push(text)
      }
    }
    return [...new Set(result)]
  }

  private matchesTag(value: unknown, expected: string): boolean {
    if (!Array.isArray(value)) return false
    return value.some((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as JsonRecord
        return [record.id, record._id, record.name]
          .some((candidate) => String(candidate ?? '').trim().toLowerCase() === expected)
      }
      return String(item ?? '').trim().toLowerCase() === expected
    })
  }

  private inferProvider(type: string): string | null {
    const normalized = String(type ?? '').toUpperCase()
    if (normalized.includes('ZALO')) return 'zalo_personal'
    if (normalized.includes('MESSENGER') || normalized.includes('FACEBOOK')) return 'facebook_personal'
    return null
  }

  private intEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
