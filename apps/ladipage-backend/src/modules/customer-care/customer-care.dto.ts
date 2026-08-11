import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class ConversationQueryDto {
  @IsOptional() @IsString() cursor?: string
  @IsOptional() @IsString() search?: string
  @IsOptional() @IsString() status?: string
  @IsOptional() @IsString() channel?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) channelAccountId?: number
  @IsOptional() @IsString() assigneeId?: string
  @IsOptional() @IsString() tagId?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 50
}

export class CreateChannelDto {
  @IsIn(['zalo_personal', 'facebook_personal']) provider!: 'zalo_personal' | 'facebook_personal'
  @IsOptional() @IsString() @MaxLength(255) name?: string
}

export class MessageQueryDto {
  @IsOptional() @IsString() cursor?: string
  @IsOptional() @IsString() before?: string
  @IsOptional() @IsString() afterSequence?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 100
}

export class SendMessageDto {
  @IsUUID() clientMessageId!: string
  @IsOptional() @IsIn(['text', 'image', 'file', 'sticker']) type = 'text'
  @IsString() @MaxLength(10000) content!: string
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsInt({ each: true }) attachments?: number[]
  @IsOptional() @IsUUID() replyToMessageId?: string
}

export class ConversationPatchDto {
  @IsOptional() @IsString() status?: string
  @IsOptional() @IsString() priority?: string
  @IsOptional() @IsBoolean() pinned?: boolean
  @IsOptional() @IsBoolean() muted?: boolean
  @IsOptional() @IsBoolean() archived?: boolean
}

export class AssignDto { @Type(() => Number) @IsInt() assigneeId!: number }
export class TeamDto { @Type(() => Number) @IsInt() teamId!: number }
export class TagsDto { @IsArray() tags!: Array<string | number>; @IsOptional() @IsIn(['set', 'add', 'remove']) action = 'set' }
export class DraftDto { @IsString() content!: string; @IsOptional() @IsArray() attachments?: unknown[] }
export class ForwardDto { @IsUUID() targetConversationId!: string; @IsOptional() @IsString() content?: string }
export class ReactionDto { @IsString() emoji!: string }

export class ContactPatchDto {
  @IsOptional() @IsString() displayName?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() note?: string
  @IsOptional() @IsArray() tags?: Array<{ id: string; name: string; color?: string }>
  @IsOptional() @IsString() crmContactId?: string
}

export class CreateConversationDto {
  @Type(() => Number) @IsInt() @Min(1) channelAccountId!: number
  @IsString() externalThreadId!: string
  @IsString() externalContactId!: string
  @IsString() displayName!: string
  @IsOptional() @IsString() avatarUrl?: string
  @IsOptional() @IsIn(['user', 'group']) threadType = 'user'
  @IsOptional() @IsString() initialMessage?: string
}

export class SyncQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) afterSequence = 0
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 500
}

export class ZaloInboundDto {
  /** @deprecated Ignored. Tenant is resolved server-side from connectionKey. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) tenant_id?: number
  @IsString() event_id!: string
  @IsString() provider!: string
  @IsString() account_id!: string
  @IsIn(['incoming', 'outgoing']) direction: 'incoming' | 'outgoing' = 'incoming'
  @IsBoolean() is_self = false
  @IsString() external_thread_id!: string
  @IsString() external_message_id!: string
  @IsOptional() @IsIn(['user', 'group']) thread_type = 'user'
  @IsString() occurred_at!: string
  @IsObject() sender!: { external_id: string; display_name: string; avatar_url?: string }
  @IsObject() message!: { type: string; text: string }
}

export class FacebookLoginDto {
  @IsString() @MaxLength(65536) cookie!: string
}


export const CUSTOMER_CARE_ORDER_RELATION_TYPES = [
  'CREATED_FROM_CHAT',
  'DISCUSSED',
  'SUPPORT',
  'RETURN',
  'COMPLAINT',
  'MANUAL',
] as const

export type CustomerCareOrderRelationType = typeof CUSTOMER_CARE_ORDER_RELATION_TYPES[number]

export class ConversationOrderLinkDto {
  @IsOptional() @IsIn(CUSTOMER_CARE_ORDER_RELATION_TYPES) relationType?: CustomerCareOrderRelationType
  @IsOptional() @IsString() @MaxLength(220) sourceMessageId?: string
  @IsOptional() @IsBoolean() isPrimary?: boolean
}
