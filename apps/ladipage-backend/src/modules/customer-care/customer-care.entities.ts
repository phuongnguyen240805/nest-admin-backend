import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

abstract class CustomerCareTenantEntity {
  @PrimaryGeneratedColumn()
  id!: number

  @Index()
  @Column({ name: 'tenant_id', type: 'int' })
  tenantId!: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity({ name: 'cc_channel_account' })
@Index(['tenantId', 'provider', 'externalAccountId'], { unique: true })
export class CustomerCareChannelAccountEntity extends CustomerCareTenantEntity {
  @Index({ unique: true })
  @Column({ name: 'connection_key', type: 'uuid', default: () => 'gen_random_uuid()' })
  connectionKey!: string

  @Column({ type: 'varchar', length: 40, default: 'zalo_personal' })
  provider!: string

  @Column({ name: 'external_account_id', type: 'varchar', length: 160 })
  externalAccountId!: string

  @Column({ type: 'varchar', length: 255, default: 'Zalo cá nhân' })
  name!: string

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>
}

@Entity({ name: 'cc_contact_identity' })
@Index(['tenantId', 'channelAccountId', 'provider', 'externalId'], { unique: true })
export class CustomerCareContactIdentityEntity extends CustomerCareTenantEntity {
  @Column({ name: 'channel_account_id', type: 'int', nullable: true })
  channelAccountId!: number | null

  @Column({ type: 'varchar', length: 40 })
  provider!: string

  @Column({ name: 'external_id', type: 'varchar', length: 200 })
  externalId!: string

  @Column({ name: 'display_name', type: 'varchar', length: 255, default: '' })
  displayName!: string

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null

  @Column({ type: 'text', nullable: true })
  note!: string | null

  @Column({ name: 'crm_customer_id', type: 'int', nullable: true })
  crmCustomerId!: number | null

  @Column({ name: 'crm_person_id', type: 'uuid', nullable: true })
  crmPersonId!: string | null

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags!: Array<{ id: string; name: string; color?: string }>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>
}

@Entity({ name: 'cc_conversation_link' })
@Index(['tenantId', 'channelAccountId', 'provider', 'externalThreadId'], { unique: true })
@Index(['tenantId', 'libreDeskConversationUuid'], { unique: true })
export class CustomerCareConversationLinkEntity extends CustomerCareTenantEntity {
  @Column({ name: 'channel_account_id', type: 'int' })
  channelAccountId!: number

  @Column({ name: 'contact_identity_id', type: 'int', nullable: true })
  contactIdentityId!: number | null

  @Column({ type: 'varchar', length: 40 })
  provider!: string

  @Column({ name: 'external_thread_id', type: 'varchar', length: 220 })
  externalThreadId!: string

  @Column({ name: 'thread_type', type: 'varchar', length: 20, default: 'user' })
  threadType!: string

  @Column({ name: 'libredesk_conversation_uuid', type: 'uuid' })
  libreDeskConversationUuid!: string

  @Column({ name: 'last_external_message_id', type: 'varchar', length: 220, nullable: true })
  lastExternalMessageId!: string | null

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>
}

@Entity({ name: 'cc_message_link' })
@Index(['tenantId', 'channelAccountId', 'provider', 'externalMessageId'], { unique: true, where: 'external_message_id IS NOT NULL' })
@Index(['tenantId', 'clientMessageId'], { unique: true, where: 'client_message_id IS NOT NULL' })
@Index(['tenantId', 'libreDeskMessageUuid'], { unique: true, where: 'libredesk_message_uuid IS NOT NULL' })
export class CustomerCareMessageLinkEntity extends CustomerCareTenantEntity {
  @Column({ name: 'channel_account_id', type: 'int', nullable: true })
  channelAccountId!: number | null

  @Column({ name: 'conversation_link_id', type: 'int', nullable: true })
  conversationLinkId!: number | null

  @Column({ type: 'varchar', length: 40, default: 'zalo_personal' })
  provider!: string

  @Column({ name: 'external_message_id', type: 'varchar', length: 220, nullable: true })
  externalMessageId!: string | null

  @Column({ name: 'client_message_id', type: 'uuid', nullable: true })
  clientMessageId!: string | null

  @Column({ name: 'libredesk_message_uuid', type: 'uuid', nullable: true })
  libreDeskMessageUuid!: string | null

  @Column({ type: 'varchar', length: 30, default: 'sent' })
  status!: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>
}

@Entity({ name: 'cc_conversation_preference' })
@Index(['tenantId', 'userId', 'conversationUuid'], { unique: true })
export class CustomerCareConversationPreferenceEntity extends CustomerCareTenantEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId!: number

  @Column({ name: 'conversation_uuid', type: 'uuid' })
  conversationUuid!: string

  @Column({ type: 'boolean', default: false })
  pinned!: boolean

  @Column({ type: 'boolean', default: false })
  muted!: boolean

  @Column({ type: 'boolean', default: false })
  archived!: boolean

  @Column({ name: 'draft_content', type: 'text', nullable: true })
  draftContent!: string | null

  @Column({ name: 'draft_attachments', type: 'jsonb', default: () => "'[]'::jsonb" })
  draftAttachments!: unknown[]
}

@Entity({ name: 'cc_inbound_event' })
@Index(['tenantId', 'channelAccountId', 'provider', 'eventId'], { unique: true })
export class CustomerCareInboundEventEntity extends CustomerCareTenantEntity {
  @Column({ name: 'channel_account_id', type: 'int', nullable: true })
  channelAccountId!: number | null

  @Column({ name: 'event_id', type: 'varchar', length: 260 })
  eventId!: string

  @Column({ type: 'varchar', length: 40 })
  provider!: string

  @Column({ type: 'varchar', length: 30, default: 'received' })
  status!: string

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null
}

@Entity({ name: 'cc_outbox_event' })
@Index(['tenantId', 'status', 'nextRetryAt'])
@Index(['tenantId', 'type', 'aggregateId'], { unique: true })
export class CustomerCareOutboxEventEntity extends CustomerCareTenantEntity {
  @Column({ type: 'varchar', length: 80 })
  type!: string

  @Column({ name: 'aggregate_id', type: 'varchar', length: 220 })
  aggregateId!: string

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: string

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number

  @Column({ name: 'next_retry_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  nextRetryAt!: Date

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null
}

@Entity({ name: 'cc_sync_event' })
@Index(['tenantId', 'sequence'], { unique: true })
export class CustomerCareSyncEventEntity extends CustomerCareTenantEntity {
  @Column({ type: 'int' })
  sequence!: number

  @Column({ name: 'event_id', type: 'uuid', unique: true })
  eventId!: string

  @Column({ type: 'varchar', length: 80 })
  type!: string

  @Column({ name: 'aggregate_id', type: 'varchar', length: 220, nullable: true })
  aggregateId!: string | null

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>
}

@Entity({ name: 'cc_message_reaction' })
@Index(['tenantId', 'messageUuid', 'userId', 'emoji'], { unique: true })
export class CustomerCareMessageReactionEntity extends CustomerCareTenantEntity {
  @Column({ name: 'message_uuid', type: 'uuid' })
  messageUuid!: string

  @Column({ name: 'user_id', type: 'int' })
  userId!: number

  @Column({ type: 'varchar', length: 32 })
  emoji!: string
}

export const CUSTOMER_CARE_ENTITIES = [
  CustomerCareChannelAccountEntity,
  CustomerCareContactIdentityEntity,
  CustomerCareConversationLinkEntity,
  CustomerCareMessageLinkEntity,
  CustomerCareConversationPreferenceEntity,
  CustomerCareInboundEventEntity,
  CustomerCareOutboxEventEntity,
  CustomerCareSyncEventEntity,
  CustomerCareMessageReactionEntity,
]
