// import {
//   Body,
//   Controller,
//   Delete,
//   Get,
//   Headers,
//   HttpCode,
//   HttpStatus,
//   Param,
//   ParseIntPipe,
//   Patch,
//   Post,
//   Put,
//   Query,
//   Req,
//   Res,
//   UseGuards,
// } from '@nestjs/common'
// import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
// import type { FastifyReply, FastifyRequest } from 'fastify'
// import { CurrentUser, Public, TenantGuard } from '@liora/nest-core'
// import { Perm } from '@liora/nest-core/modules/auth/decorators/permission.decorator'
// import { Bypass } from '@liora/nest-core/common/decorators/bypass.decorator'

// import {
//   AssignDto,
//   ContactPatchDto,
//   ConversationPatchDto,
//   ConversationQueryDto,
//   CreateConversationDto,
//   DraftDto,
//   ForwardDto,
//   MessageQueryDto,
//   SendMessageDto,
//   SyncQueryDto,
//   TagsDto,
//   TeamDto,
//   ZaloInboundDto,
// } from './customer-care.dto'
// import { CustomerCareService } from './customer-care.service'
// import { CustomerCarePermissions } from './customer-care.permissions'

// function uid(user: any) {
//   return Number(user?.uid || user?.id || 0)
// }

// @ApiTags('Customer Care')
// @ApiBearerAuth()
// @Controller('customer-care')
// @UseGuards(TenantGuard)
// @Perm(CustomerCarePermissions.CONVERSATION_READ)
// export class CustomerCareController {
//   constructor(private readonly service: CustomerCareService) {}

//   @Get('health') @Perm(CustomerCarePermissions.CHANNEL_READ) health() { return this.service.health() }
//   @Get('capabilities') @Perm(CustomerCarePermissions.CONVERSATION_READ) capabilities() { return this.service.capabilities() }

//   @Get('channels') @Perm(CustomerCarePermissions.CHANNEL_READ) channels() { return this.service.listChannels() }
//   @Get('channels/:id/status') @Perm(CustomerCarePermissions.CHANNEL_READ) channelStatus(@Param('id', ParseIntPipe) id: number) { return this.service.getChannelStatus(id) }
//   @Get('channels/:id/qr')
//   @Bypass()
//   @Perm(CustomerCarePermissions.CHANNEL_READ)
//   async channelQr(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
//     const qr = await this.service.getChannelQr(id)
//     reply.header('Content-Type', qr.contentType)
//     reply.header('Cache-Control', 'no-store, no-cache, must-revalidate')
//     return qr.bytes
//   }
//   @Post('channels/:id/session/reset') @HttpCode(HttpStatus.OK)
//   @Perm(CustomerCarePermissions.CHANNEL_MANAGE)
//   resetChannel(@Param('id', ParseIntPipe) id: number) { return this.service.resetChannel(id) }
//   @Delete('channels/:id/session') @Perm(CustomerCarePermissions.CHANNEL_MANAGE) disconnectChannel(@Param('id', ParseIntPipe) id: number) { return this.service.disconnectChannel(id) }

//   @Get('conversations') listConversations(@Query() query: ConversationQueryDto, @CurrentUser() user: any) {
//     return this.service.listConversations(query, uid(user))
//   }
//   @Post('conversations') @Perm(CustomerCarePermissions.CONVERSATION_WRITE) createConversation(@Body() dto: CreateConversationDto) { return this.service.createConversation(dto) }
//   @Get('conversations/:id') getConversation(@Param('id') id: string, @CurrentUser() user: any) { return this.service.getConversation(id, uid(user)) }
//   @Patch('conversations/:id') @Perm(CustomerCarePermissions.CONVERSATION_WRITE) patchConversation(@Param('id') id: string, @Body() dto: ConversationPatchDto, @CurrentUser() user: any) {
//     return this.service.patchConversation(id, dto, uid(user))
//   }
//   @Post('conversations/:id/read') @HttpCode(HttpStatus.OK) @Perm(CustomerCarePermissions.CONVERSATION_WRITE) read(@Param('id') id: string) { return this.service.markRead(id) }
//   @Post('conversations/:id/unread') @HttpCode(HttpStatus.OK) @Perm(CustomerCarePermissions.CONVERSATION_WRITE) unread(@Param('id') id: string) { return this.service.markUnread(id) }

//   @Put('conversations/:id/assignee') @Perm(CustomerCarePermissions.ASSIGN) setAssignee(@Param('id') id: string, @Body() dto: AssignDto) { return this.service.setAssignee(id, dto.assigneeId) }
//   @Delete('conversations/:id/assignee') @Perm(CustomerCarePermissions.ASSIGN) removeAssignee(@Param('id') id: string) { return this.service.setAssignee(id, null) }
//   @Put('conversations/:id/team') @Perm(CustomerCarePermissions.ASSIGN) setTeam(@Param('id') id: string, @Body() dto: TeamDto) { return this.service.setTeam(id, dto.teamId) }
//   @Delete('conversations/:id/team') @Perm(CustomerCarePermissions.ASSIGN) removeTeam(@Param('id') id: string) { return this.service.setTeam(id, null) }
//   @Put('conversations/:id/tags') @Perm(CustomerCarePermissions.CONVERSATION_WRITE) setTags(@Param('id') id: string, @Body() dto: TagsDto) { return this.service.setTags(id, dto.tags, dto.action) }
//   @Get('conversations/:id/participants') participants(@Param('id') id: string) { return this.service.participants(id) }
//   @Get('conversations/:id/previous') previous(@Param('id') id: string, @CurrentUser() user: any) { return this.service.previousConversations(id, uid(user)) }

//   @Get('conversations/:id/draft') draft(@Param('id') id: string, @CurrentUser() user: any) { return this.service.getDraft(id, uid(user)) }
//   @Put('conversations/:id/draft') @Perm(CustomerCarePermissions.CONVERSATION_WRITE) saveDraft(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: DraftDto) { return this.service.saveDraft(id, uid(user), dto) }
//   @Delete('conversations/:id/draft') @Perm(CustomerCarePermissions.CONVERSATION_WRITE) deleteDraft(@Param('id') id: string, @CurrentUser() user: any) { return this.service.deleteDraft(id, uid(user)) }

//   @Get('conversations/:id/messages') messages(@Param('id') id: string, @Query() query: MessageQueryDto, @CurrentUser() user: any) { return this.service.listMessages(id, query, uid(user)) }
//   @Post('conversations/:id/messages')
//   @Perm(CustomerCarePermissions.MESSAGE_SEND)
//   sendMessage(
//     @Param('id') id: string,
//     @Body() dto: SendMessageDto,
//     @CurrentUser() user: any,
//     @Headers('idempotency-key') idempotencyKey?: string,
//   ) {
//     if (idempotencyKey && idempotencyKey !== dto.clientMessageId) dto.clientMessageId = idempotencyKey
//     return this.service.sendMessage(id, dto, uid(user))
//   }
//   @Get('conversations/:id/messages/:messageId') message(@Param('id') id: string, @Param('messageId') messageId: string, @CurrentUser() user: any) { return this.service.getMessage(id, messageId, undefined, uid(user)) }
//   @Post('conversations/:id/messages/:messageId/retry') @HttpCode(HttpStatus.OK)
//   @Perm(CustomerCarePermissions.MESSAGE_SEND)
//   retry(@Param('id') id: string, @Param('messageId') messageId: string) { return this.service.retryMessage(id, messageId) }
//   @Post('conversations/:id/messages/:messageId/forward')
//   @Perm(CustomerCarePermissions.MESSAGE_SEND)
//   forward(@Param('id') id: string, @Param('messageId') messageId: string, @Body() dto: ForwardDto, @CurrentUser() user: any) {
//     return this.service.forwardMessage(id, messageId, dto.targetConversationId, dto.content, uid(user))
//   }
//   @Post('conversations/:id/messages/:messageId/recall') @HttpCode(HttpStatus.OK)
//   @Perm(CustomerCarePermissions.MESSAGE_SEND)
//   recall(@Param('id') id: string, @Param('messageId') messageId: string) { return this.service.recallMessage(id, messageId) }
//   @Put('conversations/:id/messages/:messageId/reactions/:emoji')
//   @Perm(CustomerCarePermissions.MESSAGE_SEND)
//   react(@Param('id') id: string, @Param('messageId') messageId: string, @Param('emoji') emoji: string, @CurrentUser() user: any) { return this.service.addReaction(id, messageId, emoji, uid(user)) }
//   @Delete('conversations/:id/messages/:messageId/reactions/:emoji')
//   @Perm(CustomerCarePermissions.MESSAGE_SEND)
//   unreact(@Param('id') id: string, @Param('messageId') messageId: string, @Param('emoji') emoji: string, @CurrentUser() user: any) { return this.service.removeReaction(id, messageId, emoji, uid(user)) }

//   @Get('contacts/:id') contact(@Param('id', ParseIntPipe) id: number) { return this.service.getContact(id) }
//   @Patch('contacts/:id') @Perm(CustomerCarePermissions.CONTACT_UPDATE) patchContact(@Param('id', ParseIntPipe) id: number, @Body() dto: ContactPatchDto) { return this.service.patchContact(id, dto) }
//   @Get('contacts/:id/conversations') contactConversations(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.contactConversations(id, uid(user)) }
//   @Get('contacts/:id/orders') contactOrders(@Param('id', ParseIntPipe) id: number) { return this.service.contactOrders(id) }
//   @Put('contacts/:id/tags') @Perm(CustomerCarePermissions.CONTACT_UPDATE) contactTags(@Param('id', ParseIntPipe) id: number, @Body() dto: ContactPatchDto) { return this.service.patchContact(id, dto) }

//   @Get('agents') agents() { return this.service.agents() }
//   @Get('teams') teams() { return this.service.teams() }
//   @Get('tags') tags() { return this.service.tags() }
//   @Get('sync') sync(@Query() query: SyncQueryDto) { return this.service.sync(query) }
// }

// @Public()
// @Controller('internal/customer-care')
// export class CustomerCareInternalController {
//   constructor(private readonly service: CustomerCareService) {}

//   @Post('zalo/events')
//   @HttpCode(HttpStatus.OK)
//   async zaloEvent(
//     @Req() req: FastifyRequest & { rawBody?: string | Buffer },
//     @Body() dto: ZaloInboundDto,
//     @Headers('x-customer-care-timestamp') timestamp: string,
//     @Headers('x-customer-care-signature') signature: string,
//   ) {
//     const rawBody = typeof req.rawBody === 'string'
//       ? req.rawBody
//       : Buffer.isBuffer(req.rawBody)
//         ? req.rawBody.toString('utf8')
//         : JSON.stringify(dto)
//     this.service.verifyWebhook(rawBody, timestamp, signature)
//     return this.service.inbound(dto)
//   }
// }
