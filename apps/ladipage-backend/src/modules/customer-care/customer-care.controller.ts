import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, Public, TenantGuard } from '@liora/nest-core';
import { Bypass } from '@liora/nest-core/common/decorators/bypass.decorator';

import {
  AssignDto,
  ContactPatchDto,
  ConversationPatchDto,
  ConversationQueryDto,
  CreateChannelDto,
  CreateConversationDto,
  DraftDto,
  ForwardDto,
  FacebookLoginDto,
  MessageQueryDto,
  SendMessageDto,
  SyncQueryDto,
  TagsDto,
  TeamDto,
  ZaloInboundDto,
} from './customer-care.dto';
import { CustomerCareService } from './customer-care.service';
function uid(user: any) {
  return Number(user?.uid || user?.id || 0);
}

@ApiTags('Customer Care')
@ApiBearerAuth()
@Controller('customer-care')
@UseGuards(TenantGuard)
@SkipThrottle()
export class CustomerCareController {
  constructor(private readonly service: CustomerCareService) {}

  @Get('health') health() {
    return this.service.health();
  }
  @Get('capabilities')
  capabilities() {
    return this.service.capabilities();
  }

  @Get('channels') channels() {
    return this.service.listChannels();
  }
  @Post('channels')
  createChannel(@Body() dto: CreateChannelDto) {
    return this.service.createChannel(dto);
  }
  @Delete('channels/:id')
  deleteChannel(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteChannel(id);
  }
  @Get('channels/:id/status')
  channelStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.getChannelStatus(id);
  }
  @Get('channels/:id/qr')
  @Bypass()
  async channelQr(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const qr = await this.service.getChannelQr(id);
    reply.header('Content-Type', qr.contentType);
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return qr.bytes;
  }
  @Post('channels/:id/session/reset')
  @HttpCode(HttpStatus.OK)
  resetChannel(@Param('id', ParseIntPipe) id: number) {
    return this.service.resetChannel(id);
  }
  @Delete('channels/:id/session')
  disconnectChannel(@Param('id', ParseIntPipe) id: number) {
    return this.service.disconnectChannel(id);
  }
  @Post('channels/:id/facebook/session')
  @HttpCode(HttpStatus.OK)
  loginFacebook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FacebookLoginDto,
  ) {
    return this.service.loginFacebook(id, dto.cookie);
  }

  @Get('conversations') listConversations(
    @Query() query: ConversationQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.listConversations(query, uid(user));
  }
  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto) {
    return this.service.createConversation(dto);
  }
  @Get('conversations/:id') getConversation(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getConversation(id, uid(user));
  }
  @Patch('conversations/:id')
  patchConversation(
    @Param('id') id: string,
    @Body() dto: ConversationPatchDto,
    @CurrentUser() user: any,
  ) {
    return this.service.patchConversation(id, dto, uid(user));
  }
  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  read(@Param('id') id: string) {
    return this.service.markRead(id);
  }
  @Post('conversations/:id/unread')
  @HttpCode(HttpStatus.OK)
  unread(@Param('id') id: string) {
    return this.service.markUnread(id);
  }

  @Put('conversations/:id/assignee')
  setAssignee(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.service.setAssignee(id, dto.assigneeId);
  }
  @Delete('conversations/:id/assignee')
  removeAssignee(@Param('id') id: string) {
    return this.service.setAssignee(id, null);
  }
  @Put('conversations/:id/team') setTeam(
    @Param('id') id: string,
    @Body() dto: TeamDto,
  ) {
    return this.service.setTeam(id, dto.teamId);
  }
  @Delete('conversations/:id/team')
  removeTeam(@Param('id') id: string) {
    return this.service.setTeam(id, null);
  }
  @Put('conversations/:id/tags')
  setTags(@Param('id') id: string, @Body() dto: TagsDto) {
    return this.service.setTags(id, dto.tags, dto.action);
  }
  @Get('conversations/:id/participants') participants(@Param('id') id: string) {
    return this.service.participants(id);
  }
  @Get('conversations/:id/previous') previous(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.previousConversations(id, uid(user));
  }

  @Get('conversations/:id/draft') draft(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getDraft(id, uid(user));
  }
  @Put('conversations/:id/draft')
  saveDraft(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: DraftDto,
  ) {
    return this.service.saveDraft(id, uid(user), dto);
  }
  @Delete('conversations/:id/draft')
  deleteDraft(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.deleteDraft(id, uid(user));
  }

  @Get('conversations/:id/messages') messages(
    @Param('id') id: string,
    @Query() query: MessageQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.listMessages(id, query, uid(user));
  }
  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey && idempotencyKey !== dto.clientMessageId)
      dto.clientMessageId = idempotencyKey;
    return this.service.sendMessage(id, dto, uid(user));
  }
  @Post('media')
  async uploadMedia(@Req() req: FastifyRequest) {
    if (!(req as any).isMultipart())
      throw new BadRequestException('Request must be multipart/form-data');
    const file = await (req as any).file();
    if (!file) throw new BadRequestException('File is required');
    return this.service.uploadMedia(file);
  }
  @Get('conversations/:id/messages/:messageId') message(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getMessage(id, messageId, undefined, uid(user));
  }
  @Post('conversations/:id/messages/:messageId/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Param('id') id: string, @Param('messageId') messageId: string) {
    return this.service.retryMessage(id, messageId);
  }
  @Post('conversations/:id/messages/:messageId/forward')
  forward(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: ForwardDto,
    @CurrentUser() user: any,
  ) {
    return this.service.forwardMessage(
      id,
      messageId,
      dto.targetConversationId,
      dto.content,
      uid(user),
    );
  }
  @Post('conversations/:id/messages/:messageId/recall')
  @HttpCode(HttpStatus.OK)
  recall(@Param('id') id: string, @Param('messageId') messageId: string) {
    return this.service.recallMessage(id, messageId);
  }
  @Put('conversations/:id/messages/:messageId/reactions/:emoji')
  react(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: any,
  ) {
    return this.service.addReaction(id, messageId, emoji, uid(user));
  }
  @Delete('conversations/:id/messages/:messageId/reactions/:emoji')
  unreact(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: any,
  ) {
    return this.service.removeReaction(id, messageId, emoji, uid(user));
  }

  @Get('contacts/:id') contact(@Param('id', ParseIntPipe) id: number) {
    return this.service.getContact(id);
  }
  @Patch('contacts/:id')
  patchContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContactPatchDto,
  ) {
    return this.service.patchContact(id, dto);
  }
  @Get('contacts/:id/conversations') contactConversations(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.service.contactConversations(id, uid(user));
  }
  @Get('contacts/:id/orders') contactOrders(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.contactOrders(id);
  }
  @Put('contacts/:id/tags')
  contactTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ContactPatchDto,
  ) {
    return this.service.patchContact(id, dto);
  }

  @Get('agents') agents() {
    return this.service.agents();
  }
  @Get('teams') teams() {
    return this.service.teams();
  }
  @Get('tags') tags() {
    return this.service.tags();
  }
  @Get('sync') sync(@Query() query: SyncQueryDto) {
    return this.service.sync(query);
  }
}

@Public()
@Controller('internal/customer-care')
@SkipThrottle()
export class CustomerCareInternalController {
  constructor(private readonly service: CustomerCareService) {}

  @Post('channels/:connectionKey/events')
  @HttpCode(HttpStatus.OK)
  async connectorEvent(
    @Param('connectionKey') connectionKey: string,
    @Req() req: FastifyRequest & { rawBody?: string | Buffer },
    @Body() dto: ZaloInboundDto,
    @Headers('x-customer-care-timestamp') timestamp: string,
    @Headers('x-customer-care-signature') signature: string,
  ) {
    const rawBody = typeof req.rawBody === 'string'
      ? req.rawBody
      : Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : JSON.stringify(dto);
    this.service.verifyWebhook(rawBody, timestamp, signature, connectionKey);
    return this.service.inbound(connectionKey, dto);
  }
}
