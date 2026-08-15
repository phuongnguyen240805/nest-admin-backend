import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import {
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  DataSource,
  EntityManager,
  Repository,
} from 'typeorm';

import { ClsService } from 'nestjs-cls';

import { CrmFacade } from '../crm/crm.facade';
import { OrderEntity } from '../ecom-store/entities/order.entity';
import { OrderItemEntity } from '../ecom-store/entities/order-item.entity';
import { ShipmentEntity } from '../ecom-store/entities/shipment.entity';
import { CreateOrderWithShipmentDto } from '../ecom-store/dto/shipping.dto';
import { OrderService } from '../ecom-store/services/order.service';
import { ShippingService } from '../ecom-store/shipping/shipping.service';
import { DomainEventOutboxService } from '../domain-events/domain-event-outbox.service';

import {
  FacebookConnectorClient,
  LibreDeskClient,
  ZaloConnectorClient,
} from './customer-care.clients';
import {
  ContactPatchDto,
  CustomerCareDeliveryStatusDto,
  ConversationOrderLinkDto,
  ConversationPatchDto,
  ConversationQueryDto,
  CreateChannelDto,
  CreateConversationDto,
  DraftDto,
  MessageQueryDto,
  SendMessageDto,
  SyncQueryDto,
  ZaloInboundDto,
} from './customer-care.dto';
import {
  CustomerCareChannelAccountEntity,
  CustomerCareContactIdentityEntity,
  CustomerCareConversationLinkEntity,
  CustomerCareConversationOrderLinkEntity,
  CustomerCareConversationPreferenceEntity,
  CustomerCareInboundEventEntity,
  CustomerCareMessageLinkEntity,
  CustomerCareMessageReactionEntity,
  CustomerCareOutboxEventEntity,
  CustomerCareSyncEventEntity,
} from './customer-care.entities';
import { CustomerCareGateway } from './customer-care.gateway';

interface LibreDeskPage<T> {
  results: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface LibreDeskConversation {
  id?: number;
  uuid: string;
  updated_at: string;
  waiting_since?: string | null;
  contact?: {
    first_name?: string;
    last_name?: string;
    email?: string | null;
    avatar_url?: string | null;
  };
  inbox_channel?: string;
  inbox_name?: string;
  subject?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_message_count?: number;
  status?: string | null;
  priority?: string | null;
  assigned_user_id?: number | null;
  assigned_team_id?: number | null;
  tags?: Array<
    string | { id?: number | string; name?: string; color?: string }
  >;
  meta?: {
    facebook?: {
      account_id?: string;
      external_thread_id?: string;
      thread_type?: string;
    };
  };
}

interface LibreDeskMessage {
  uuid: string;
  conversation_uuid: string;
  created_at: string;
  type: string;
  status: string;
  content: string;
  text_content?: string;
  sender_type: string;
  private?: boolean;
  source_id?: string | null;
  attachments?: Array<{
    uuid: string;
    name: string;
    content_type?: string;
    url?: string;
    thumbnail_url?: string;
  }>;
  author?: { first_name?: string; last_name?: string; avatar_url?: string };
}

interface InboundResult {
  message_uuid?: string;
  conversation_uuid: string;
  duplicate?: boolean;
}

@Injectable()
export class CustomerCareService {
  private readonly logger = new Logger(CustomerCareService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cls: ClsService,
    private readonly libreDesk: LibreDeskClient,
    private readonly zalo: ZaloConnectorClient,
    private readonly facebook: FacebookConnectorClient,
    private readonly gateway: CustomerCareGateway,
    private readonly crm: CrmFacade,
    @InjectRepository(CustomerCareChannelAccountEntity)
    private readonly channels: Repository<CustomerCareChannelAccountEntity>,
    @InjectRepository(CustomerCareContactIdentityEntity)
    private readonly contacts: Repository<CustomerCareContactIdentityEntity>,
    @InjectRepository(CustomerCareConversationLinkEntity)
    private readonly conversations: Repository<CustomerCareConversationLinkEntity>,
    @InjectRepository(CustomerCareConversationOrderLinkEntity)
    private readonly conversationOrdersRepo: Repository<CustomerCareConversationOrderLinkEntity>,
    @InjectRepository(CustomerCareMessageLinkEntity)
    private readonly messages: Repository<CustomerCareMessageLinkEntity>,
    @InjectRepository(CustomerCareConversationPreferenceEntity)
    private readonly preferences: Repository<CustomerCareConversationPreferenceEntity>,
    @InjectRepository(CustomerCareInboundEventEntity)
    private readonly inboundEvents: Repository<CustomerCareInboundEventEntity>,
    @InjectRepository(CustomerCareOutboxEventEntity)
    private readonly outbox: Repository<CustomerCareOutboxEventEntity>,
    @InjectRepository(CustomerCareSyncEventEntity)
    private readonly syncEvents: Repository<CustomerCareSyncEventEntity>,
    @InjectRepository(CustomerCareMessageReactionEntity)
    private readonly reactions: Repository<CustomerCareMessageReactionEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItems: Repository<OrderItemEntity>,
    @InjectRepository(ShipmentEntity)
    private readonly shipments: Repository<ShipmentEntity>,
    private readonly orderService: OrderService,
    private readonly shippingService: ShippingService,
    private readonly domainEvents: DomainEventOutboxService,
    private readonly dataSource: DataSource,
  ) {}

  private getTenantId() {
    const tenantId = this.cls.get<number>('tenantId');
    if (!tenantId) throw new BadRequestException('Tenant context is required');
    return tenantId;
  }

  private async requireConversationLink(
    conversationId: string,
    tenantId = this.getTenantId(),
  ) {
    const link = await this.conversations.findOne({
      where: { tenantId, libreDeskConversationUuid: conversationId },
    });
    if (!link || Boolean(link.metadata?.deletedAt))
      throw new NotFoundException('Customer Care conversation not found');
    return link;
  }

  private async restoreDeletedConversationLink(
    link: CustomerCareConversationLinkEntity,
  ) {
    if (!link.metadata?.deletedAt) return false;
    const metadata = { ...(link.metadata || {}) };
    delete metadata.deletedAt;
    delete metadata.deletedByUserId;
    delete metadata.deletedChannelAccountId;
    link.metadata = {
      ...metadata,
      restoredAt: new Date().toISOString(),
    };
    await this.conversations.save(link);
    return true;
  }

  capabilities() {
    return {
      messages: {
        text: true,
        image: true,
        file: true,
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
        delete: true,
      },
      realtime: true,
      offlineCache: true,
      historyImport: false,
    };
  }

  async health() {
    const tenantId = this.getTenantId();
    const channelCount = await this.channels.count({ where: { tenantId } });
    const libreDeskHealth = await Promise.allSettled([
      this.libreDesk.request('/conversations?page=1&page_size=1'),
    ]);
    return {
      status: libreDeskHealth[0].status === 'fulfilled' ? 'ok' : 'degraded',
      channelCount,
      libredesk:
        libreDeskHealth[0].status === 'fulfilled'
          ? { connected: true }
          : { connected: false, error: String(libreDeskHealth[0].reason) },
    };
  }

  async createChannel(dto: CreateChannelDto) {
    const tenantId = this.getTenantId();
    const connectionKey = randomUUID();
    const row = await this.channels.save(
      this.channels.create({
      tenantId,
      connectionKey,
      provider: dto.provider,
      externalAccountId: `pending:${connectionKey}`,
        name:
          dto.name?.trim() ||
          (dto.provider === 'facebook_personal'
            ? 'Facebook cá nhân'
            : 'Zalo cá nhân'),
      enabled: true,
      metadata: {},
      }),
    );
    try {
      await this.ensureLibreDeskInbox(row);
      return this.mapChannel(row, { phase: 'disconnected' });
    } catch (error) {
      await this.channels.remove(row).catch(() => undefined);
      throw error;
    }
  }

  async deleteChannel(id: number) {
    const row = await this.getChannel(id);
    const client =
      row.provider === 'facebook_personal' ? this.facebook : this.zalo;

    // Closing the login dialog can race the final status poll. Preserve a
    // draft whose connector is already authenticated and reconcile its stable
    // social identity instead of deleting the newly connected account.
    if (row.externalAccountId.startsWith('pending:')) {
      const status = await client
        .json<Record<string, unknown>>(
          `/sessions/${row.connectionKey}/status`,
          {},
          true,
        )
        .catch(() => undefined);
      if (status && String(status.phase || '').toLowerCase() === 'connected') {
        const resolved = await this.reconcileChannelIdentity(row, status);
        return {
          deleted: false,
          preserved: true,
          channel: this.mapChannel(resolved.row, resolved.status),
        };
      }
    }

    const hasHistory = await this.conversations.exists({
      where: { tenantId: row.tenantId, channelAccountId: row.id },
    });
    // Never hard-delete an account that owns conversations. The channel FK is
    // ON DELETE CASCADE, so removing it would also remove customer-care history.
    if (hasHistory) return this.disconnectChannel(id);

    await client
      .json(`/sessions/${row.connectionKey}`, { method: 'DELETE' }, true)
      .catch(() => undefined);
    const inboxId = row.metadata?.libreDeskInboxId;
    if (typeof inboxId === 'number' || typeof inboxId === 'string') {
      await this.libreDesk
        .request(`/inboxes/${encodeURIComponent(String(inboxId))}`, {
          method: 'DELETE',
        })
        .catch(() => undefined);
    }
    await this.channels.remove(row);
    return { deleted: true };
  }

  private async setLibreDeskInboxEnabled(
    row: CustomerCareChannelAccountEntity,
    enabled: boolean,
  ) {
    const inboxId = row.metadata?.libreDeskInboxId;
    if (typeof inboxId !== 'number' && typeof inboxId !== 'string') return;
    const path = `/inboxes/${encodeURIComponent(String(inboxId))}`;
    const inbox = await this.libreDesk.request<Record<string, unknown>>(path);
    await this.libreDesk.request(path, {
      method: 'PUT',
      body: JSON.stringify({ ...inbox, enabled }),
    });
  }

  private async ensureLibreDeskInbox(row: CustomerCareChannelAccountEntity) {
    const facebook = row.provider === 'facebook_personal';
    const connectorToken =
      this.config.get<string>(
        facebook
      ? 'CUSTOMER_CARE_FACEBOOK_CONNECTOR_TOKEN'
          : 'CUSTOMER_CARE_ZALO_CONNECTOR_TOKEN',
      ) || '';
    if (!connectorToken)
      throw new ServiceUnavailableException(
        'Customer Care connector token is not configured',
      );
    const connectorUrl =
      this.config.get<string>(
        facebook
      ? 'CUSTOMER_CARE_FACEBOOK_CONNECTOR_URL'
          : 'CUSTOMER_CARE_ZALO_CONNECTOR_URL',
      ) ||
      (facebook
      ? 'http://facebook-connector:3200'
      : 'http://zalo-connector:3100');
    const inboxPayload = {
      name: row.name,
      channel: row.provider,
      enabled: true,
      csat_enabled: false,
      prompt_tags_on_reply: false,
      from: '',
      from_name_template: '',
      config: {
        channel_connection_key: row.connectionKey,
        connector_url: connectorUrl,
        connector_token: connectorToken,
        account_id: row.externalAccountId,
        request_timeout: facebook ? '30s' : '15s',
      },
    };
    const existingInboxId = row.metadata?.libreDeskInboxId;
    const inbox = await this.libreDesk.request<Record<string, unknown>>(
      existingInboxId
        ? `/inboxes/${encodeURIComponent(String(existingInboxId))}`
        : '/inboxes',
      {
      method: existingInboxId ? 'PUT' : 'POST',
      body: JSON.stringify(inboxPayload),
      },
    );
    if (!existingInboxId) {
      row.metadata = { ...row.metadata, libreDeskInboxId: inbox.id };
      await this.channels.save(row);
    }
  }

  private connectorAccountId(status: Record<string, unknown>) {
    return typeof status.account_id === 'string'
      ? status.account_id.trim()
      : '';
  }

  private connectorProfileName(status: Record<string, unknown>) {
    const root =
      status.profile && typeof status.profile === 'object'
      ? (status.profile as Record<string, unknown>)
      : {};
    const nested = [root.profile, root.data, root.user].find(
      (value) => value && typeof value === 'object',
    ) as Record<string, unknown> | undefined;
    const source = { ...root, ...(nested || {}) };
    for (const key of [
      'displayName',
      'display_name',
      'name',
      'username',
      'zaloName',
    ]) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  private shouldReplaceGeneratedChannelName(
    row: CustomerCareChannelAccountEntity,
  ) {
    const value = String(row.name || '')
      .trim()
      .toLowerCase();
    return (
      !value ||
      value === 'zalo cá nhân' ||
      value === 'facebook cá nhân' ||
      value === 'zalo cskh' ||
      value === 'facebook cskh' ||
      /\b(demo|test|sample)\b/i.test(value)
    );
  }

  private async cleanupDuplicateChannel(
    row: CustomerCareChannelAccountEntity,
    duplicateOfId: number,
    options: { disconnectSession?: boolean } = {},
  ) {
    row.enabled = false;
    row.metadata = {
      ...(row.metadata || {}),
      duplicateOfChannelId: duplicateOfId,
      disabledReason: 'duplicate_social_account',
      disabledAt: new Date().toISOString(),
    };
    await this.channels.save(row).catch(() => undefined);

    const inboxId = row.metadata?.libreDeskInboxId;
    if (typeof inboxId === 'number' || typeof inboxId === 'string') {
      await this.libreDesk
        .request(`/inboxes/${encodeURIComponent(String(inboxId))}`, {
          method: 'DELETE',
        })
        .catch(() => undefined);
    }
    if (options.disconnectSession !== false) {
      const client =
        row.provider === 'facebook_personal' ? this.facebook : this.zalo;
      await client
        .json(`/sessions/${row.connectionKey}`, { method: 'DELETE' }, true)
        .catch(() => undefined);
    }
  }

  private async retirePendingChannel(row: CustomerCareChannelAccountEntity) {
    row.enabled = false;
    row.metadata = {
      ...(row.metadata || {}),
      disabledReason: 'abandoned_login_draft',
      disabledAt: new Date().toISOString(),
    };
    await this.channels.save(row).catch(() => undefined);

    const inboxId = row.metadata?.libreDeskInboxId;
    if (typeof inboxId === 'number' || typeof inboxId === 'string') {
      await this.libreDesk
        .request(`/inboxes/${encodeURIComponent(String(inboxId))}`, {
          method: 'DELETE',
        })
        .catch(() => undefined);
    }
    const client =
      row.provider === 'facebook_personal' ? this.facebook : this.zalo;
    await client
      .json(`/sessions/${row.connectionKey}`, { method: 'DELETE' }, true)
      .catch(() => undefined);
  }

  /**
   * Bind a connector session to one canonical social account row. A second QR
   * login of the same Zalo/Facebook account must not create a second inbox.
   * Instead, the new draft row is disabled and callers are redirected to the
   * already-existing channel.
   */
  private async reconcileChannelIdentity(
    row: CustomerCareChannelAccountEntity,
    status: Record<string, unknown>,
  ) {
    const accountId = this.connectorAccountId(status);
    if (!accountId) return { row, status, duplicate: false };

    const duplicate = await this.channels.findOne({
      where: {
        tenantId: row.tenantId,
        provider: row.provider,
        externalAccountId: accountId,
      },
    });

    if (duplicate && duplicate.id !== row.id) {
      const client =
        row.provider === 'facebook_personal' ? this.facebook : this.zalo;
      const incomingPhase = String(status.phase || '').toLowerCase();
      let canonicalStatus: Record<string, unknown> = await client
        .json<
          Record<string, unknown>
        >(`/sessions/${duplicate.connectionKey}/status`, {}, true)
        .catch(() => ({}));
      let adopted = false;

      // A user can log the same social account into a fresh draft while the
      // canonical row is disconnected. Move that authenticated connector
      // session back to the canonical connection key so its inbox and all
      // existing conversation links keep the same channel id.
      if (
        incomingPhase === 'connected' &&
        String(canonicalStatus.phase || '').toLowerCase() !== 'connected'
      ) {
        try {
          canonicalStatus = await client.json<Record<string, unknown>>(
            `/sessions/${row.connectionKey}/adopt`,
            {
              method: 'POST',
              body: JSON.stringify({
                target_connection_key: duplicate.connectionKey,
              }),
            },
            true,
          );
          adopted = true;
        } catch (error) {
          // Never delete the only connected session. Keep the fresh row for
          // this response and retry reconciliation on a later channel probe.
          this.logger.warn(
            `Could not adopt ${row.provider} session ${row.connectionKey} into ${duplicate.connectionKey}: ${String(error)}`,
          );
          return { row, status, duplicate: false };
        }
      }

      let duplicateChanged = false;
      if (!duplicate.enabled) {
        duplicate.enabled = true;
        duplicate.metadata = {
          ...(duplicate.metadata || {}),
          restoredAt: new Date().toISOString(),
        };
        duplicateChanged = true;
      }
      const duplicateProfileName = this.connectorProfileName(status);
      if (
        duplicateProfileName &&
        this.shouldReplaceGeneratedChannelName(duplicate) &&
        duplicate.name !== duplicateProfileName
      ) {
        duplicate.name = duplicateProfileName;
        duplicateChanged = true;
      }
      if (duplicateChanged) await this.channels.save(duplicate);
      await this.ensureLibreDeskInbox(duplicate).catch((error) => {
        this.logger.warn(
          `Could not restore LibreDesk inbox for channel ${duplicate.id}: ${String(error)}`,
        );
      });
      await this.cleanupDuplicateChannel(row, duplicate.id, {
        disconnectSession: !adopted,
      });
      return {
        row: duplicate,
        status: {
          ...canonicalStatus,
          account_id: accountId,
          duplicate_of_channel_id: String(duplicate.id),
        },
        duplicate: true,
      };
    }

    let changed = false;
    if (row.externalAccountId !== accountId) {
      row.externalAccountId = accountId;
      changed = true;
    }
    const profileName = this.connectorProfileName(status);
    if (
      profileName &&
      this.shouldReplaceGeneratedChannelName(row) &&
      row.name !== profileName
    ) {
      row.name = profileName;
      changed = true;
    }
    if (changed) await this.channels.save(row);
    if (
      String(status.phase || '').toLowerCase() === 'connected' &&
      (changed || !row.metadata?.libreDeskInboxId)
    ) {
      await this.ensureLibreDeskInbox(row).catch((error) => {
        this.logger.warn(
          `Could not ensure LibreDesk inbox for connected channel ${row.id}: ${String(error)}`,
        );
      });
    }
    return { row, status, duplicate: false };
  }

  async listChannels() {
    const tenantId = this.getTenantId();
    const rows = await this.channels.find({
      where: { tenantId, enabled: true },
      order: { id: 'ASC' },
    });
    const activeRows: CustomerCareChannelAccountEntity[] = [];
    for (const row of rows) {
      const abandonedDraft =
        row.externalAccountId.startsWith('pending:') &&
        Date.now() - row.createdAt.getTime() > 30 * 60_000;
      if (abandonedDraft) {
        await this.retirePendingChannel(row);
      } else {
        activeRows.push(row);
      }
    }
    const statuses = await Promise.all(
      activeRows.map(async (row) => {
        const client =
          row.provider === 'facebook_personal' ? this.facebook : this.zalo;
        return ['zalo_personal', 'facebook_personal'].includes(row.provider)
          ? client
              .json<
                Record<string, unknown>
              >(`/sessions/${row.connectionKey}/status`, {}, true)
              .catch((error) => ({ phase: 'error', last_error: String(error) }))
          : {};
      }),
    );

    // Identity reconciliation is intentionally sequential. If two pending
    // connector sessions both resolve to the same social account at once, a
    // concurrent save can race the unique (tenant, provider, externalAccountId)
    // constraint and make GET /channels fail completely.
    const probed: Array<{
      row: CustomerCareChannelAccountEntity;
      status: Record<string, unknown>;
      duplicate: boolean;
    }> = [];
    for (let index = 0; index < activeRows.length; index += 1) {
      probed.push(
        await this.reconcileChannelIdentity(activeRows[index], statuses[index]),
      );
    }

    const seenRows = new Set<number>();
    const seenIdentities = new Set<string>();
    const result: ReturnType<CustomerCareService['mapChannel']>[] = [];

    for (const resolved of probed) {
      const row = resolved.row;
      if (!row.enabled || seenRows.has(row.id)) continue;

      const statusAccountId = this.connectorAccountId(resolved.status);
      const pendingIdentity = row.externalAccountId.startsWith('pending:');
      const identity =
        statusAccountId || (!pendingIdentity ? row.externalAccountId : '');
      const identityKey = identity
        ? `${row.provider}:${identity}`
        : `${row.provider}:row:${row.id}`;
      if (seenIdentities.has(identityKey)) continue;

      seenRows.add(row.id);
      seenIdentities.add(identityKey);
      result.push(this.mapChannel(row, resolved.status));
    }
    return result;
  }

  async getChannel(id: number) {
    const tenantId = this.getTenantId();
    const row = await this.channels.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Channel account not found');
    return row;
  }

  async getChannelStatus(id: number) {
    const row = await this.getChannel(id);
    const client =
      row.provider === 'facebook_personal' ? this.facebook : this.zalo;
    const status = await client.json<Record<string, unknown>>(
      `/sessions/${row.connectionKey}/status`,
      {},
      true,
    );
    const resolved = await this.reconcileChannelIdentity(row, status);
    return this.mapChannel(resolved.row, resolved.status);
  }

  async resetChannel(id: number) {
    const row = await this.getChannel(id);
    if (row.provider !== 'zalo_personal')
      throw new BadRequestException(
        'Facebook does not support QR session reset',
      );
    await this.ensureLibreDeskInbox(row);
    const status = await this.zalo.json<Record<string, unknown>>(
      `/sessions/${row.connectionKey}/reset`,
      { method: 'POST' },
      true,
    );
    await this.publish(row.tenantId, 'channel.status.changed', String(row.id), {
      channelId: String(row.id),
      ...status,
    });
    return status;
  }

  async disconnectChannel(id: number) {
    const row = await this.getChannel(id);
    const client =
      row.provider === 'facebook_personal' ? this.facebook : this.zalo;
    let connectorError: string | undefined;
    await client
      .json<
        Record<string, unknown>
      >(`/sessions/${row.connectionKey}`, { method: 'DELETE' }, true)
      .catch((error) => {
        // Logout must still close the local tenant boundary when a connector
        // is temporarily unavailable. Disabled rows reject future webhooks.
        connectorError = error instanceof Error ? error.message : String(error);
      });

    row.enabled = false;
    row.metadata = {
      ...(row.metadata || {}),
      loggedOutAt: new Date().toISOString(),
      ...(connectorError ? { connectorLogoutError: connectorError } : {}),
    };
    await this.channels.save(row);
    await this.setLibreDeskInboxEnabled(row, false).catch((error) => {
      this.logger.warn(
        `Unable to disable LibreDesk inbox for channel ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    });
    await this.publish(row.tenantId, 'channel.status.changed', String(row.id), {
      channelId: String(row.id),
      phase: 'disconnected',
      removed: true,
    });
    return {
      removed: true,
      channelId: String(row.id),
      phase: 'disconnected',
      connectorCleanupPending: Boolean(connectorError),
    };
  }

  async getChannelQr(id: number) {
    const row = await this.getChannel(id);
    if (row.provider !== 'zalo_personal')
      throw new BadRequestException('QR login is only available for Zalo');
    return this.zalo.qr(row.connectionKey);
  }

  async loginFacebook(id: number, cookie: string) {
    const row = await this.getChannel(id);
    if (row.provider !== 'facebook_personal')
      throw new BadRequestException('This channel is not a Facebook account');
    if (!/(?:^|;\s*)c_user=/.test(cookie) || !/(?:^|;\s*)xs=/.test(cookie))
      throw new BadRequestException(
        'Facebook cookie must contain c_user and xs',
      );
    await this.ensureLibreDeskInbox(row);
    const status = await this.facebook.json<Record<string, unknown>>(
      `/sessions/${row.connectionKey}`,
      {
      method: 'POST',
      body: JSON.stringify({ cookie }),
      },
    );
    const resolved = await this.reconcileChannelIdentity(row, status);
    await this.publish(
      resolved.row.tenantId,
      'channel.status.changed',
      String(resolved.row.id),
      {
      channelId: String(resolved.row.id),
      ...resolved.status,
      },
    );
    return this.mapChannel(resolved.row, resolved.status);
  }

  private mapChannel(
    row: CustomerCareChannelAccountEntity,
    status: Record<string, unknown>,
  ) {
    return {
      id: String(row.id),
      provider: row.provider,
      externalAccountId: row.externalAccountId,
      name: row.name,
      enabled: row.enabled,
      status,
    };
  }

  async listConversations(query: ConversationQueryDto, userId: number) {
    const tenantId = this.getTenantId();
    const page = Math.max(1, Number(query.cursor || 1));
    const pageSize = Math.min(100, query.limit || 50);
    const [allLinks, agents] = await Promise.all([
      this.conversations.find({
        where: query.channelAccountId
          ? { tenantId, channelAccountId: query.channelAccountId }
          : { tenantId },
        order: { lastMessageAt: 'DESC' },
      }),
      this.getAgentsRaw().catch(() => []),
    ]);
    const links = allLinks.filter((link) => !link.metadata?.deletedAt);
    const rawResults = await Promise.allSettled(
      links.map((link) =>
        this.libreDesk.request<LibreDeskConversation>(
          `/conversations/${encodeURIComponent(link.libreDeskConversationUuid)}`,
        ),
      ),
    );
    const results = rawResults.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const uuids = results.map((item) => item.uuid);
    const prefs = uuids.length
      ? await this.preferences.find({
          where: { tenantId, userId, conversationUuid: In(uuids) },
        })
      : [];
    const contactIds = links
      .map((link) => link.contactIdentityId)
      .filter(Boolean) as number[];
    const identities = contactIds.length
      ? await this.contacts.find({ where: { tenantId, id: In(contactIds) } })
      : [];
    const channelIds = [
      ...new Set(links.map((link) => link.channelAccountId).filter(Boolean)),
    ];
    const channelRows = channelIds.length
      ? await this.channels.find({ where: { tenantId, id: In(channelIds) } })
      : [];
    const channelMap = new Map(channelRows.map((item) => [item.id, item]));
    const prefMap = new Map(prefs.map((item) => [item.conversationUuid, item]));
    const linkMap = new Map(
      links.map((item) => [item.libreDeskConversationUuid, item]),
    );
    const contactMap = new Map(identities.map((item) => [item.id, item]));
    const agentMap = new Map(
      (agents as any[]).map((agent) => [
        Number(agent.id),
        {
          id: String(agent.id),
          name: fullName(agent.first_name, agent.last_name),
          avatar: agent.avatar_url || undefined,
        },
      ]),
    );
    let items = results
      .filter((item) => linkMap.has(item.uuid))
      .map((item) =>
        this.mapConversation(
          item,
          agentMap,
          prefMap.get(item.uuid),
          linkMap.get(item.uuid)?.contactIdentityId
            ? contactMap.get(linkMap.get(item.uuid)!.contactIdentityId!)
            : undefined,
          linkMap.get(item.uuid),
          linkMap.get(item.uuid)?.channelAccountId
            ? channelMap.get(linkMap.get(item.uuid)!.channelAccountId)
            : undefined,
        ),
      );
    const search = (query.search || '').trim().toLocaleLowerCase('vi');
    if (search)
      items = items.filter((item) =>
        `${item.customer.name} ${item.lastMessage} ${item.customer.phone || ''}`
          .toLocaleLowerCase('vi')
          .includes(search),
      );
    if (query.status)
      items = items.filter((item) => item.status === query.status);
    if (query.channel)
      items = items.filter((item) => item.channel === query.channel);
    if (query.assigneeId)
      items = items.filter((item) => item.assignee?.id === query.assigneeId);
    if (query.tagId)
      items = items.filter((item) =>
        item.tags?.some((tag: any) => tag.id === query.tagId),
      );
    items.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
    );
    const total = items.length;
    const offset = (page - 1) * pageSize;
    items = items.slice(offset, offset + pageSize);
    return {
      items,
      nextCursor: offset + pageSize < total ? String(page + 1) : undefined,
      total,
    };
  }

  async getConversation(conversationId: string, userId: number) {
    const tenantId = this.getTenantId();
    const link = await this.requireConversationLink(conversationId, tenantId);
    const raw = await this.libreDesk.request<LibreDeskConversation>(
      `/conversations/${encodeURIComponent(conversationId)}`,
    );
    const pref = await this.preferences.findOne({
      where: { tenantId, userId, conversationUuid: conversationId },
    });
    const identity = link?.contactIdentityId
      ? await this.contacts.findOne({
          where: { tenantId, id: link.contactIdentityId },
        })
      : null;
    const channelAccount = link.channelAccountId
      ? await this.channels.findOne({
          where: { tenantId, id: link.channelAccountId },
        })
      : null;
    const agents = await this.getAgentsRaw().catch(() => []);
    const agentMap = new Map(
      (agents as any[]).map((agent) => [
        Number(agent.id),
        {
          id: String(agent.id),
          name: fullName(agent.first_name, agent.last_name),
          avatar: agent.avatar_url || undefined,
        },
      ]),
    );
    return this.mapConversation(
      raw,
      agentMap,
      pref || undefined,
      identity || undefined,
      link,
      channelAccount || undefined,
    );
  }

  async deleteConversation(
    conversationId: string,
    userId: number,
    expectedChannelAccountId?: number,
  ) {
    const tenantId = this.getTenantId();
    const link = await this.conversations.findOne({
      where: { tenantId, libreDeskConversationUuid: conversationId },
    });
    if (!link || link.metadata?.deletedAt) {
      throw new NotFoundException('Customer Care conversation not found');
    }

    // When the UI knows the owning account, verify it here as well. This
    // prevents a stale multi-account tab from deleting a conversation that
    // belongs to another social account.
    if (
      expectedChannelAccountId !== undefined &&
      link.channelAccountId !== expectedChannelAccountId
    ) {
      throw new NotFoundException('Customer Care conversation not found');
    }

    link.metadata = {
      ...(link.metadata || {}),
      deletedAt: new Date().toISOString(),
      deletedByUserId: userId || null,
      deletedChannelAccountId: link.channelAccountId,
    };
    await this.conversations.save(link);

    // Draft/pin/mute/archive preferences are UI state. Remove them so a future
    // inbound message can reopen this thread with a clean workspace state.
    await this.preferences
      .delete({ tenantId, conversationUuid: conversationId })
      .catch(() => undefined);

    await this.publish(tenantId, 'conversation.deleted', conversationId, {
      conversationId,
      channelAccountId: String(link.channelAccountId),
    });

    return {
      deleted: true,
      conversationId,
      channelAccountId: String(link.channelAccountId),
    };
  }

  async createConversation(dto: CreateConversationDto) {
    const tenantId = this.getTenantId();
    const channel = await this.getChannel(dto.channelAccountId);

    const existing = await this.conversations.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: channel.provider,
        externalThreadId: dto.externalThreadId,
      },
    });

    if (existing) {
      const restored = await this.restoreDeletedConversationLink(existing);
      if (restored) {
        await this.publish(
          tenantId,
          'conversation.created',
          existing.libreDeskConversationUuid,
          { conversationId: existing.libreDeskConversationUuid },
        );
      }
      return this.getConversation(existing.libreDeskConversationUuid, 0);
    }

    const inbound: ZaloInboundDto = {
      tenant_id: tenantId,
      event_id: `manual:${randomUUID()}`,

      provider: channel.provider,
      account_id: channel.externalAccountId,

      // FIX: bắt buộc theo ZaloInboundDto
      direction: 'incoming',
      is_self: false,

      external_thread_id: dto.externalThreadId,
      external_message_id: `manual:${randomUUID()}`,

      thread_type: dto.threadType,
      occurred_at: new Date().toISOString(),

      sender: {
        external_id: dto.externalContactId,
        display_name: dto.displayName,
        avatar_url: dto.avatarUrl,
      },

      message: {
        type: 'text',
        text: dto.initialMessage || 'Bắt đầu hội thoại',
      },
    };

    const result = await this.processInbound(inbound, tenantId, channel);

    return {
      id: result.conversation_uuid,
      created: true,
    };
  }

  // async createConversation(dto: CreateConversationDto) {
  //   const tenantId = this.getTenantId();
  //   const channel = await this.ensureDefaultChannel(tenantId);
  //   const existing = await this.conversations.findOne({
  //     where: {
  //       tenantId,
  //       provider: channel.provider,
  //       externalThreadId: dto.externalThreadId,
  //     },
  //   });
  //   if (existing)
  //     return this.getConversation(existing.libreDeskConversationUuid, 0);
  //   const inbound: ZaloInboundDto = {
  //     tenant_id: tenantId,
  //     event_id: `manual:${randomUUID()}`,
  //     provider: channel.provider,
  //     account_id: channel.externalAccountId,
  //     external_thread_id: dto.externalThreadId,
  //     external_message_id: `manual:${randomUUID()}`,
  //     thread_type: dto.threadType,
  //     occurred_at: new Date().toISOString(),
  //     sender: {
  //       external_id: dto.externalContactId,
  //       display_name: dto.displayName,
  //       avatar_url: dto.avatarUrl,
  //     },
  //     message: {
  //       type: 'text',
  //       text: dto.initialMessage || 'Bắt đầu hội thoại',
  //     },
  //   };
  //   const result = await this.processInbound(inbound, tenantId);
  //   return { id: result.conversation_uuid, created: true };
  // }

  async patchConversation(
    conversationId: string,
    dto: ConversationPatchDto,
    userId: number,
  ) {
    const tenantId = this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    if (dto.status)
      await this.libreDesk.request(
        `/conversations/${encodeURIComponent(conversationId)}/status`,
        { method: 'PUT', body: JSON.stringify({ status: dto.status }) },
      );
    if (dto.priority)
      await this.libreDesk.request(
        `/conversations/${encodeURIComponent(conversationId)}/priority`,
        { method: 'PUT', body: JSON.stringify({ priority: dto.priority }) },
      );
    if (
      [dto.pinned, dto.muted, dto.archived].some((value) => value !== undefined)
    ) {
      let pref = await this.preferences.findOne({
        where: { tenantId, userId, conversationUuid: conversationId },
      });
      pref ||= this.preferences.create({
        tenantId,
        userId,
        conversationUuid: conversationId,
        pinned: false,
        muted: false,
        archived: false,
        draftContent: null,
        draftAttachments: [],
      });
      if (dto.pinned !== undefined) pref.pinned = dto.pinned;
      if (dto.muted !== undefined) pref.muted = dto.muted;
      if (dto.archived !== undefined) pref.archived = dto.archived;
      await this.preferences.save(pref);
    }
    const event = await this.publish(
      tenantId,
      'conversation.updated',
      conversationId,
      { conversationId, ...dto },
    );
    return { conversationId, ...dto, sequence: event.sequence };
  }

  async markRead(conversationId: string) {
    const tenantId = this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    await this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/last-seen`,
      { method: 'PUT', body: '{}' },
    );
    await this.publish(tenantId, 'conversation.read.updated', conversationId, {
      conversationId,
      unread: false,
    });
    return { conversationId, unread: false };
  }

  async markUnread(conversationId: string) {
    const tenantId = this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    await this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/mark-unread`,
      { method: 'PUT', body: '{}' },
    );
    await this.publish(tenantId, 'conversation.read.updated', conversationId, {
      conversationId,
      unread: true,
    });
    return { conversationId, unread: true };
  }

  async setAssignee(conversationId: string, assigneeId: number | null) {
    const tenantId = this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    const path = assigneeId == null ? 'assignee/user/remove' : 'assignee/user';
    await this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify(
          assigneeId == null ? {} : { assignee_id: assigneeId },
        ),
      },
    );
    await this.publish(tenantId, 'conversation.updated', conversationId, {
      conversationId,
      assigneeId,
    });
    return { conversationId, assigneeId };
  }

  async setTeam(conversationId: string, teamId: number | null) {
    const tenantId = this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    const path = teamId == null ? 'assignee/team/remove' : 'assignee/team';
    await this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify(teamId == null ? {} : { assignee_id: teamId }),
      },
    );
    await this.publish(tenantId, 'conversation.updated', conversationId, {
      conversationId,
      teamId,
    });
    return { conversationId, teamId };
  }

  async setTags(
    conversationId: string,
    tags: Array<string | number>,
    action = 'set',
  ) {
    const tenantId = this.getTenantId();
    const conversationLink = await this.requireConversationLink(
      conversationId,
      tenantId,
    );

    // LibreDesk mutates conversation tags by tag name, while the public Nest
    // contract accepts either stable IDs or names. Resolve IDs here so the FE
    // never needs provider-specific knowledge.
    const available =
      await this.libreDesk.request<Array<{ id: number; name: string }>>(
        '/tags',
      );
    const namesById = new Map(
      available.map((tag) => [String(tag.id), tag.name]),
    );
    const tagNames = [
      ...new Set(
        tags
          .map((tag) => namesById.get(String(tag)) || String(tag).trim())
          .filter(Boolean),
      ),
    ];
    if (!tagNames.length)
      throw new BadRequestException('At least one valid tag is required');

    // LibreDesk uses automation action names (`add_tags`, `remove_tags`,
    // `set_tags`) while the public Customer Care API deliberately exposes the
    // shorter add/remove/set contract.
    const libreDeskAction = `${action}_tags`;

    const result = await this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/tags`,
      {
        method: 'POST',
        body: JSON.stringify({ tags: tagNames, action: libreDeskAction }),
      },
    );
    if (conversationLink.contactIdentityId) {
      const contact = await this.contacts.findOne({
        where: { id: conversationLink.contactIdentityId, tenantId },
      });
      if (contact) {
        const selected = tagNames.map((name) => {
          const providerTag = available.find((tag) => tag.name === name);
          return {
            id: String(providerTag?.id ?? name),
            name,
            color: customerCareTagColor(name),
          };
        });
        const selectedNames = new Set(selected.map((tag) => tag.name));
        const current = contact.tags || [];
        contact.tags =
          action === 'set'
          ? selected
          : action === 'remove'
            ? current.filter((tag) => !selectedNames.has(tag.name))
              : [
                  ...current.filter((tag) => !selectedNames.has(tag.name)),
                  ...selected,
                ];
        await this.contacts.save(contact);
        await this.publish(tenantId, 'contact.updated', String(contact.id), {
          contact: this.mapContact(contact),
        });
      }
    }
    await this.publish(tenantId, 'conversation.updated', conversationId, {
      conversationId,
      tags: tagNames,
      tagAction: action,
    });
    return result;
  }

  async participants(conversationId: string) {
    await this.requireConversationLink(conversationId);
    return this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/participants`,
    );
  }

  async previousConversations(conversationId: string, userId: number) {
    const tenantId = this.getTenantId();
    const link = await this.requireConversationLink(conversationId, tenantId);
    if (!link.contactIdentityId) return [];
    const links = await this.conversations.find({
      where: { tenantId, contactIdentityId: link.contactIdentityId },
      order: { lastMessageAt: 'DESC' },
      take: 20,
    });
    const all = await this.listConversations(
      { limit: 100 } as ConversationQueryDto,
      userId,
    );
    return all.items.filter(
      (item: any) =>
        links.some((row) => row.libreDeskConversationUuid === item.id) &&
        item.id !== conversationId,
    );
  }

  async getDraft(conversationId: string, userId: number) {
    await this.requireConversationLink(conversationId);
    const pref = await this.preferences.findOne({
      where: {
        tenantId: this.getTenantId(),
        userId,
        conversationUuid: conversationId,
      },
    });
    return {
      conversationId,
      content: pref?.draftContent || '',
      attachments: pref?.draftAttachments || [],
    };
  }

  async saveDraft(conversationId: string, userId: number, dto: DraftDto) {
    const tenantId = this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    let pref = await this.preferences.findOne({
      where: { tenantId, userId, conversationUuid: conversationId },
    });
    pref ||= this.preferences.create({
      tenantId,
      userId,
      conversationUuid: conversationId,
      pinned: false,
      muted: false,
      archived: false,
      draftContent: null,
      draftAttachments: [],
    });
    pref.draftContent = dto.content;
    pref.draftAttachments = dto.attachments || [];
    await this.preferences.save(pref);
    return {
      conversationId,
      content: pref.draftContent,
      attachments: pref.draftAttachments,
    };
  }

  async deleteDraft(conversationId: string, userId: number) {
    await this.requireConversationLink(conversationId);
    await this.preferences.update(
      {
        tenantId: this.getTenantId(),
        userId,
        conversationUuid: conversationId,
      },
      { draftContent: null, draftAttachments: [] },
    );
    return { conversationId, deleted: true };
  }

  async listMessages(
    conversationId: string,
    query: MessageQueryDto,
    userId: number,
  ) {
    const tenantId = this.getTenantId();
    const conversationLink = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    const page = Math.max(1, Number(query.cursor || 1));
    const limit = Math.min(200, query.limit || 100);

    const raw = await this.libreDesk.request<LibreDeskPage<LibreDeskMessage>>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?page=${page}&page_size=${limit}&private=false&type=incoming&type=outgoing`,
    );
    const rows = Array.isArray(raw) ? raw : raw?.results || [];
    const messageUuids = rows.map((row) => row.uuid);

    const [reactionRows, messageLinks, mirrorLinks] = await Promise.all([
      messageUuids.length
        ? this.reactions.find({
            where: { tenantId, messageUuid: In(messageUuids) },
          })
        : Promise.resolve([]),
      messageUuids.length
        ? this.messages.find({
            where: { tenantId, libreDeskMessageUuid: In(messageUuids) },
          })
        : Promise.resolve([]),
      page === 1
        ? this.messages.find({
            where: {
              tenantId,
              conversationLinkId: conversationLink.id,
              libreDeskMessageUuid: IsNull(),
            },
            order: { createdAt: 'ASC' },
            take: 200,
          })
        : Promise.resolve([]),
    ]);

    const linkMap = new Map(
      messageLinks.map((link) => [link.libreDeskMessageUuid, link]),
    );
    const reactionMap = new Map<
      string,
      Record<string, { count: number; reactedByMe: boolean }>
    >();

    for (const reaction of reactionRows) {
      const current = reactionMap.get(reaction.messageUuid) || {};
      const value = current[reaction.emoji] || { count: 0, reactedByMe: false };
      value.count += 1;
      if (reaction.userId === userId) value.reactedByMe = true;
      current[reaction.emoji] = value;
      reactionMap.set(reaction.messageUuid, current);
    }

    const mappedRows = rows.map((row) => {
      const link = linkMap.get(row.uuid);
      return {
        row,
        link,
        item: this.mapMessage(row, reactionMap.get(row.uuid), link),
      };
    });
    // Older connector-native self-echoes were persisted as a second LibreDesk message.
    // Hide only a connector-native outgoing echo that has a matching normal
    // outgoing message in the same short send window.
    const libreDeskItems = mappedRows
      .filter((current) => {
        if (
          !['zalo_native', 'facebook_native'].includes(
            String(current.link?.metadata?.source || ''),
          ) ||
          current.item.direction !== 'outgoing'
        )
          return true;
        const timestamp = new Date(current.item.createdAt).getTime();
        return !mappedRows.some((other) => {
          if (other.row.uuid === current.row.uuid) return false;
          if (
            ['zalo_native', 'facebook_native'].includes(
              String(other.link?.metadata?.source || ''),
            )
          )
            return false;
          return (
            other.item.direction === 'outgoing' &&
            other.item.content === current.item.content &&
            Math.abs(new Date(other.item.createdAt).getTime() - timestamp) <=
              15_000
          );
        });
      })
      .map(({ item }) => item);

    const existingExternalIds = new Set(
      libreDeskItems
        .map((item) => item.externalMessageId)
        .filter((value): value is string => Boolean(value)),
    );

    const mirrorItems = mirrorLinks
      .filter((link) => link.metadata?.mirror === true)
      .filter(
        (link) =>
          !link.externalMessageId ||
          !existingExternalIds.has(link.externalMessageId),
      )
      .map((link) => {
        const meta = link.metadata || {};
        return {
          id: `mirror:${link.externalMessageId || link.id}`,
          conversationId,
          externalMessageId: link.externalMessageId || undefined,
          direction: 'outgoing',
          type: String(meta.type || 'text'),
          content: String(meta.content || ''),
          createdAt:
            typeof meta.createdAt === 'string'
              ? meta.createdAt
              : link.createdAt.toISOString(),
          sender: { name: 'Bạn' },
          senderName: 'Bạn',
          status:
            link.status === 'recalled' ? 'recalled' : link.status || 'sent',
          recalled:
            link.status === 'recalled' || link.metadata?.recalled === true,
          attachments: [],
          reactions: [],
        };
      });

    const items = [...libreDeskItems, ...mirrorItems].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return {
      items,
      nextCursor:
        raw?.total_pages && page < raw.total_pages
          ? String(page + 1)
          : undefined,
    };
  }

  async getMessage(
    conversationId: string,
    messageId: string,
    tenantOverride?: number,
    userId = 0,
  ) {
    const tenantId = tenantOverride || this.getTenantId();
    await this.requireConversationLink(conversationId, tenantId);
    const row = await this.libreDesk.request<LibreDeskMessage>(
      `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    );
    const [link, reactionRows] = await Promise.all([
      this.messages.findOne({
        where: { tenantId, libreDeskMessageUuid: row.uuid },
      }),
      this.reactions.find({ where: { tenantId, messageUuid: row.uuid } }),
    ]);
    const reactions: Record<string, { count: number; reactedByMe: boolean }> =
      {};
    for (const reaction of reactionRows) {
      const value = reactions[reaction.emoji] || {
        count: 0,
        reactedByMe: false,
      };
      value.count += 1;
      if (reaction.userId === userId) value.reactedByMe = true;
      reactions[reaction.emoji] = value;
    }
    return this.mapMessage(row, reactions, link || undefined);
  }

  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
    userId: number,
    fromOutbox = false,
    tenantOverride?: number,
  ) {
    const tenantId = tenantOverride || this.getTenantId();
    const attachments = dto.attachments || [];
    if (!dto.content.trim() && attachments.length === 0)
      throw new BadRequestException(
        'Message content or an attachment is required',
      );
    if (dto.type === 'sticker')
      throw new BadRequestException(
        'The connected Zalo provider does not support stickers yet',
      );

    const conversationLink = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    let messageLink = await this.messages.findOne({
      where: { tenantId, clientMessageId: dto.clientMessageId },
    });
    if (messageLink?.libreDeskMessageUuid)
      return this.getMessage(
        conversationId,
        messageLink.libreDeskMessageUuid,
        tenantId,
      );
    if (messageLink?.status === 'sending' && !fromOutbox) {
      return this.pendingMessage(conversationId, dto, messageLink.status);
    }

    if (!messageLink) {
      try {
        messageLink = await this.messages.save(
          this.messages.create({
            tenantId,
            channelAccountId: conversationLink.channelAccountId,
            conversationLinkId: conversationLink.id,
            provider: conversationLink.provider,
            externalMessageId: null,
            clientMessageId: dto.clientMessageId,
            libreDeskMessageUuid: null,
            status: 'sending',
            metadata: {
              userId,
              replyToMessageId: dto.replyToMessageId || null,
              content: dto.content,
            },
          }),
        );
      } catch {
        messageLink = await this.messages.findOne({
          where: { tenantId, clientMessageId: dto.clientMessageId },
        });
        if (!messageLink)
          throw new ConflictException(
            'A message with this idempotency key is already being processed',
          );
        if (messageLink.libreDeskMessageUuid)
          return this.getMessage(
            conversationId,
            messageLink.libreDeskMessageUuid,
            tenantId,
          );
        if (!fromOutbox)
          return this.pendingMessage(conversationId, dto, messageLink.status);
      }
    } else {
      messageLink.status = 'sending';
      messageLink.metadata = {
        ...(messageLink.metadata || {}),
        userId,
        replyToMessageId: dto.replyToMessageId || null,
        content: dto.content,
      };
      await this.messages.save(messageLink);
    }

    try {
      let raw = await this.libreDesk.request<LibreDeskMessage>(
        `/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            attachments,
            message: dto.content,
            private: false,
            to: [],
            cc: [],
            bcc: [],
            sender_type: 'agent',
            mentions: [],
            echo_id: dto.clientMessageId,
          }),
        },
      );
      // QueueReply returns its in-memory `pending` row even when the Facebook
      // worker has already received an ACK and persisted `sent`. Re-read for a
      // short bounded window so the UI normally finishes in this same request.
      if (
        conversationLink.provider === 'facebook_personal' &&
        ['pending', 'queued', 'processing'].includes(normalize(raw.status))
      ) {
        for (const delayMs of [0, 100, 250, 500]) {
          if (delayMs)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          const refreshed = await this.libreDesk
            .request<LibreDeskMessage>(
              `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(raw.uuid)}`,
            )
            .catch(() => undefined);
          if (!refreshed) continue;
          raw = refreshed;
          if (
            !['pending', 'queued', 'processing'].includes(
              normalize(refreshed.status),
            )
          )
            break;
        }
      }
      messageLink.libreDeskMessageUuid = raw.uuid;
      messageLink.status = raw.status || 'sent';
      await this.messages.save(messageLink);
      const message = this.mapMessage(raw, undefined, messageLink);
      await this.publish(tenantId, 'message.created', conversationId, {
        conversationId,
        message,
      });
      return message;
    } catch (error) {
      messageLink.status = 'failed';
      messageLink.metadata = {
        ...(messageLink.metadata || {}),
        lastError: error instanceof Error ? error.message : String(error),
      };
      await this.messages.save(messageLink).catch(() => undefined);
      if (!fromOutbox) {
        const existingOutbox = await this.outbox.findOne({
          where: {
            tenantId,
            type: 'message.send',
            aggregateId: dto.clientMessageId,
          },
        });
        if (!existingOutbox)
          await this.outbox
            .save(
              this.outbox.create({
                tenantId,
                type: 'message.send',
                aggregateId: dto.clientMessageId,
                payload: { conversationId, dto, userId },
                status: 'pending',
                attemptCount: 0,
                nextRetryAt: new Date(Date.now() + 5_000),
                lastError:
                  error instanceof Error ? error.message : String(error),
              }),
            )
            .catch(async () => {
              const row = await this.outbox.findOne({
                where: {
                  tenantId,
                  type: 'message.send',
                  aggregateId: dto.clientMessageId,
                },
              });
              if (row) {
                row.status = 'pending';
                row.nextRetryAt = new Date(Date.now() + 5_000);
                row.lastError =
                  error instanceof Error ? error.message : String(error);
                await this.outbox.save(row);
              }
            });
      }
      throw error;
    }
  }

  async uploadMedia(file: {
    filename: string;
    mimetype: string;
    toBuffer(): Promise<Buffer>;
  }) {
    const media = await this.libreDesk.upload(file);
    return {
      id: media.id,
      name: media.filename,
      mimeType: media.content_type,
      size: media.size,
      type: media.content_type.startsWith('image/') ? 'image' : 'file',
      url: media.url,
    };
  }

  private pendingMessage(
    conversationId: string,
    dto: SendMessageDto,
    status = 'sending',
  ) {
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
      replyTo: dto.replyToMessageId
        ? { id: dto.replyToMessageId, content: 'Tin nhắn được trả lời' }
        : undefined,
      attachments: [],
      reactions: [],
    };
  }

  async retryMessage(conversationId: string, messageId: string) {
    await this.requireConversationLink(conversationId);
    return this.libreDesk.request(
      `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/retry`,
      { method: 'PUT', body: '{}' },
    );
  }

  async recallMessage(conversationId: string, messageId: string) {
    const tenantId = this.getTenantId();
    const conversation = await this.requireConversationLink(
      conversationId,
      tenantId,
    );

    // `recall.local = true` and `recall.native = false` means this action only
    // hides/marks the message inside the CSKH workspace. LibreDesk does not
    // expose a DELETE-message endpoint for this flow, so calling DELETE there
    // returns 404/"Not found" and bubbles up as 502.
    let link: CustomerCareMessageLinkEntity | null = null;

    if (messageId.startsWith('mirror:')) {
      const mirrorKey = messageId.slice('mirror:'.length);
      if (/^\d+$/.test(mirrorKey)) {
        link = await this.messages.findOne({
          where: {
            id: Number(mirrorKey),
            tenantId,
            conversationLinkId: conversation.id,
          },
        });
      } else if (mirrorKey) {
        link = await this.messages.findOne({
          where: {
            tenantId,
            conversationLinkId: conversation.id,
            externalMessageId: mirrorKey,
          },
        });
      }
      if (!link) throw new NotFoundException('Customer Care message not found');
    } else {
      link = await this.messages.findOne({
        where: {
          tenantId,
          conversationLinkId: conversation.id,
          libreDeskMessageUuid: messageId,
        },
      });

      // Older LibreDesk rows may not have a cc_message_link yet. Resolve the
      // message with GET (which is supported), then create/reconcile a local
      // link so the recall state survives reloads and syncs.
      if (!link) {
        const row = await this.libreDesk.request<LibreDeskMessage>(
          `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
        );
        if (row.conversation_uuid !== conversationId) {
          throw new NotFoundException('Customer Care message not found');
        }

        if (row.source_id) {
          link = await this.messages.findOne({
            where: {
              tenantId,
              conversationLinkId: conversation.id,
              channelAccountId: conversation.channelAccountId,
              provider: conversation.provider,
              externalMessageId: row.source_id,
            },
          });
        }

        if (!link) {
          link = this.messages.create({
            tenantId,
            channelAccountId: conversation.channelAccountId,
            conversationLinkId: conversation.id,
            provider: conversation.provider,
            externalMessageId: row.source_id || null,
            clientMessageId: null,
            libreDeskMessageUuid: row.uuid,
            status: 'sent',
            metadata: {},
          });
        } else if (!link.libreDeskMessageUuid) {
          link.libreDeskMessageUuid = row.uuid;
        }
      }
    }

    link.status = 'recalled';
    link.metadata = {
      ...(link.metadata || {}),
      recalled: true,
      recalledAt: new Date().toISOString(),
      recallScope: 'local',
    };
    await this.messages.save(link);

    await this.publish(tenantId, 'message.recalled', conversationId, {
      conversationId,
      messageId,
      externalMessageId: link.externalMessageId || undefined,
      native: false,
    });
    return {
      conversationId,
      messageId,
      recalled: true,
      native: false,
    };
  }

  async forwardMessage(
    sourceConversationId: string,
    messageId: string,
    targetConversationId: string,
    content: string | undefined,
    userId: number,
  ) {
    const source = await this.getMessage(sourceConversationId, messageId);
    return this.sendMessage(
      targetConversationId,
      {
        clientMessageId: randomUUID(),
        type: 'text',
        content: content || source.content,
      },
      userId,
    );
  }

  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: number,
  ) {
    const tenantId = this.getTenantId();
    await this.getMessage(conversationId, messageId, tenantId, userId);
    const existing = await this.reactions.findOne({
      where: { tenantId, messageUuid: messageId, userId, emoji },
    });
    if (!existing)
      await this.reactions.save(
        this.reactions.create({
          tenantId,
          messageUuid: messageId,
          userId,
          emoji,
        }),
      );
    await this.publish(tenantId, 'message.updated', conversationId, {
      conversationId,
      messageId,
      reaction: { emoji, action: 'add', userId },
      native: false,
    });
    return { messageId, emoji, added: true, native: false };
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: number,
  ) {
    const tenantId = this.getTenantId();
    await this.getMessage(conversationId, messageId, tenantId, userId);
    await this.reactions.delete({
      tenantId,
      messageUuid: messageId,
      userId,
      emoji,
    });
    await this.publish(tenantId, 'message.updated', conversationId, {
      conversationId,
      messageId,
      reaction: { emoji, action: 'remove', userId },
      native: false,
    });
    return { messageId, emoji, removed: true, native: false };
  }

  async getContact(id: number) {
    const row = await this.contacts.findOne({
      where: { id, tenantId: this.getTenantId() },
    });
    if (!row) throw new NotFoundException('Contact identity not found');
    const crmContactId = row.crmPersonId || row.crmCustomerId;
    const crmCustomer = crmContactId
      ? await this.crm
          .detailCustomer(String(crmContactId))
          .catch(() => undefined)
      : undefined;
    return { ...this.mapContact(row), crmCustomer };
  }

  async patchContact(id: number, dto: ContactPatchDto) {
    const tenantId = this.getTenantId();
    const row = await this.contacts.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Contact identity not found');
    const { crmContactId, ...patch } = dto;
    Object.assign(row, patch);
    if (crmContactId !== undefined) {
      const crmCustomer = await this.crm.detailCustomer(crmContactId);
      const numericId = Number(crmCustomer.id);
      if (
        Number.isInteger(numericId) &&
        String(numericId) === String(crmCustomer.id)
      ) {
        row.crmCustomerId = numericId;
        row.crmPersonId = null;
      } else {
        row.crmCustomerId = null;
        row.crmPersonId = String(crmCustomer.id);
      }
      row.displayName = crmCustomer.name || row.displayName;
      row.phone = crmCustomer.phone || row.phone;
      row.email = crmCustomer.email || row.email;
    }
    await this.contacts.save(row);
    await this.publish(tenantId, 'contact.updated', String(id), {
      contact: this.mapContact(row),
    });
    return this.mapContact(row);
  }

  async contactConversations(id: number, userId: number) {
    const tenantId = this.getTenantId();
    const links = await this.conversations.find({
      where: { tenantId, contactIdentityId: id },
      order: { lastMessageAt: 'DESC' },
    });
    const page = await this.listConversations(
      { limit: 100 } as ConversationQueryDto,
      userId,
    );
    return page.items.filter((item: any) =>
      links.some((link) => link.libreDeskConversationUuid === item.id),
    );
  }

  private async lockConversationOrderLinks(
    manager: EntityManager,
    tenantId: number,
    conversationLinkId: number,
  ) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['cc-conversation-order', `${tenantId}:${conversationLinkId}`],
    );
  }

  private mapConversationOrderLink(
    row: CustomerCareConversationOrderLinkEntity,
  ) {
    return {
      id: row.id,
      conversationLinkId: row.conversationLinkId,
      contactIdentityId: row.contactIdentityId,
      orderId: row.orderId,
      relationType: row.relationType,
      sourceMessageId: row.sourceMessageId,
      creationKey: row.creationKey,
      isPrimary: row.isPrimary,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async conversationOrders(conversationId: string) {
    const tenantId = this.getTenantId();
    const conversation = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    const links = await this.conversationOrdersRepo.find({
      where: { tenantId, conversationLinkId: conversation.id },
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
    });

    return Promise.all(
      links.map(async (link) => ({
        ...(await this.orderService.detail(link.orderId)),
        conversationOrderLink: this.mapConversationOrderLink(link),
      })),
    );
  }

  async createConversationOrder(
    conversationId: string,
    dto: CreateOrderWithShipmentDto,
    userId: number,
    idempotencyKey?: string,
  ) {
    const tenantId = this.getTenantId();
    const conversation = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    const creationKey = idempotencyKey?.trim() || null;
    if (creationKey && creationKey.length > 120)
      throw new BadRequestException(
        'Idempotency-Key must not exceed 120 characters',
      );

    const verifiedShippingFee = dto.shipping
      ? await this.shippingService.verifiedFee(dto.shipping)
      : undefined;
    const { shipping, ...orderInput } = dto;
    const result = await this.dataSource.transaction(async (manager) => {
      await this.lockConversationOrderLinks(manager, tenantId, conversation.id);
      const repo = manager.getRepository(
        CustomerCareConversationOrderLinkEntity,
      );
      if (creationKey) {
        const existing = await repo.findOne({
          where: { tenantId, conversationLinkId: conversation.id, creationKey },
        });
        if (existing) {
          return {
            ...(await this.orderService.detail(existing.orderId, manager)),
            conversationOrderLink: this.mapConversationOrderLink(existing),
            idempotentReplay: true,
          };
        }
      }
      const order = await this.orderService.create(
        {
          ...orderInput,
          shippingFee: verifiedShippingFee ?? orderInput.shippingFee,
          source: `customer-care:${conversation.provider}`,
        },
        manager,
      );

      await repo.update(
        { tenantId, conversationLinkId: conversation.id, isPrimary: true },
        { isPrimary: false },
      );

      const link = await repo.save(
        repo.create({
          tenantId,
          conversationLinkId: conversation.id,
          contactIdentityId: conversation.contactIdentityId,
          orderId: Number(order.id),
          relationType: 'CREATED_FROM_CHAT',
          sourceMessageId: null,
          creationKey,
          isPrimary: true,
          createdByUserId: userId > 0 ? userId : null,
        }),
      );

      return {
        ...order,
        conversationOrderLink: this.mapConversationOrderLink(link),
        idempotentReplay: false,
      };
    });

    const shipment = shipping
      ? await this.shippingService.create(Number(result.id), shipping)
      : null;

    if (!result.idempotentReplay) {
      await this.publish(
        tenantId,
        'conversation-order.updated',
        conversationId,
        {
        conversationId,
        orderId: Number(result.id),
        action: 'created',
        link: result.conversationOrderLink,
        },
      );
    }
    return { ...result, shipment };
  }

  async linkConversationOrder(
    conversationId: string,
    orderId: number,
    dto: ConversationOrderLinkDto,
    userId: number,
  ) {
    const tenantId = this.getTenantId();
    const conversation = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    await this.orderService.detail(orderId);

    const link = await this.dataSource.transaction(async (manager) => {
      await this.lockConversationOrderLinks(manager, tenantId, conversation.id);
      const repo = manager.getRepository(
        CustomerCareConversationOrderLinkEntity,
      );
      const currentPrimary = await repo.findOne({
        where: {
          tenantId,
          conversationLinkId: conversation.id,
          isPrimary: true,
        },
      });
      const makePrimary = dto.isPrimary === true || !currentPrimary;
      if (makePrimary) {
        await repo.update(
          { tenantId, conversationLinkId: conversation.id, isPrimary: true },
          { isPrimary: false },
        );
      }

      let row = await repo.findOne({
        where: { tenantId, conversationLinkId: conversation.id, orderId },
      });
      if (!row) {
        row = repo.create({
          tenantId,
          conversationLinkId: conversation.id,
          contactIdentityId: conversation.contactIdentityId,
          orderId,
          relationType: dto.relationType ?? 'MANUAL',
          sourceMessageId: dto.sourceMessageId ?? null,
          isPrimary: makePrimary,
          createdByUserId: userId > 0 ? userId : null,
        });
      } else {
        if (dto.relationType !== undefined) row.relationType = dto.relationType;
        if (dto.sourceMessageId !== undefined)
          row.sourceMessageId = dto.sourceMessageId || null;
        if (makePrimary) row.isPrimary = true;
        if (conversation.contactIdentityId)
          row.contactIdentityId = conversation.contactIdentityId;
      }
      return repo.save(row);
    });

    await this.publish(tenantId, 'conversation-order.updated', conversationId, {
      conversationId,
      orderId,
      action: 'linked',
      link: this.mapConversationOrderLink(link),
    });
    return {
      ...(await this.orderService.detail(orderId)),
      conversationOrderLink: this.mapConversationOrderLink(link),
    };
  }

  async unlinkConversationOrder(conversationId: string, orderId: number) {
    const tenantId = this.getTenantId();
    const conversation = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    const removed = await this.dataSource.transaction(async (manager) => {
      await this.lockConversationOrderLinks(manager, tenantId, conversation.id);
      const repo = manager.getRepository(
        CustomerCareConversationOrderLinkEntity,
      );
      const row = await repo.findOne({
        where: { tenantId, conversationLinkId: conversation.id, orderId },
      });
      if (!row)
        throw new NotFoundException('Conversation order link not found');
      const wasPrimary = row.isPrimary;
      await repo.remove(row);

      if (wasPrimary) {
        const next = await repo.findOne({
          where: { tenantId, conversationLinkId: conversation.id },
          order: { createdAt: 'DESC' },
        });
        if (next) {
          next.isPrimary = true;
          await repo.save(next);
        }
      }
      return this.mapConversationOrderLink(row);
    });

    await this.publish(tenantId, 'conversation-order.updated', conversationId, {
      conversationId,
      orderId,
      action: 'unlinked',
    });
    return { deleted: true, link: removed };
  }

  async setPrimaryConversationOrder(conversationId: string, orderId: number) {
    const tenantId = this.getTenantId();
    const conversation = await this.requireConversationLink(
      conversationId,
      tenantId,
    );
    const link = await this.dataSource.transaction(async (manager) => {
      await this.lockConversationOrderLinks(manager, tenantId, conversation.id);
      const repo = manager.getRepository(
        CustomerCareConversationOrderLinkEntity,
      );
      const row = await repo.findOne({
        where: { tenantId, conversationLinkId: conversation.id, orderId },
      });
      if (!row)
        throw new NotFoundException('Conversation order link not found');
      await repo.update(
        { tenantId, conversationLinkId: conversation.id, isPrimary: true },
        { isPrimary: false },
      );
      row.isPrimary = true;
      return repo.save(row);
    });

    await this.publish(tenantId, 'conversation-order.updated', conversationId, {
      conversationId,
      orderId,
      action: 'primary',
      link: this.mapConversationOrderLink(link),
    });
    return this.mapConversationOrderLink(link);
  }

  async contactOrders(id: number) {
    const tenantId = this.getTenantId();
    const row = await this.contacts.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Contact identity not found');
    const where = row.crmPersonId
      ? { tenantId, personId: row.crmPersonId }
      : row.crmCustomerId
        ? { tenantId, customerId: row.crmCustomerId }
        : row.phone
          ? { tenantId, customerPhone: row.phone }
          : undefined;
    const orders = where
      ? await this.orders.find({
          where,
          order: { createdAt: 'DESC' },
          take: 50,
        })
      : [];
    const itemRows = orders.length
      ? await this.orderItems.find({
          where: { orderId: In(orders.map((order) => order.id)) },
        })
      : [];
    const shipmentRows = orders.length
      ? await this.shipments.find({
          where: { tenantId, orderId: In(orders.map((order) => order.id)) },
        })
      : [];
    const items = orders.map((order) => {
      const products = itemRows.filter((item) => item.orderId === order.id);
      return {
        id: order.code,
        orderId: order.id,
        status: order.status,
        businessStatus: order.businessStatus,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        totalPrice: Number(order.total),
        productName: products
          .map((item) => `${item.productName} (x${item.quantity})`)
          .join(', '),
        quantity: products.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt,
        shipment: (() => {
          const shipment = shipmentRows.find(
            (item) => item.orderId === order.id,
          );
          return shipment
            ? {
                ...shipment,
                fee: Number(shipment.fee),
                codAmount: Number(shipment.codAmount),
              }
            : null;
        })(),
      };
    });
    return {
      items,
      contact: this.mapContact(row),
      connected: Boolean(row.crmCustomerId || row.crmPersonId),
    };
  }

  async getAgentsRaw() {
    const value = await this.libreDesk.request<any>('/agents/compact');
    return Array.isArray(value) ? value : value?.results || [];
  }

  async agents() {
    return this.getAgentsRaw();
  }

  teams() {
    return this.libreDesk.request('/teams');
  }

  async tags() {
    const desired = [
      'Công việc',
      'Bạn bè',
      'Trả lời sau',
      'Đồng nghiệp',
      'Kiểm hàng',
      'Câu hỏi',
      'Mua hàng',
      'Đã gửi',
      'Hết hàng',
      'Trả hàng',
      'Khách hàng',
      'Gia đình',
    ];
    let available =
      await this.libreDesk.request<Array<{ id: number; name: string }>>(
        '/tags',
      );
    const names = new Set(
      available.map((tag) => tag.name.toLocaleLowerCase('vi')),
    );
    for (const name of desired) {
      if (names.has(name.toLocaleLowerCase('vi'))) continue;
      await this.libreDesk.request('/tags', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    }
    if (
      available.length !== desired.length ||
      desired.some((name) => !names.has(name.toLocaleLowerCase('vi')))
    )
      available =
        await this.libreDesk.request<Array<{ id: number; name: string }>>(
          '/tags',
        );
    return available;
  }

  async sync(query: SyncQueryDto) {
    const tenantId = this.getTenantId();
    const limit = Math.min(1000, query.limit || 500);
    const [earliest, latest] = await Promise.all([
      this.syncEvents.findOne({
        where: { tenantId },
        order: { sequence: 'ASC' },
      }),
      this.syncEvents.findOne({
        where: { tenantId },
        order: { sequence: 'DESC' },
      }),
    ]);
    const afterSequence = query.afterSequence || 0;
    if (
      afterSequence > 0 &&
      earliest &&
      afterSequence < earliest.sequence - 1
    ) {
      return {
        events: [],
        cursor: latest?.sequence || 0,
        hasMore: false,
        resetRequired: true,
        serverTime: new Date().toISOString(),
      };
    }
    const rows = await this.syncEvents.find({
      where: { tenantId, sequence: MoreThan(afterSequence) },
      order: { sequence: 'ASC' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      events: page.map((row) => ({
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
    };
  }

  verifyWebhook(
    rawBody: string,
    timestamp: string,
    signature: string,
    connectionKey: string,
  ) {
    const masterSecret =
      this.config.get<string>('CUSTOMER_CARE_WEBHOOK_SECRET') || '';
    if (!masterSecret)
      throw new ServiceUnavailableException(
        'Customer Care webhook secret is not configured',
      );
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000)
      throw new BadRequestException('Expired webhook timestamp');
    const channelSecret = createHmac('sha256', masterSecret)
      .update(`customer-care-channel:${connectionKey}`)
      .digest('hex');
    const expected = createHmac('sha256', channelSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const left = Buffer.from(expected);
    const right = Buffer.from(signature || '');
    if (left.length !== right.length || !timingSafeEqual(left, right))
      throw new BadRequestException('Invalid webhook signature');
  }

  async deliveryStatus(connectionKey: string, dto: CustomerCareDeliveryStatusDto) {
    const channel = await this.channels.findOne({
      where: { connectionKey, enabled: true },
    });
    if (!channel)
      throw new NotFoundException('Customer Care channel session not found');
    if (channel.provider !== dto.provider)
      throw new BadRequestException('Webhook provider does not match channel session');
    if (
      !channel.externalAccountId.startsWith('pending:') &&
      channel.externalAccountId !== dto.account_id
    )
      throw new BadRequestException('Webhook account does not match channel session');

    const tenantId = channel.tenantId;
    const link = await this.conversations.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        externalThreadId: dto.external_thread_id,
      },
    });
    if (!link) return { updated: 0, ignored: 1 };

    const ids = [...new Set([
      dto.external_message_id,
      ...(dto.external_message_ids || []),
    ].filter((value): value is string => Boolean(value?.trim())))]
      .map((value) => value.trim());

    let candidates: CustomerCareMessageLinkEntity[] = [];
    if (dto.client_message_id) {
      const byClientId = await this.messages.findOne({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          conversationLinkId: link.id,
          clientMessageId: dto.client_message_id,
        },
      });
      if (byClientId) candidates = [byClientId];
    }
    if (!candidates.length && ids.length) {
      candidates = await this.messages.find({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          conversationLinkId: link.id,
          externalMessageId: In(ids),
        },
      });
    }

    // Facebook Lightspeed readReceipt is watermark-based instead of carrying
    // message IDs. Only scan this one conversation and only rows at/before the
    // provider watermark; no cross-conversation status changes are possible.
    if (!candidates.length && dto.watermark_at) {
      const watermark = new Date(dto.watermark_at);
      if (!Number.isNaN(watermark.getTime())) {
        candidates = await this.messages.find({
          where: {
            tenantId,
            channelAccountId: channel.id,
            provider: dto.provider,
            conversationLinkId: link.id,
            createdAt: LessThanOrEqual(watermark),
          },
          order: { createdAt: 'DESC' },
          take: 500,
        });
      }
    }

    const occurredAt = this.safeCustomerCareDate(dto.occurred_at);
    let updated = 0;
    let ignored = 0;
    for (const row of candidates) {
      if (!this.isOutgoingMessageLink(row)) {
        ignored += 1;
        continue;
      }
      if (!this.canAdvanceDeliveryStatus(row.status, dto.status)) {
        ignored += 1;
        continue;
      }

      if (!row.externalMessageId && dto.external_message_id) {
        row.externalMessageId = dto.external_message_id;
      }
      row.status = dto.status;
      row.metadata = {
        ...(row.metadata || {}),
        direction: 'outgoing',
        ...(dto.status === 'delivered'
          ? { deliveredAt: occurredAt.toISOString() }
          : { readAt: occurredAt.toISOString() }),
        deliveryEventId: dto.event_id,
      };
      await this.messages.save(row);
      updated += 1;

      await this.publish(
        tenantId,
        'message.delivery.updated',
        link.libreDeskConversationUuid,
        {
          conversationId: link.libreDeskConversationUuid,
          messageId:
            row.libreDeskMessageUuid ||
            (row.clientMessageId ? `local:${row.clientMessageId}` : null),
          externalMessageId: row.externalMessageId,
          status: dto.status,
          occurredAt: occurredAt.toISOString(),
        },
      );
    }

    return {
      conversation_uuid: link.libreDeskConversationUuid,
      updated,
      ignored,
    };
  }

  private safeCustomerCareDate(value: string): Date {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private isOutgoingMessageLink(row: CustomerCareMessageLinkEntity): boolean {
    return row.metadata?.direction === 'outgoing' || Boolean(row.clientMessageId);
  }

  private canAdvanceDeliveryStatus(current: string, next: 'delivered' | 'read'): boolean {
    const rank: Record<string, number> = {
      queued: 0,
      pending: 0,
      sending: 1,
      sent: 2,
      delivered: 3,
      read: 4,
    };
    const currentRank = rank[String(current || '').toLowerCase()] ?? -1;
    const nextRank = rank[next];
    // failed/recalled/unknown are not overwritten by a late receipt unless the
    // row has already reached a normal transport state.
    return currentRank >= 0 && nextRank > currentRank;
  }

  async inbound(connectionKey: string, dto: ZaloInboundDto) {
    let channel = await this.channels.findOne({
      where: { connectionKey, enabled: true },
    });
    if (!channel)
      throw new NotFoundException('Customer Care channel session not found');
    if (channel.provider !== dto.provider)
      throw new BadRequestException(
        'Webhook provider does not match channel session',
      );
    if (
      !channel.externalAccountId.startsWith('pending:') &&
      channel.externalAccountId !== dto.account_id
    )
      throw new BadRequestException(
        'Webhook account does not match channel session',
      );
    if (channel.externalAccountId.startsWith('pending:')) {
      const existing = await this.channels.findOne({
        where: {
          tenantId: channel.tenantId,
          provider: channel.provider,
          externalAccountId: dto.account_id,
          enabled: true,
        },
      });
      if (existing && existing.id !== channel.id) {
        // A second login of the same social identity must not create another
        // conversation namespace. Process this last webhook against the
        // canonical account and retire the duplicate session.
        await this.cleanupDuplicateChannel(channel, existing.id);
        channel = existing;
      } else {
        channel.externalAccountId = dto.account_id;
        await this.channels.save(channel);
      }
    }
    // Security boundary: connector payloads never select a tenant. The opaque
    // connectionKey resolves the channel row, and the channel row owns tenantId.
    const tenantId = channel.tenantId;

    // Persist immediately after webhook HMAC + DTO validation. This makes
    // connector -> Nest failures observable even if channel/LibreDesk fails.
    let ingressEvent = await this.inboundEvents.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        eventId: dto.event_id,
      },
    });

    if (ingressEvent?.status === 'processed') {
      const result = ingressEvent.payload?.result as unknown as InboundResult;
      if (result?.conversation_uuid) return { ...result, duplicate: true };
    }

    if (!ingressEvent) {
      ingressEvent = await this.inboundEvents.save(
        this.inboundEvents.create({
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          eventId: dto.event_id,
          status: 'received',
          payload: {
            ...(dto as unknown as Record<string, unknown>),
            debug_stage: 'webhook_received',
          },
          lastError: null,
          processedAt: null,
        }),
      );
    } else {
      ingressEvent.status = 'received';
      ingressEvent.lastError = null;
      ingressEvent.payload = {
        ...(ingressEvent.payload || {}),
        ...(dto as unknown as Record<string, unknown>),
        debug_stage: 'webhook_received',
      };
      ingressEvent = await this.inboundEvents.save(ingressEvent);
    }

    try {
      ingressEvent.payload = {
        ...(ingressEvent.payload || {}),
        debug_stage: 'channel_resolved',
      };
      await this.inboundEvents.save(ingressEvent);

      if (dto.direction === 'outgoing' && dto.is_self) {
        return this.processExternalOutgoingMirror(
          dto,
          tenantId,
          channel,
          ingressEvent,
        );
      }

      // processInbound() reuses this same cc_inbound_event row.
      return this.processInbound(dto, tenantId, channel);
    } catch (error) {
      ingressEvent.status = 'failed';
      ingressEvent.lastError =
        error instanceof Error ? error.message : String(error);
      ingressEvent.payload = {
        ...(ingressEvent.payload || {}),
        debug_stage: 'failed',
      };
      await this.inboundEvents.save(ingressEvent).catch(() => undefined);
      throw error;
    }
  }

  private async processExternalOutgoingMirror(
    dto: ZaloInboundDto,
    tenantId: number,
    channel: CustomerCareChannelAccountEntity,
    event: CustomerCareInboundEventEntity,
  ) {
    event.payload = {
      ...(event.payload || {}),
      debug_stage: 'outgoing_mirror_started',
    };
    await this.inboundEvents.save(event);

    const existingMessage = await this.messages.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        externalMessageId: dto.external_message_id,
      },
    });

    let link = await this.conversations.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        externalThreadId: dto.external_thread_id,
      },
    });
    const restoredConversation = link
      ? await this.restoreDeletedConversationLink(link)
      : false;

    if (existingMessage) {
      const existingLink = existingMessage.conversationLinkId
        ? await this.conversations.findOne({
            where: { id: existingMessage.conversationLinkId, tenantId },
          })
        : link;
      if (!existingLink)
        throw new NotFoundException('Outgoing conversation link not found');
      const restoredExistingConversation =
        await this.restoreDeletedConversationLink(existingLink);
      if (restoredExistingConversation) {
        await this.publish(
          tenantId,
          'conversation.created',
          existingLink.libreDeskConversationUuid,
          { conversationId: existingLink.libreDeskConversationUuid },
        );
      }
      const result: InboundResult = {
        conversation_uuid: existingLink.libreDeskConversationUuid,
        message_uuid: existingMessage.libreDeskMessageUuid || undefined,
      };
      event.status = 'processed';
      event.processedAt = new Date();
      event.lastError = null;
      event.payload = {
        ...(event.payload || {}),
        debug_stage: 'processed',
        result,
      };
      await this.inboundEvents.save(event);
      return { ...result, duplicate: true };
    }

    const parsedOccurredAt = new Date(dto.occurred_at);
    const safeOccurredAt = Number.isNaN(parsedOccurredAt.getTime())
      ? new Date()
      : parsedOccurredAt;

    // Prefer an exact connector receipt when available. Both Zalo and Facebook
    // send client_message_id back with their native self-echo, so the ACK can
    // update the optimistic CSKH row without relying on text/time heuristics.
    if (dto.client_message_id) {
      const exactOriginal = await this.messages.findOne({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          clientMessageId: dto.client_message_id,
        },
      });
      if (exactOriginal) {
        const exactLink = exactOriginal.conversationLinkId
          ? await this.conversations.findOne({
              where: { id: exactOriginal.conversationLinkId, tenantId },
            })
          : link;
        if (exactLink) {
          const restoredExactConversation =
            await this.restoreDeletedConversationLink(exactLink);
          exactOriginal.externalMessageId = dto.external_message_id;
          exactOriginal.status = 'sent';
          exactOriginal.metadata = {
            ...(exactOriginal.metadata || {}),
            direction: 'outgoing',
            nativeAckAt: safeOccurredAt.toISOString(),
            nativeSource:
              dto.provider === 'facebook_personal'
                ? 'facebook_native'
                : 'zalo_native',
          };
          await this.messages.save(exactOriginal);
          exactLink.lastExternalMessageId = dto.external_message_id;
          exactLink.lastMessageAt = safeOccurredAt;
          await this.conversations.save(exactLink);

          if (restoredExactConversation) {
            await this.publish(
              tenantId,
              'conversation.created',
              exactLink.libreDeskConversationUuid,
              { conversationId: exactLink.libreDeskConversationUuid },
            );
          }

          const result: InboundResult = {
            conversation_uuid: exactLink.libreDeskConversationUuid,
            message_uuid: exactOriginal.libreDeskMessageUuid || undefined,
          };
          event.status = 'processed';
          event.processedAt = new Date();
          event.lastError = null;
          event.payload = {
            ...(event.payload || {}),
            debug_stage: 'outgoing_ack_reconciled_exact',
            result,
          };
          await this.inboundEvents.save(event);
          await this.publish(
            tenantId,
            'message.delivery.updated',
            exactLink.libreDeskConversationUuid,
            {
              conversationId: exactLink.libreDeskConversationUuid,
              messageId: exactOriginal.libreDeskMessageUuid,
              externalMessageId: dto.external_message_id,
              status: 'sent',
            },
          );
          return result;
        }
      }
    }

    // Backward compatibility for older connector events that do not carry a
    // client_message_id: match the recent optimistic message by content/time.
    if (link) {
      const candidates = await this.messages.find({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          conversationLinkId: link.id,
          externalMessageId: IsNull(),
          createdAt: MoreThanOrEqual(
            new Date(safeOccurredAt.getTime() - 60_000),
          ),
        },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      const echoedContent = dto.message.text.trim();
      const original = candidates.find(
        (candidate) =>
          Boolean(
            candidate.clientMessageId && candidate.libreDeskMessageUuid,
          ) &&
          String(candidate.metadata?.content || '').trim() === echoedContent,
      );
      if (original) {
        original.externalMessageId = dto.external_message_id;
        original.status = 'sent';
        original.metadata = {
          ...(original.metadata || {}),
          direction: 'outgoing',
          nativeAckAt: safeOccurredAt.toISOString(),
        };
        await this.messages.save(original);
        link.lastExternalMessageId = dto.external_message_id;
        link.lastMessageAt = safeOccurredAt;
        await this.conversations.save(link);

        const result: InboundResult = {
          conversation_uuid: link.libreDeskConversationUuid,
          message_uuid: original.libreDeskMessageUuid || undefined,
        };
        event.status = 'processed';
        event.processedAt = new Date();
        event.lastError = null;
        event.payload = {
          ...(event.payload || {}),
          debug_stage: 'outgoing_ack_reconciled',
          result,
        };
        await this.inboundEvents.save(event);
        await this.publish(
          tenantId,
          'message.delivery.updated',
          link.libreDeskConversationUuid,
          {
            conversationId: link.libreDeskConversationUuid,
            messageId: original.libreDeskMessageUuid,
            externalMessageId: dto.external_message_id,
            status: 'sent',
          },
        );
        return result;
      }
    }

    let contact = await this.contacts.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        externalId: dto.sender.external_id,
      },
    });
    if (!contact) {
      contact = await this.contacts.save(
        this.contacts.create({
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          externalId: dto.sender.external_id,
          displayName: dto.sender.display_name,
          avatarUrl: dto.sender.avatar_url || null,
          phone: null,
          email: null,
          note: null,
          crmCustomerId: null,
          crmPersonId: null,
          tags: [],
          metadata: {},
        }),
      );
    }

    // Persist through LibreDesk as well so its conversation list/preview is
    // updated. The local message link below overrides its direction to outgoing.
    const result = await this.libreDesk.inbound<InboundResult>(
      {
      tenant_key: String(tenantId),
      channel_connection_key: channel.connectionKey,
      account_id: dto.account_id,
      external_thread_id: dto.external_thread_id,
      external_message_id: dto.external_message_id,
      conversation_uuid: link?.libreDeskConversationUuid || '',
      thread_type: dto.thread_type,
      occurred_at: dto.occurred_at,
      sender: dto.sender,
      message: dto.message,
      },
      dto.provider,
    );
    const isNewConversation = !link || restoredConversation;

    if (!link) {
      link = await this.conversations.save(
        this.conversations.create({
          tenantId,
          channelAccountId: channel.id,
          contactIdentityId: contact.id,
          provider: dto.provider,
          externalThreadId: dto.external_thread_id,
          threadType: dto.thread_type,
          libreDeskConversationUuid: result.conversation_uuid,
          lastExternalMessageId: dto.external_message_id,
          lastMessageAt: safeOccurredAt,
          metadata: {},
        }),
      );
    } else {
      link.contactIdentityId ||= contact.id;
    }

    await this.messages.save(
      this.messages.create({
        tenantId,
        channelAccountId: channel.id,
        conversationLinkId: link.id,
        provider: dto.provider,
        externalMessageId: dto.external_message_id,
        clientMessageId: null,
        libreDeskMessageUuid: result.message_uuid || null,
        status: 'sent',
        metadata: {
          mirror: !result.message_uuid,
          source:
            dto.provider === 'facebook_personal'
              ? 'facebook_native'
              : 'zalo_native',
          direction: 'outgoing',
          content: dto.message.text,
          type: dto.message.type || 'text',
          createdAt: safeOccurredAt.toISOString(),
          senderName: 'Bạn',
          isSelf: true,
        },
      }),
    );

    link.lastExternalMessageId = dto.external_message_id;
    link.lastMessageAt = safeOccurredAt;
    await this.conversations.save(link);

    const message = {
      id: result.message_uuid || `mirror:${dto.external_message_id}`,
      conversationId: link.libreDeskConversationUuid,
      externalMessageId: dto.external_message_id,
      direction: 'outgoing',
      type: dto.message.type || 'text',
      content: dto.message.text,
      createdAt: safeOccurredAt.toISOString(),
      sender: { name: 'Bạn' },
      senderName: 'Bạn',
      status: 'sent',
      attachments: [],
      reactions: [],
    };

    event.status = 'processed';
    event.processedAt = new Date();
    event.lastError = null;
    event.payload = {
      ...(event.payload || {}),
      debug_stage: 'processed',
      result,
    };
    await this.inboundEvents.save(event);

    await this.publish(
      tenantId,
      isNewConversation ? 'conversation.created' : 'message.created',
      link.libreDeskConversationUuid,
      {
        conversationId: link.libreDeskConversationUuid,
        message,
      },
    );

    return result;
  }

  private async processInbound(
    dto: ZaloInboundDto,
    tenantId: number,
    channel: CustomerCareChannelAccountEntity,
  ) {
    const duplicate = await this.inboundEvents.findOne({
      where: {
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        eventId: dto.event_id,
      },
    });
    if (duplicate?.status === 'processed') {
      const data = duplicate.payload?.result as unknown as InboundResult;
      if (data?.conversation_uuid) return { ...data, duplicate: true };
      throw new ConflictException('Inbound event already processed');
    }
    let event =
      duplicate ||
      this.inboundEvents.create({
        tenantId,
        channelAccountId: channel.id,
        provider: dto.provider,
        eventId: dto.event_id,
        status: 'received',
        payload: dto as unknown as Record<string, unknown>,
        lastError: null,
        processedAt: null,
      });
    event = await this.inboundEvents.save(event);
    try {
      let contact = await this.contacts.findOne({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          externalId: dto.sender.external_id,
        },
      });
      if (!contact)
        contact = this.contacts.create({
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          externalId: dto.sender.external_id,
          displayName:
            dto.sender.display_name ||
            (dto.provider === 'facebook_personal'
              ? `Khách Facebook ${dto.sender.external_id}`
              : `Khách Zalo ${dto.sender.external_id}`),
          avatarUrl: dto.sender.avatar_url || null,
          phone: null,
          email: null,
          note: null,
          crmCustomerId: null,
          crmPersonId: null,
          tags: [],
          metadata: {},
        });
      else {
        if (dto.sender.display_name)
          contact.displayName = dto.sender.display_name;
        if (dto.sender.avatar_url) contact.avatarUrl = dto.sender.avatar_url;
      }
      contact = await this.contacts.save(contact);
      let link = await this.conversations.findOne({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          externalThreadId: dto.external_thread_id,
        },
      });
      const restoredConversation = link
        ? await this.restoreDeletedConversationLink(link)
        : false;
      const isNewConversation = !link || restoredConversation;
      const result = await this.libreDesk.inbound<InboundResult>(
        {
        tenant_key: String(tenantId),
        channel_connection_key: channel.connectionKey,
        account_id: dto.account_id,
        external_thread_id: dto.external_thread_id,
        external_message_id: dto.external_message_id,
        conversation_uuid: link?.libreDeskConversationUuid || '',
        thread_type: dto.thread_type,
        occurred_at: dto.occurred_at,
        sender: dto.sender,
        message: dto.message,
        },
        dto.provider,
      );
      if (!link)
        link = this.conversations.create({
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
        });
      else {
        link.contactIdentityId = contact.id;
        link.lastExternalMessageId = dto.external_message_id;
        link.lastMessageAt = new Date(dto.occurred_at);
      }
      link = await this.conversations.save(link);
      const existingMessage = await this.messages.findOne({
        where: {
          tenantId,
          channelAccountId: channel.id,
          provider: dto.provider,
          externalMessageId: dto.external_message_id,
        },
      });
      if (!existingMessage)
        await this.messages.save(
          this.messages.create({
            tenantId,
            channelAccountId: channel.id,
            conversationLinkId: link.id,
            provider: dto.provider,
            externalMessageId: dto.external_message_id,
            clientMessageId: null,
            libreDeskMessageUuid: result.message_uuid || null,
            status: 'delivered',
            metadata: {},
          }),
        );
      event.status = 'processed';
      event.processedAt = new Date();
      event.payload = {
        ...(dto as unknown as Record<string, unknown>),
        debug_stage: 'processed',
        result,
      };
      event.lastError = null;
      await this.inboundEvents.save(event);
      const message = {
        id: result.message_uuid || dto.external_message_id,
        conversationId: result.conversation_uuid,
        externalMessageId: dto.external_message_id,
        direction: 'incoming',
        type: dto.message.type || 'text',
        content: dto.message.text,
        createdAt: dto.occurred_at,
        sender: {
          id: String(contact.id),
          externalId: contact.externalId,
          name: contact.displayName,
          avatar: contact.avatarUrl || undefined,
        },
        senderName: contact.displayName,
        senderAvatar: contact.avatarUrl || undefined,
        status: 'delivered',
        attachments: [],
        reactions: [],
      };
      await this.publish(
        tenantId,
      isNewConversation ? 'conversation.created' : 'message.created',
        result.conversation_uuid,
        {
          conversationId: result.conversation_uuid,
          message,
          contact: this.mapContact(contact),
        },
      );
      return result;
    } catch (error) {
      event.status = 'failed';
      event.lastError = error instanceof Error ? error.message : String(error);
      event.payload = {
        ...(event.payload || {}),
        debug_stage: 'failed',
      };
      await this.inboundEvents.save(event);
      throw error;
    }
  }

  async flushOutbox() {
    const rows = await this.outbox.find({
      where: {
        status: In(['pending', 'retrying']),
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      order: { id: 'ASC' },
      take: 20,
    });
    for (const row of rows) {
      row.status = 'retrying';
      row.attemptCount += 1;
      await this.outbox.save(row);
      try {
        if (row.type === 'message.send') {
          const { conversationId, dto, userId } = row.payload as any;
          await this.sendMessage(
            conversationId,
            dto,
            userId,
            true,
            row.tenantId,
          );
        }
        row.status = 'completed';
        row.lastError = null;
      } catch (error) {
        row.status = row.attemptCount >= 10 ? 'dead' : 'pending';
        row.lastError = error instanceof Error ? error.message : String(error);
        row.nextRetryAt = new Date(
          Date.now() + Math.min(300_000, 2 ** row.attemptCount * 1000),
        );
      }
      await this.outbox.save(row);
    }
  }

  private async publish(
    tenantId: number,
    type: string,
    aggregateId: string | null,
    payload: Record<string, unknown>,
  ) {
    const event = await this.syncEvents.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1::bigint)', [
        tenantId,
      ]);
      const raw = await manager
        .getRepository(CustomerCareSyncEventEntity)
        .createQueryBuilder('event')
        .select('COALESCE(MAX(event.sequence), 0)', 'max')
        .where('event.tenant_id = :tenantId', { tenantId })
        .getRawOne<{ max: string | number }>();
      const sequence = Number(raw?.max || 0) + 1;
      const saved = await manager
        .getRepository(CustomerCareSyncEventEntity)
        .save(
        manager.getRepository(CustomerCareSyncEventEntity).create({
          tenantId,
          sequence,
          eventId: randomUUID(),
          type,
          aggregateId,
          payload,
        }),
      );
      const domainType = this.customerCareDomainEventType(type, payload);
      if (domainType && aggregateId) {
        await this.domainEvents.append(
          {
          tenantId,
            aggregateType: type.startsWith('contact.')
              ? 'contact'
              : 'conversation',
          aggregateId,
          eventType: domainType,
            payload: {
              ...payload,
              conversationId: type.startsWith('contact.')
                ? undefined
                : aggregateId,
            },
            availableAt:
              domainType === 'customer-care.message.inbound'
            ? new Date(Date.now() + this.customerCareAiDebounceMs())
            : undefined,
          },
          manager,
        );
      }
      return saved;
    });
    const envelope = {
      eventId: event.eventId,
      sequence: event.sequence,
      type,
      aggregateId,
      occurredAt: event.createdAt.toISOString(),
      data: payload,
    };
    if (
      aggregateId &&
      (type.startsWith('message.') ||
        type.startsWith('conversation.') ||
        type.startsWith('typing.'))
    )
      this.gateway.emitConversation(tenantId, aggregateId, type, envelope);
    else this.gateway.emitTenant(tenantId, type, envelope);
    return event;
  }

  private customerCareAiDebounceMs() {
    const value = Number(process.env.CUSTOMER_CARE_AI_DEBOUNCE_MS ?? 2_500);
    return Number.isFinite(value)
      ? Math.max(1_000, Math.min(30_000, value))
      : 2_500;
  }

  private customerCareDomainEventType(
    type: string,
    payload: Record<string, unknown>,
  ): string | null {
    if (type === 'message.created' || type === 'conversation.created') {
      const message = payload.message as { direction?: string } | undefined;
      if (message?.direction === 'incoming')
        return 'customer-care.message.inbound';
      if (message?.direction === 'outgoing')
        return 'customer-care.message.outbound';
    }
    if (type === 'contact.updated') {
      return 'customer-care.contact.linked';
    }
    if (type === 'conversation-order.updated') {
      return 'conversation-order.linked';
    }
    return null;
  }

  async cleanupOperationalEvents() {
    const now = Date.now();
    const syncCutoff = new Date(now - 30 * 24 * 60 * 60_000);
    const auditCutoff = new Date(now - 45 * 24 * 60 * 60_000);
    const outboxCutoff = new Date(now - 14 * 24 * 60 * 60_000);
    await Promise.all([
      this.syncEvents.delete({ createdAt: LessThan(syncCutoff) }),
      this.inboundEvents.delete({
        createdAt: LessThan(auditCutoff),
        status: 'processed',
      }),
      this.outbox.delete({
        createdAt: LessThan(outboxCutoff),
        status: In(['completed', 'dead']),
      }),
    ]).catch((error) =>
      this.logger.warn(
        `Customer Care cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  private mapConversation(
    item: LibreDeskConversation,
    agents: Map<number, any>,
    preference?: CustomerCareConversationPreferenceEntity,
    identity?: CustomerCareContactIdentityEntity,
    link?: CustomerCareConversationLinkEntity,
    channelAccount?: CustomerCareChannelAccountEntity,
  ) {
    const assigned = item.assigned_user_id
      ? agents.get(Number(item.assigned_user_id))
      : undefined;
    const customerName =
      identity?.displayName ||
      fullName(item.contact?.first_name, item.contact?.last_name);
    const channel = mapChannel(
      item.inbox_channel || link?.provider || 'website',
    );
    return {
      id: item.uuid,
      externalThreadId: link?.externalThreadId,
      threadType: link?.threadType || 'user',
      customer: identity
        ? this.mapContact(identity)
        : {
            id: `libredesk:${item.uuid}`,
            externalId: undefined,
            provider: link?.provider,
            name: customerName,
            avatar: item.contact?.avatar_url || undefined,

            // Giữ cùng shape với mapContact()
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
      channelProvider: link?.provider || item.inbox_channel || undefined,
      channelAccountId: link?.channelAccountId
        ? String(link.channelAccountId)
        : undefined,
      channelAccountName:
        channelAccount?.name ||
        item.inbox_name ||
        (channel === 'zalo' ? 'Zalo cá nhân' : channel),
      channelName:
        channelAccount?.name ||
        item.inbox_name ||
        (channel === 'zalo' ? 'Zalo cá nhân' : channel),
      status: mapConversationStatus(
        item.status,
        item.unread_message_count || 0,
      ),
      priority: item.priority || 'normal',
      lastMessage:
        stripHtml(item.last_message) || item.subject || 'Chưa có tin nhắn',
      lastMessageAt: item.last_message_at || item.updated_at,
      unreadCount: item.unread_message_count || 0,
      waitingSince: item.waiting_since || undefined,
      tags: (item.tags || []).map(normalizeConversationTag),
      assignee: assigned,
      teamId: item.assigned_team_id ? String(item.assigned_team_id) : undefined,
      pinned: preference?.pinned || false,
      muted: preference?.muted || false,
      archived: preference?.archived || false,
      updatedAt: item.updated_at,
    };
  }

  private mapMessage(
    item: LibreDeskMessage,
    reactions?: Record<string, { count: number; reactedByMe: boolean }>,
    link?: CustomerCareMessageLinkEntity,
  ) {
    const linkedDirection =
      typeof link?.metadata?.direction === 'string'
        ? normalize(link.metadata.direction)
        : '';
    const incoming = linkedDirection
      ? linkedDirection !== 'outgoing'
      : normalize(item.type) === 'incoming' ||
        normalize(item.sender_type) === 'contact';
    const senderName = fullName(
      item.author?.first_name,
      item.author?.last_name,
    );
    return {
      id: item.uuid,
      conversationId: item.conversation_uuid,
      clientMessageId: link?.clientMessageId || undefined,
      externalMessageId: link?.externalMessageId || item.source_id || undefined,
      direction: incoming ? 'incoming' : 'outgoing',
      type: item.attachments?.some((row) =>
        row.content_type?.startsWith('image/'),
      )
        ? 'image'
        : item.attachments?.length
          ? 'file'
          : 'text',
      content: stripHtml(item.text_content || item.content),
      createdAt: item.created_at,
      sender: {
        name:
          senderName === 'Khách hàng' && !incoming ? 'Nhân viên' : senderName,
        avatar: item.author?.avatar_url || undefined,
      },
      senderName:
        senderName === 'Khách hàng' && !incoming ? 'Nhân viên' : senderName,
      senderAvatar: item.author?.avatar_url || undefined,
      status:
        link?.status === 'recalled' || link?.metadata?.recalled === true
          ? 'recalled'
          : mapMessageStatus(item.status, incoming),
      attachments: (item.attachments || []).map((attachment) => ({
        id: attachment.uuid,
        name: attachment.name,
        type: attachment.content_type?.startsWith('image/') ? 'image' : 'file',
        mimeType: attachment.content_type,
        url: attachment.url,
        thumbnailUrl: attachment.thumbnail_url,
      })),
      replyTo:
        typeof link?.metadata?.replyToMessageId === 'string' &&
        link.metadata.replyToMessageId
          ? {
              id: link.metadata.replyToMessageId,
              content: 'Tin nhắn được trả lời',
            }
          : undefined,
      reactions: Object.entries(reactions || {}).map(([emoji, value]) => ({
        emoji,
        count: value.count,
        reactedByMe: value.reactedByMe,
      })),
      recalled:
        link?.status === 'recalled' || link?.metadata?.recalled === true,
    };
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
      crmContactId: row.crmPersonId || row.crmCustomerId || undefined,
      totalOrders: 0,
      totalSpent: 0,
      tags: (row.tags || []).map((tag) => ({
        id: String(tag.id),
        name: tag.name,
        color: tag.color || '#84cc16',
      })),
    };
  }
}

function normalize(value?: string | null) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[\s-]+/g, '_');
}

function customerCareTagColor(name: string) {
  const colors: Record<string, string> = {
    'công việc': '#92501f',
    'bạn bè': '#8a7418',
    'trả lời sau': '#357058',
    'đồng nghiệp': '#245493',
    'kiểm hàng': '#354156',
    'câu hỏi': '#583475',
    'mua hàng': '#24549a',
    'đã gửi': '#08623d',
    'hết hàng': '#175775',
    'trả hàng': '#9b3432',
    'khách hàng': '#8d2735',
    'gia đình': '#87205f',
  };
  return colors[name.toLocaleLowerCase('vi')] || '#65a30d';
}

function normalizeConversationTag(
  tag: string | { id?: number | string; name?: string; color?: string },
) {
  const name =
    typeof tag === 'string'
    ? tag.trim()
    : String(tag.name ?? tag.id ?? '').trim();
  return {
    id: typeof tag === 'string' ? name : String(tag.id ?? name),
    name,
    color:
      (typeof tag === 'string' ? undefined : tag.color) ||
      customerCareTagColor(name),
  };
}

function mapChannel(value: string) {
  const key = normalize(value);
  if (key.includes('zalo')) return 'zalo';
  if (key.includes('facebook')) return 'facebook';
  if (key.includes('telegram')) return 'telegram';
  if (key.includes('instagram')) return 'instagram';
  if (key.includes('whatsapp')) return 'whatsapp';
  if (key.includes('tiktok')) return 'tiktok';
  return 'website';
}

function mapConversationStatus(
  value: string | null | undefined,
  unreadCount: number,
) {
  if (unreadCount > 0) return 'unread';
  const key = normalize(value);
  if (key === 'resolved' || key === 'closed') return 'resolved';
  if (['pending', 'snoozed', 'waiting'].includes(key)) return 'pending';
  return 'open';
}

function mapMessageStatus(value: string, incoming: boolean) {
  if (incoming) return 'delivered';
  const key = normalize(value);
  if (key === 'failed') return 'failed';
  if (['pending', 'queued', 'processing'].includes(key)) return 'sending';
  if (key === 'read') return 'read';
  if (key === 'delivered') return 'delivered';
  return 'sent';
}

function fullName(firstName?: string, lastName?: string) {
  return `${firstName || ''} ${lastName || ''}`.trim() || 'Khách hàng';
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
    .trim();
}
