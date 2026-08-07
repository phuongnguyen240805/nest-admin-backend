import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import { In, LessThan, LessThanOrEqual, MoreThan, Repository } from 'typeorm'

import { ClsService } from 'nestjs-cls'

import { LibreDeskClient, ZaloConnectorClient } from './customer-care.clients'
import {
  ContactPatchDto,
  ConversationPatchDto,
  ConversationQueryDto,
  CreateConversationDto,
  DraftDto,
  MessageQueryDto,
  SendMessageDto,
  SyncQueryDto,
  ZaloInboundDto,
} from './customer-care.dto'
import {
  CustomerCareChannelAccountEntity,
  CustomerCareContactIdentityEntity,
  CustomerCareConversationLinkEntity,
  CustomerCareConversationPreferenceEntity,
  CustomerCareInboundEventEntity,
  CustomerCareMessageLinkEntity,
  CustomerCareMessageReactionEntity,
  CustomerCareOutboxEventEntity,
  CustomerCareSyncEventEntity,
} from './customer-care.entities'
import { CustomerCareGateway } from './customer-care.gateway'

interface LibreDeskPage<T> {
  results: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

interface LibreDeskConversation {
  uuid: string
  updated_at: string
  waiting_since?: string | null
  contact?: {
    first_name?: string
    last_name?: string
    email?: string | null
    avatar_url?: string | null
  }
  inbox_channel?: string
  inbox_name?: string
  subject?: string | null
  last_message?: string | null
  last_message_at?: string | null
  unread_message_count?: number
  status?: string | null
  priority?: string | null
  assigned_user_id?: number | null
  assigned_team_id?: number | null
  tags?: Array<{ id?: number | string; name?: string; color?: string }>
}

interface LibreDeskMessage {
  uuid: string
  conversation_uuid: string
  created_at: string
  type: string
  status: string
  content: string
  text_content?: string
  sender_type: string
  private?: boolean
  source_id?: string | null
  attachments?: Array<{ uuid: string; name: string; content_type?: string; url?: string }>
  author?: { first_name?: string; last_name?: string; avatar_url?: string }
}

interface InboundResult {
  message_uuid?: string
  conversation_uuid: string
  duplicate?: boolean
}

@Injectable()
export class CustomerCareService {
  private readonly logger = new Logger(CustomerCareService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly cls: ClsService,
    private readonly libreDesk: LibreDeskClient,
    private readonly zalo: ZaloConnectorClient,
    private readonly gateway: CustomerCareGateway,
    @InjectRepository(CustomerCareChannelAccountEntity) private readonly channels: Repository<CustomerCareChannelAccountEntity>,
    @InjectRepository(CustomerCareContactIdentityEntity) private readonly contacts: Repository<CustomerCareContactIdentityEntity>,
    @InjectRepository(CustomerCareConversationLinkEntity) private readonly conversations: Repository<CustomerCareConversationLinkEntity>,
    @InjectRepository(CustomerCareMessageLinkEntity) private readonly messages: Repository<CustomerCareMessageLinkEntity>,
    @InjectRepository(CustomerCareConversationPreferenceEntity) private readonly preferences: Repository<CustomerCareConversationPreferenceEntity>,
    @InjectRepository(CustomerCareInboundEventEntity) private readonly inboundEvents: Repository<CustomerCareInboundEventEntity>,
    @InjectRepository(CustomerCareOutboxEventEntity) private readonly outbox: Repository<CustomerCareOutboxEventEntity>,
    @InjectRepository(CustomerCareSyncEventEntity) private readonly syncEvents: Repository<CustomerCareSyncEventEntity>,
    @InjectRepository(CustomerCareMessageReactionEntity) private readonly reactions: Repository<CustomerCareMessageReactionEntity>,
  ) {}

  private getTenantId() {
    const tenantId = this.cls.get<number>('tenantId')
    if (!tenantId) throw new BadRequestException('Tenant context is required')
    return tenantId
  }

  private async requireConversationLink(conversationId: string, tenantId = this.getTenantId()) {
    const link = await this.conversations.findOne({
      where: { tenantId, libreDeskConversationUuid: conversationId },
    })
    if (!link) throw new NotFoundException('Customer Care conversation not found')
    return link
  }

  private async ensureDefaultChannel(tenantId = this.getTenantId()) {
    const provider = 'zalo_personal'
    const externalAccountId = this.config.get<string>('CUSTOMER_CARE_ZALO_ACCOUNT_ID') || 'demo-zalo'
    let channel = await this.channels.findOne({ where: { tenantId, provider, externalAccountId } })
    if (!channel) {
      channel = this.channels.create({
        tenantId,
        provider,
        externalAccountId,
        name: this.config.get<string>('CUSTOMER_CARE_CHANNEL_NAME') || 'Zalo cá nhân',
        enabled: true,
        metadata: {},
      })
      channel = await this.channels.save(channel)
    }
    return channel
  }

  capabilities() {
    return {
      messages: {
        text: true,
        image: false,
        file: false,
        sticker: false,
        reply: true,
        forward: true,
        retry: true,
        recall: { local: true, native: false },
        reactions: { local: true, native: false },
      },
      conversations: {
        assignment: true,
        teams: true,
        tags: true,
        priority: true,
        readState: true,
        pin: true,
        mute: true,
        archive: true,
        drafts: true,
      },
      realtime: true,
      offlineCache: true,
      historyImport: false,
    }
  }

  async health() {
    const channel = await this.ensureDefaultChannel()
    const [zaloStatus, libreDeskHealth] = await Promise.allSettled([
      this.zalo.json('/status'),
      this.libreDesk.request('/conversations/all?page=1&page_size=1'),
    ])
    return {
      status: zaloStatus.status === 'fulfilled' && libreDeskHealth.status === 'fulfilled' ? 'ok' : 'degraded',
      channel,
      zalo: zaloStatus.status === 'fulfilled' ? zaloStatus.value : { error: String(zaloStatus.reason) },
      libredesk: libreDeskHealth.status === 'fulfilled' ? { connected: true } : { connected: false, error: String(libreDeskHealth.reason) },
    }
  }

  async listChannels() {
    const tenantId = this.getTenantId()
    await this.ensureDefaultChannel(tenantId)
    const rows = await this.channels.find({ where: { tenantId }, order: { id: 'ASC' } })
    const statuses = await Promise.all(rows.map(async row => {
      const status = row.provider === 'zalo_personal'
        ? await this.zalo.json<Record<string, unknown>>('/status').catch(error => ({ phase: 'error', last_error: String(error) }))
        : {}
      return this.mapChannel(row, status)
    }))
    return statuses
  }

  async getChannel(id: number) {
    const tenantId = this.getTenantId()
    const row = await this.channels.findOne({ where: { id, tenantId } })
    if (!row) throw new NotFoundException('Channel account not found')
    return row
  }

  async getChannelStatus(id: number) {
    const row = await this.getChannel(id)
    const status = await this.zalo.json<Record<string, unknown>>('/status')
    return this.mapChannel(row, status)
  }

  async resetChannel(id: number) {
    const row = await this.getChannel(id)
    const status = await this.zalo.json<Record<string, unknown>>('/session/reset', { method: 'POST' }, true)
    await this.publish(row.tenantId, 'channel.status.changed', String(row.id), { channelId: String(row.id), ...status })
    return status
  }

  async disconnectChannel(id: number) {
    const row = await this.getChannel(id)
    const status = await this.zalo.json<Record<string, unknown>>('/session', { method: 'DELETE' }, true)
    await this.publish(row.tenantId, 'channel.status.changed', String(row.id), {
      channelId: String(row.id),
      phase: 'disconnected',
      ...status,
    })
    return status
  }

  async getChannelQr(id: number) {
    await this.getChannel(id)
    return this.zalo.qr()
  }

  private mapChannel(row: CustomerCareChannelAccountEntity, status: Record<string, unknown>) {
    return {
      id: String(row.id),
      provider: row.provider,
      externalAccountId: row.externalAccountId,
      name: row.name,
      enabled: row.enabled,
      status,
    }
  }

  async listConversations(query: ConversationQueryDto, userId: number) {
    const tenantId = this.getTenantId()
    await this.ensureDefaultChannel(tenantId)
    const page = Math.max(1, Number(query.cursor || 1))
    const pageSize = Math.min(100, query.limit || 50)
    const [raw, agents] = await Promise.all([
      this.libreDesk.request<LibreDeskPage<LibreDeskConversation>>(`/conversations/all?page=${page}&page_size=${pageSize}`),
      this.getAgentsRaw().catch(() => []),
    ])
    const results = Array.isArray(raw) ? raw : raw?.results || []
    const uuids = results.map(item => item.uuid)
    const [prefs, links] = uuids.length
      ? await Promise.all([
          this.preferences.find({ where: { tenantId, userId, conversationUuid: In(uuids) } }),
          this.conversations.find({ where: { tenantId, libreDeskConversationUuid: In(uuids) } }),
        ])
      : [[], []]
    const contactIds = links.map(link => link.contactIdentityId).filter(Boolean) as number[]
    const identities = contactIds.length ? await this.contacts.find({ where: { tenantId, id: In(contactIds) } }) : []
    const prefMap = new Map(prefs.map(item => [item.conversationUuid, item]))
    const linkMap = new Map(links.map(item => [item.libreDeskConversationUuid, item]))
    const contactMap = new Map(identities.map(item => [item.id, item]))
    const agentMap = new Map((agents as any[]).map(agent => [Number(agent.id), {
      id: String(agent.id),
      name: fullName(agent.first_name, agent.last_name),
      avatar: agent.avatar_url || undefined,
    }]))
    let items = results
      .filter(item => linkMap.has(item.uuid))
      .map(item => this.mapConversation(
        item,
        agentMap,
        prefMap.get(item.uuid),
        linkMap.get(item.uuid)?.contactIdentityId ? contactMap.get(linkMap.get(item.uuid)!.contactIdentityId!) : undefined,
        linkMap.get(item.uuid),
      ))
    const search = (query.search || '').trim().toLocaleLowerCase('vi')
    if (search) items = items.filter(item => `${item.customer.name} ${item.lastMessage} ${item.customer.phone || ''}`.toLocaleLowerCase('vi').includes(search))
    if (query.status) items = items.filter(item => item.status === query.status)
    if (query.channel) items = items.filter(item => item.channel === query.channel)
    if (query.assigneeId) items = items.filter(item => item.assignee?.id === query.assigneeId)
    if (query.tagId) items = items.filter(item => item.tags?.some((tag: any) => tag.id === query.tagId))
    items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    return {
      items,
      nextCursor: raw?.total_pages && page < raw.total_pages ? String(page + 1) : undefined,
      total: await this.conversations.count({ where: { tenantId } }),
    }
  }

  async getConversation(conversationId: string, userId: number) {
    const tenantId = this.getTenantId()
    const link = await this.requireConversationLink(conversationId, tenantId)
    const raw = await this.libreDesk.request<LibreDeskConversation>(`/conversations/${encodeURIComponent(conversationId)}`)
    const pref = await this.preferences.findOne({ where: { tenantId, userId, conversationUuid: conversationId } })
    const identity = link?.contactIdentityId ? await this.contacts.findOne({ where: { tenantId, id: link.contactIdentityId } }) : null
    const agents = await this.getAgentsRaw().catch(() => [])
    const agentMap = new Map((agents as any[]).map(agent => [Number(agent.id), { id: String(agent.id), name: fullName(agent.first_name, agent.last_name), avatar: agent.avatar_url || undefined }]))
    return this.mapConversation(raw, agentMap, pref || undefined, identity || undefined, link)
  }

  async createConversation(dto: CreateConversationDto) {
    const tenantId = this.getTenantId()
    const channel = await this.ensureDefaultChannel(tenantId)
    const existing = await this.conversations.findOne({ where: { tenantId, provider: channel.provider, externalThreadId: dto.externalThreadId } })
    if (existing) return this.getConversation(existing.libreDeskConversationUuid, 0)
    const inbound: ZaloInboundDto = {
      tenant_id: tenantId,
      event_id: `manual:${randomUUID()}`,
      provider: channel.provider,
      account_id: channel.externalAccountId,
      external_thread_id: dto.externalThreadId,
      external_message_id: `manual:${randomUUID()}`,
      thread_type: dto.threadType,
      occurred_at: new Date().toISOString(),
      sender: { external_id: dto.externalContactId, display_name: dto.displayName, avatar_url: dto.avatarUrl },
      message: { type: 'text', text: dto.initialMessage || 'Bắt đầu hội thoại' },
    }
    const result = await this.processInbound(inbound, tenantId)
    return { id: result.conversation_uuid, created: true }
  }

  async patchConversation(conversationId: string, dto: ConversationPatchDto, userId: number) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    if (dto.status) await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/status`, { method: 'PUT', body: JSON.stringify({ status: dto.status }) })
    if (dto.priority) await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/priority`, { method: 'PUT', body: JSON.stringify({ priority: dto.priority }) })
    if ([dto.pinned, dto.muted, dto.archived].some(value => value !== undefined)) {
      let pref = await this.preferences.findOne({ where: { tenantId, userId, conversationUuid: conversationId } })
      pref ||= this.preferences.create({ tenantId, userId, conversationUuid: conversationId, pinned: false, muted: false, archived: false, draftContent: null, draftAttachments: [] })
      if (dto.pinned !== undefined) pref.pinned = dto.pinned
      if (dto.muted !== undefined) pref.muted = dto.muted
      if (dto.archived !== undefined) pref.archived = dto.archived
      await this.preferences.save(pref)
    }
    const event = await this.publish(tenantId, 'conversation.updated', conversationId, { conversationId, ...dto })
    return { conversationId, ...dto, sequence: event.sequence }
  }

  async markRead(conversationId: string) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/last-seen`, { method: 'PUT', body: '{}' })
    await this.publish(tenantId, 'conversation.read.updated', conversationId, { conversationId, unread: false })
    return { conversationId, unread: false }
  }

  async markUnread(conversationId: string) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/mark-unread`, { method: 'PUT', body: '{}' })
    await this.publish(tenantId, 'conversation.read.updated', conversationId, { conversationId, unread: true })
    return { conversationId, unread: true }
  }

  async setAssignee(conversationId: string, assigneeId: number | null) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    const path = assigneeId == null ? 'assignee/user/remove' : 'assignee/user'
    await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/${path}`, { method: 'PUT', body: JSON.stringify(assigneeId == null ? {} : { assignee_id: assigneeId }) })
    await this.publish(tenantId, 'conversation.updated', conversationId, { conversationId, assigneeId })
    return { conversationId, assigneeId }
  }

  async setTeam(conversationId: string, teamId: number | null) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    const path = teamId == null ? 'assignee/team/remove' : 'assignee/team'
    await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/${path}`, { method: 'PUT', body: JSON.stringify(teamId == null ? {} : { assignee_id: teamId }) })
    await this.publish(tenantId, 'conversation.updated', conversationId, { conversationId, teamId })
    return { conversationId, teamId }
  }

  async setTags(conversationId: string, tags: Array<string | number>, action = 'set') {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)

    // LibreDesk mutates conversation tags by tag name, while the public Nest
    // contract accepts either stable IDs or names. Resolve IDs here so the FE
    // never needs provider-specific knowledge.
    const available = await this.libreDesk.request<Array<{ id: number; name: string }>>('/tags')
    const namesById = new Map(available.map(tag => [String(tag.id), tag.name]))
    const tagNames = [...new Set(tags.map(tag => namesById.get(String(tag)) || String(tag).trim()).filter(Boolean))]
    if (!tagNames.length) throw new BadRequestException('At least one valid tag is required')

    const result = await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags: tagNames, action }),
    })
    await this.publish(tenantId, 'conversation.updated', conversationId, {
      conversationId,
      tags: tagNames,
      tagAction: action,
    })
    return result
  }

  async participants(conversationId: string) {
    await this.requireConversationLink(conversationId)
    return this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/participants`)
  }

  async previousConversations(conversationId: string, userId: number) {
    const tenantId = this.getTenantId()
    const link = await this.requireConversationLink(conversationId, tenantId)
    if (!link.contactIdentityId) return []
    const links = await this.conversations.find({ where: { tenantId, contactIdentityId: link.contactIdentityId }, order: { lastMessageAt: 'DESC' }, take: 20 })
    const all = await this.listConversations({ limit: 100 } as ConversationQueryDto, userId)
    return all.items.filter((item: any) => links.some(row => row.libreDeskConversationUuid === item.id) && item.id !== conversationId)
  }

  async getDraft(conversationId: string, userId: number) {
    await this.requireConversationLink(conversationId)
    const pref = await this.preferences.findOne({ where: { tenantId: this.getTenantId(), userId, conversationUuid: conversationId } })
    return { conversationId, content: pref?.draftContent || '', attachments: pref?.draftAttachments || [] }
  }

  async saveDraft(conversationId: string, userId: number, dto: DraftDto) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    let pref = await this.preferences.findOne({ where: { tenantId, userId, conversationUuid: conversationId } })
    pref ||= this.preferences.create({ tenantId, userId, conversationUuid: conversationId, pinned: false, muted: false, archived: false, draftContent: null, draftAttachments: [] })
    pref.draftContent = dto.content
    pref.draftAttachments = dto.attachments || []
    await this.preferences.save(pref)
    return { conversationId, content: pref.draftContent, attachments: pref.draftAttachments }
  }

  async deleteDraft(conversationId: string, userId: number) {
    await this.requireConversationLink(conversationId)
    await this.preferences.update({ tenantId: this.getTenantId(), userId, conversationUuid: conversationId }, { draftContent: null, draftAttachments: [] })
    return { conversationId, deleted: true }
  }

  async listMessages(conversationId: string, query: MessageQueryDto, userId: number) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    const page = Math.max(1, Number(query.cursor || 1))
    const limit = Math.min(200, query.limit || 100)
    const raw = await this.libreDesk.request<LibreDeskPage<LibreDeskMessage>>(`/conversations/${encodeURIComponent(conversationId)}/messages?page=${page}&page_size=${limit}&private=false&type=incoming&type=outgoing`)
    const rows = Array.isArray(raw) ? raw : raw?.results || []
    const messageUuids = rows.map(row => row.uuid)
    const [reactionRows, messageLinks] = messageUuids.length
      ? await Promise.all([
          this.reactions.find({ where: { tenantId, messageUuid: In(messageUuids) } }),
          this.messages.find({ where: { tenantId, libreDeskMessageUuid: In(messageUuids) } }),
        ])
      : [[], []]
    const linkMap = new Map(messageLinks.map(link => [link.libreDeskMessageUuid, link]))
    const reactionMap = new Map<string, Record<string, { count: number; reactedByMe: boolean }>>()
    for (const reaction of reactionRows) {
      const current = reactionMap.get(reaction.messageUuid) || {}
      const value = current[reaction.emoji] || { count: 0, reactedByMe: false }
      value.count += 1
      if (reaction.userId === userId) value.reactedByMe = true
      current[reaction.emoji] = value
      reactionMap.set(reaction.messageUuid, current)
    }
    const items = rows.map(row => this.mapMessage(row, reactionMap.get(row.uuid), linkMap.get(row.uuid)))
    return { items, nextCursor: raw?.total_pages && page < raw.total_pages ? String(page + 1) : undefined }
  }

  async getMessage(conversationId: string, messageId: string, tenantOverride?: number, userId = 0) {
    const tenantId = tenantOverride || this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    const row = await this.libreDesk.request<LibreDeskMessage>(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`)
    const [link, reactionRows] = await Promise.all([
      this.messages.findOne({ where: { tenantId, libreDeskMessageUuid: row.uuid } }),
      this.reactions.find({ where: { tenantId, messageUuid: row.uuid } }),
    ])
    const reactions: Record<string, { count: number; reactedByMe: boolean }> = {}
    for (const reaction of reactionRows) {
      const value = reactions[reaction.emoji] || { count: 0, reactedByMe: false }
      value.count += 1
      if (reaction.userId === userId) value.reactedByMe = true
      reactions[reaction.emoji] = value
    }
    return this.mapMessage(row, reactions, link || undefined)
  }

  async sendMessage(conversationId: string, dto: SendMessageDto, userId: number, fromOutbox = false, tenantOverride?: number) {
    const tenantId = tenantOverride || this.getTenantId()
    if (dto.type !== 'text') throw new BadRequestException('The connected Zalo provider currently supports text messages only')

    const conversationLink = await this.requireConversationLink(conversationId, tenantId)
    let messageLink = await this.messages.findOne({ where: { tenantId, clientMessageId: dto.clientMessageId } })
    if (messageLink?.libreDeskMessageUuid) return this.getMessage(conversationId, messageLink.libreDeskMessageUuid, tenantId)
    if (messageLink?.status === 'sending' && !fromOutbox) {
      return this.pendingMessage(conversationId, dto, messageLink.status)
    }

    if (!messageLink) {
      try {
        messageLink = await this.messages.save(this.messages.create({
          tenantId,
          conversationLinkId: conversationLink.id,
          provider: conversationLink.provider,
          externalMessageId: null,
          clientMessageId: dto.clientMessageId,
          libreDeskMessageUuid: null,
          status: 'sending',
          metadata: { userId, replyToMessageId: dto.replyToMessageId || null, content: dto.content },
        }))
      } catch {
        messageLink = await this.messages.findOne({ where: { tenantId, clientMessageId: dto.clientMessageId } })
        if (!messageLink) throw new ConflictException('A message with this idempotency key is already being processed')
        if (messageLink.libreDeskMessageUuid) return this.getMessage(conversationId, messageLink.libreDeskMessageUuid, tenantId)
        if (!fromOutbox) return this.pendingMessage(conversationId, dto, messageLink.status)
      }
    } else {
      messageLink.status = 'sending'
      messageLink.metadata = { ...(messageLink.metadata || {}), userId, replyToMessageId: dto.replyToMessageId || null, content: dto.content }
      await this.messages.save(messageLink)
    }

    try {
      const raw = await this.libreDesk.request<LibreDeskMessage>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          attachments: dto.attachments || [],
          message: dto.content,
          private: false,
          to: [], cc: [], bcc: [],
          sender_type: 'agent',
          mentions: [],
          echo_id: dto.clientMessageId,
        }),
      })
      messageLink.libreDeskMessageUuid = raw.uuid
      messageLink.status = raw.status || 'sent'
      await this.messages.save(messageLink)
      const message = this.mapMessage(raw, undefined, messageLink)
      await this.publish(tenantId, 'message.created', conversationId, { conversationId, message })
      return message
    } catch (error) {
      messageLink.status = 'failed'
      messageLink.metadata = { ...(messageLink.metadata || {}), lastError: error instanceof Error ? error.message : String(error) }
      await this.messages.save(messageLink).catch(() => undefined)
      if (!fromOutbox) {
        const existingOutbox = await this.outbox.findOne({ where: { tenantId, type: 'message.send', aggregateId: dto.clientMessageId } })
        if (!existingOutbox) await this.outbox.save(this.outbox.create({
          tenantId,
          type: 'message.send',
          aggregateId: dto.clientMessageId,
          payload: { conversationId, dto, userId },
          status: 'pending',
          attemptCount: 0,
          nextRetryAt: new Date(Date.now() + 5_000),
          lastError: error instanceof Error ? error.message : String(error),
        })).catch(async () => {
          const row = await this.outbox.findOne({ where: { tenantId, type: 'message.send', aggregateId: dto.clientMessageId } })
          if (row) {
            row.status = 'pending'
            row.nextRetryAt = new Date(Date.now() + 5_000)
            row.lastError = error instanceof Error ? error.message : String(error)
            await this.outbox.save(row)
          }
        })
      }
      throw error
    }
  }

  private pendingMessage(conversationId: string, dto: SendMessageDto, status = 'sending') {
    return {
      id: `pending:${dto.clientMessageId}`,
      clientMessageId: dto.clientMessageId,
      conversationId,
      direction: 'outgoing',
      type: dto.type || 'text',
      content: dto.content,
      createdAt: new Date().toISOString(),
      sender: { name: 'Bạn' },
      senderName: 'Bạn',
      status: status === 'failed' ? 'failed' : 'sending',
      replyTo: dto.replyToMessageId ? { id: dto.replyToMessageId, content: 'Tin nhắn được trả lời' } : undefined,
      attachments: [],
      reactions: [],
    }
  }

  async retryMessage(conversationId: string, messageId: string) {
    await this.requireConversationLink(conversationId)
    return this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/retry`, { method: 'PUT', body: '{}' })
  }

  async recallMessage(conversationId: string, messageId: string) {
    const tenantId = this.getTenantId()
    await this.requireConversationLink(conversationId, tenantId)
    await this.libreDesk.request(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
    await this.publish(tenantId, 'message.recalled', conversationId, { conversationId, messageId, native: false })
    return { conversationId, messageId, recalled: true, native: false }
  }

  async forwardMessage(sourceConversationId: string, messageId: string, targetConversationId: string, content: string | undefined, userId: number) {
    const source = await this.getMessage(sourceConversationId, messageId)
    return this.sendMessage(targetConversationId, {
      clientMessageId: randomUUID(),
      type: 'text',
      content: content || source.content,
    }, userId)
  }

  async addReaction(conversationId: string, messageId: string, emoji: string, userId: number) {
    const tenantId = this.getTenantId()
    await this.getMessage(conversationId, messageId, tenantId, userId)
    const existing = await this.reactions.findOne({ where: { tenantId, messageUuid: messageId, userId, emoji } })
    if (!existing) await this.reactions.save(this.reactions.create({ tenantId, messageUuid: messageId, userId, emoji }))
    await this.publish(tenantId, 'message.updated', conversationId, { conversationId, messageId, reaction: { emoji, action: 'add', userId }, native: false })
    return { messageId, emoji, added: true, native: false }
  }

  async removeReaction(conversationId: string, messageId: string, emoji: string, userId: number) {
    const tenantId = this.getTenantId()
    await this.getMessage(conversationId, messageId, tenantId, userId)
    await this.reactions.delete({ tenantId, messageUuid: messageId, userId, emoji })
    await this.publish(tenantId, 'message.updated', conversationId, { conversationId, messageId, reaction: { emoji, action: 'remove', userId }, native: false })
    return { messageId, emoji, removed: true, native: false }
  }

  async getContact(id: number) {
    const row = await this.contacts.findOne({ where: { id, tenantId: this.getTenantId() } })
    if (!row) throw new NotFoundException('Contact identity not found')
    return this.mapContact(row)
  }

  async patchContact(id: number, dto: ContactPatchDto) {
    const tenantId = this.getTenantId()
    const row = await this.contacts.findOne({ where: { id, tenantId } })
    if (!row) throw new NotFoundException('Contact identity not found')
    Object.assign(row, dto)
    await this.contacts.save(row)
    await this.publish(tenantId, 'contact.updated', String(id), { contact: this.mapContact(row) })
    return this.mapContact(row)
  }

  async contactConversations(id: number, userId: number) {
    const tenantId = this.getTenantId()
    const links = await this.conversations.find({ where: { tenantId, contactIdentityId: id }, order: { lastMessageAt: 'DESC' } })
    const page = await this.listConversations({ limit: 100 } as ConversationQueryDto, userId)
    return page.items.filter((item: any) => links.some(link => link.libreDeskConversationUuid === item.id))
  }

  async contactOrders(id: number) {
    const contact = await this.getContact(id)
    return { items: [], contact, connected: false, message: 'CRM order linking is available after this Zalo identity is linked to a CRM customer.' }
  }

  async getAgentsRaw() {
    const value = await this.libreDesk.request<any>('/agents/compact')
    return Array.isArray(value) ? value : value?.results || []
  }

  async agents() {
    return this.getAgentsRaw()
  }

  teams() {
    return this.libreDesk.request('/teams')
  }

  tags() {
    return this.libreDesk.request('/tags')
  }

  async sync(query: SyncQueryDto) {
    const tenantId = this.getTenantId()
    const limit = Math.min(1000, query.limit || 500)
    const [earliest, latest] = await Promise.all([
      this.syncEvents.findOne({ where: { tenantId }, order: { sequence: 'ASC' } }),
      this.syncEvents.findOne({ where: { tenantId }, order: { sequence: 'DESC' } }),
    ])
    const afterSequence = query.afterSequence || 0
    if (afterSequence > 0 && earliest && afterSequence < earliest.sequence - 1) {
      return {
        events: [],
        cursor: latest?.sequence || 0,
        hasMore: false,
        resetRequired: true,
        serverTime: new Date().toISOString(),
      }
    }
    const rows = await this.syncEvents.find({
      where: { tenantId, sequence: MoreThan(afterSequence) },
      order: { sequence: 'ASC' },
      take: limit + 1,
    })
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    return {
      events: page.map(row => ({
        eventId: row.eventId,
        sequence: row.sequence,
        type: row.type,
        aggregateId: row.aggregateId,
        occurredAt: row.createdAt.toISOString(),
        data: row.payload,
      })),
      cursor: page.at(-1)?.sequence || afterSequence,
      hasMore,
      resetRequired: false,
      serverTime: new Date().toISOString(),
    }
  }

  verifyWebhook(rawBody: string, timestamp: string, signature: string) {
    const secret = this.config.get<string>('CUSTOMER_CARE_WEBHOOK_SECRET') || ''
    if (!secret) throw new ServiceUnavailableException('Customer Care webhook secret is not configured')
    const ts = Number(timestamp)
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) throw new BadRequestException('Expired webhook timestamp')
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    const left = Buffer.from(expected)
    const right = Buffer.from(signature || '')
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new BadRequestException('Invalid webhook signature')
  }

  async inbound(dto: ZaloInboundDto) {
    let channel = await this.channels.findOne({
      where: { tenantId: dto.tenant_id, provider: dto.provider, externalAccountId: dto.account_id, enabled: true },
    })
    if (!channel) {
      const configuredTenantId = Number(this.config.get<string>('CUSTOMER_CARE_DEFAULT_TENANT_ID') || 0)
      const configuredAccountId = this.config.get<string>('CUSTOMER_CARE_ZALO_ACCOUNT_ID') || 'demo-zalo'
      if (dto.tenant_id !== configuredTenantId || dto.account_id !== configuredAccountId) {
        throw new NotFoundException('No tenant channel account is registered for this Zalo account')
      }
      channel = await this.ensureDefaultChannel(dto.tenant_id)
    }
    return this.processInbound(dto, channel.tenantId, channel)
  }

  private async processInbound(dto: ZaloInboundDto, tenantId: number, channel?: CustomerCareChannelAccountEntity) {
    channel ||= await this.channels.findOne({ where: { tenantId, provider: dto.provider, externalAccountId: dto.account_id } }) || await this.ensureDefaultChannel(tenantId)
    const duplicate = await this.inboundEvents.findOne({ where: { tenantId, provider: dto.provider, eventId: dto.event_id } })
    if (duplicate?.status === 'processed') {
      const data = duplicate.payload?.result as unknown as InboundResult
      if (data?.conversation_uuid) return { ...data, duplicate: true }
      throw new ConflictException('Inbound event already processed')
    }
    let event = duplicate || this.inboundEvents.create({ tenantId, provider: dto.provider, eventId: dto.event_id, status: 'received', payload: dto as unknown as Record<string, unknown>, lastError: null, processedAt: null })
    event = await this.inboundEvents.save(event)
    try {
      let contact = await this.contacts.findOne({ where: { tenantId, provider: dto.provider, externalId: dto.sender.external_id } })
      if (!contact) contact = this.contacts.create({
        tenantId,
        provider: dto.provider,
        externalId: dto.sender.external_id,
        displayName: dto.sender.display_name || `Khách Zalo ${dto.sender.external_id}`,
        avatarUrl: dto.sender.avatar_url || null,
        phone: null,
        email: null,
        note: null,
        crmCustomerId: null,
        tags: [],
        metadata: {},
      })
      else {
        if (dto.sender.display_name) contact.displayName = dto.sender.display_name
        if (dto.sender.avatar_url) contact.avatarUrl = dto.sender.avatar_url
      }
      contact = await this.contacts.save(contact)
      let link = await this.conversations.findOne({ where: { tenantId, provider: dto.provider, externalThreadId: dto.external_thread_id } })
      const isNewConversation = !link
      const result = await this.libreDesk.inbound<InboundResult>({
        account_id: dto.account_id,
        external_thread_id: dto.external_thread_id,
        external_message_id: dto.external_message_id,
        conversation_uuid: link?.libreDeskConversationUuid || '',
        thread_type: dto.thread_type,
        occurred_at: dto.occurred_at,
        sender: dto.sender,
        message: dto.message,
      })
      if (!link) link = this.conversations.create({
        tenantId,
        channelAccountId: channel.id,
        contactIdentityId: contact.id,
        provider: dto.provider,
        externalThreadId: dto.external_thread_id,
        threadType: dto.thread_type,
        libreDeskConversationUuid: result.conversation_uuid,
        lastExternalMessageId: dto.external_message_id,
        lastMessageAt: new Date(dto.occurred_at),
        metadata: {},
      })
      else {
        link.contactIdentityId = contact.id
        link.lastExternalMessageId = dto.external_message_id
        link.lastMessageAt = new Date(dto.occurred_at)
      }
      link = await this.conversations.save(link)
      const existingMessage = await this.messages.findOne({ where: { tenantId, provider: dto.provider, externalMessageId: dto.external_message_id } })
      if (!existingMessage) await this.messages.save(this.messages.create({
        tenantId,
        conversationLinkId: link.id,
        provider: dto.provider,
        externalMessageId: dto.external_message_id,
        clientMessageId: null,
        libreDeskMessageUuid: result.message_uuid || null,
        status: 'delivered',
        metadata: {},
      }))
      event.status = 'processed'
      event.processedAt = new Date()
      event.payload = { ...(dto as unknown as Record<string, unknown>), result }
      event.lastError = null
      await this.inboundEvents.save(event)
      const message = {
        id: result.message_uuid || dto.external_message_id,
        conversationId: result.conversation_uuid,
        externalMessageId: dto.external_message_id,
        direction: 'incoming',
        type: dto.message.type || 'text',
        content: dto.message.text,
        createdAt: dto.occurred_at,
        sender: { id: String(contact.id), externalId: contact.externalId, name: contact.displayName, avatar: contact.avatarUrl || undefined },
        senderName: contact.displayName,
        senderAvatar: contact.avatarUrl || undefined,
        status: 'delivered',
        attachments: [],
        reactions: [],
      }
      await this.publish(tenantId, isNewConversation ? 'conversation.created' : 'message.created', result.conversation_uuid, {
        conversationId: result.conversation_uuid,
        message,
        contact: this.mapContact(contact),
      })
      return result
    } catch (error) {
      event.status = 'failed'
      event.lastError = error instanceof Error ? error.message : String(error)
      await this.inboundEvents.save(event)
      throw error
    }
  }

  @Interval(10_000)
  async flushOutbox() {
    const rows = await this.outbox.find({ where: { status: In(['pending', 'retrying']), nextRetryAt: LessThanOrEqual(new Date()) }, order: { id: 'ASC' }, take: 20 })
    for (const row of rows) {
      row.status = 'retrying'
      row.attemptCount += 1
      await this.outbox.save(row)
      try {
        if (row.type === 'message.send') {
          const { conversationId, dto, userId } = row.payload as any
          await this.sendMessage(conversationId, dto, userId, true, row.tenantId)
        }
        row.status = 'completed'
        row.lastError = null
      } catch (error) {
        row.status = row.attemptCount >= 10 ? 'dead' : 'pending'
        row.lastError = error instanceof Error ? error.message : String(error)
        row.nextRetryAt = new Date(Date.now() + Math.min(300_000, 2 ** row.attemptCount * 1000))
      }
      await this.outbox.save(row)
    }
  }

  private async publish(tenantId: number, type: string, aggregateId: string | null, payload: Record<string, unknown>) {
    const event = await this.syncEvents.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [tenantId])
      const raw = await manager
        .getRepository(CustomerCareSyncEventEntity)
        .createQueryBuilder('event')
        .select('COALESCE(MAX(event.sequence), 0)', 'max')
        .where('event.tenant_id = :tenantId', { tenantId })
        .getRawOne<{ max: string | number }>()
      const sequence = Number(raw?.max || 0) + 1
      return manager.getRepository(CustomerCareSyncEventEntity).save(
        manager.getRepository(CustomerCareSyncEventEntity).create({
          tenantId,
          sequence,
          eventId: randomUUID(),
          type,
          aggregateId,
          payload,
        }),
      )
    })
    const envelope = { eventId: event.eventId, sequence: event.sequence, type, aggregateId, occurredAt: event.createdAt.toISOString(), data: payload }
    if (aggregateId && (type.startsWith('message.') || type.startsWith('conversation.') || type.startsWith('typing.'))) this.gateway.emitConversation(tenantId, aggregateId, type, envelope)
    else this.gateway.emitTenant(tenantId, type, envelope)
    return event
  }

  @Interval(6 * 60 * 60_000)
  async cleanupOperationalEvents() {
    const now = Date.now()
    const syncCutoff = new Date(now - 30 * 24 * 60 * 60_000)
    const auditCutoff = new Date(now - 45 * 24 * 60 * 60_000)
    const outboxCutoff = new Date(now - 14 * 24 * 60 * 60_000)
    await Promise.all([
      this.syncEvents.delete({ createdAt: LessThan(syncCutoff) }),
      this.inboundEvents.delete({ createdAt: LessThan(auditCutoff), status: 'processed' }),
      this.outbox.delete({ createdAt: LessThan(outboxCutoff), status: In(['completed', 'dead']) }),
    ]).catch(error => this.logger.warn(`Customer Care cleanup failed: ${error instanceof Error ? error.message : String(error)}`))
  }

  private mapConversation(
    item: LibreDeskConversation,
    agents: Map<number, any>,
    preference?: CustomerCareConversationPreferenceEntity,
    identity?: CustomerCareContactIdentityEntity,
    link?: CustomerCareConversationLinkEntity,
  ) {
    const assigned = item.assigned_user_id ? agents.get(Number(item.assigned_user_id)) : undefined
    const customerName = identity?.displayName || fullName(item.contact?.first_name, item.contact?.last_name)
    const channel = mapChannel(item.inbox_channel || link?.provider || 'website')
    return {
      id: item.uuid,
      externalThreadId: link?.externalThreadId,
      threadType: link?.threadType || 'user',
      customer: identity ? this.mapContact(identity) : {
        id: `libredesk:${item.uuid}`,
        externalId: undefined,
        provider: link?.provider || item.inbox_channel || undefined,
        name: customerName,
        avatar: item.contact?.avatar_url || undefined,
        phone: undefined,
        email: item.contact?.email || undefined,
        note: undefined,
        crmCustomerId: undefined,
        totalOrders: 0,
        totalSpent: 0,
        tags: [],
        assignee: assigned,
      },
      channel,
      channelName: item.inbox_name || (channel === 'zalo' ? 'Zalo cá nhân' : channel),
      status: mapConversationStatus(item.status, item.unread_message_count || 0),
      priority: item.priority || 'normal',
      lastMessage: stripHtml(item.last_message) || item.subject || 'Chưa có tin nhắn',
      lastMessageAt: item.last_message_at || item.updated_at,
      unreadCount: item.unread_message_count || 0,
      waitingSince: item.waiting_since || undefined,
      tags: (item.tags || []).map(tag => ({ id: String(tag.id ?? tag.name), name: tag.name || String(tag.id), color: tag.color || '#84cc16' })),
      assignee: assigned,
      teamId: item.assigned_team_id ? String(item.assigned_team_id) : undefined,
      pinned: preference?.pinned || false,
      muted: preference?.muted || false,
      archived: preference?.archived || false,
      updatedAt: item.updated_at,
    }
  }

  private mapMessage(item: LibreDeskMessage, reactions?: Record<string, { count: number; reactedByMe: boolean }>, link?: CustomerCareMessageLinkEntity) {
    const incoming = normalize(item.type) === 'incoming' || normalize(item.sender_type) === 'contact'
    const senderName = fullName(item.author?.first_name, item.author?.last_name)
    return {
      id: item.uuid,
      conversationId: item.conversation_uuid,
      clientMessageId: link?.clientMessageId || undefined,
      externalMessageId: link?.externalMessageId || item.source_id || undefined,
      direction: incoming ? 'incoming' : 'outgoing',
      type: item.attachments?.some(row => row.content_type?.startsWith('image/')) ? 'image' : item.attachments?.length ? 'file' : 'text',
      content: stripHtml(item.text_content || item.content),
      createdAt: item.created_at,
      sender: { name: senderName === 'Khách hàng' && !incoming ? 'Nhân viên' : senderName, avatar: item.author?.avatar_url || undefined },
      senderName: senderName === 'Khách hàng' && !incoming ? 'Nhân viên' : senderName,
      senderAvatar: item.author?.avatar_url || undefined,
      status: mapMessageStatus(item.status, incoming),
      attachments: (item.attachments || []).map(attachment => ({
        id: attachment.uuid,
        name: attachment.name,
        type: attachment.content_type?.startsWith('image/') ? 'image' : 'file',
        mimeType: attachment.content_type,
        url: attachment.url,
      })),
      replyTo: typeof link?.metadata?.replyToMessageId === 'string' && link.metadata.replyToMessageId
        ? { id: link.metadata.replyToMessageId, content: 'Tin nhắn được trả lời' }
        : undefined,
      reactions: Object.entries(reactions || {}).map(([emoji, value]) => ({
        emoji,
        count: value.count,
        reactedByMe: value.reactedByMe,
      })),
      recalled: false,
    }
  }

  private mapContact(row: CustomerCareContactIdentityEntity) {
    return {
      id: String(row.id),
      externalId: row.externalId,
      provider: row.provider,
      name: row.displayName,
      avatar: row.avatarUrl || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      note: row.note || undefined,
      crmCustomerId: row.crmCustomerId || undefined,
      totalOrders: 0,
      totalSpent: 0,
      tags: (row.tags || []).map(tag => ({
        id: String(tag.id),
        name: tag.name,
        color: tag.color || '#84cc16',
      })),
    }
  }
}

function normalize(value?: string | null) {
  return (value || '').trim().toLocaleLowerCase('en').replace(/[\s-]+/g, '_')
}

function mapChannel(value: string) {
  const key = normalize(value)
  if (key.includes('zalo')) return 'zalo'
  if (key.includes('facebook')) return 'facebook'
  if (key.includes('instagram')) return 'instagram'
  if (key.includes('whatsapp')) return 'whatsapp'
  if (key.includes('tiktok')) return 'tiktok'
  return 'website'
}

function mapConversationStatus(value: string | null | undefined, unreadCount: number) {
  if (unreadCount > 0) return 'unread'
  const key = normalize(value)
  if (key === 'resolved' || key === 'closed') return 'resolved'
  if (['pending', 'snoozed', 'waiting'].includes(key)) return 'pending'
  return 'open'
}

function mapMessageStatus(value: string, incoming: boolean) {
  if (incoming) return 'delivered'
  const key = normalize(value)
  if (key === 'failed') return 'failed'
  if (['pending', 'queued', 'processing'].includes(key)) return 'sending'
  if (key === 'read') return 'read'
  if (key === 'delivered') return 'delivered'
  return 'sent'
}

function fullName(firstName?: string, lastName?: string) {
  return `${firstName || ''} ${lastName || ''}`.trim() || 'Khách hàng'
}

function stripHtml(value?: string | null) {
  return (value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
