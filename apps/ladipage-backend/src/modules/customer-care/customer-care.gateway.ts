import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  namespace: '/customer-care',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class CustomerCareGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(CustomerCareGateway.name)

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw = String(client.handshake.auth?.token || client.handshake.headers.authorization || '')
      const token = raw.replace(/^Bearer\s+/i, '')
      const payload = await this.jwt.verifyAsync(token)
      const tenantId = Number(payload.tenantId ?? payload.activeTenantId)
      if (!tenantId || !payload.uid) throw new Error('Missing tenant context')
      client.data.auth = { tenantId, userId: Number(payload.uid) }
      await client.join(`tenant:${tenantId}`)
      await client.join(`user:${tenantId}:${payload.uid}`)
      client.emit('ready', { tenantId, userId: Number(payload.uid) })
    } catch (error) {
      this.logger.warn(`Rejected socket ${client.id}: ${error instanceof Error ? error.message : String(error)}`)
      client.disconnect(true)
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('conversation.join')
  async joinConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const auth = client.data.auth
    if (!auth || !body?.conversationId) return
    await client.join(`conversation:${auth.tenantId}:${body.conversationId}`)
  }

  @SubscribeMessage('conversation.leave')
  async leaveConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const auth = client.data.auth
    if (!auth || !body?.conversationId) return
    await client.leave(`conversation:${auth.tenantId}:${body.conversationId}`)
  }

  @SubscribeMessage('typing.start')
  typingStart(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const auth = client.data.auth
    if (!auth || !body?.conversationId) return
    client.to(`conversation:${auth.tenantId}:${body.conversationId}`).emit('typing.started', {
      conversationId: body.conversationId,
      userId: auth.userId,
    })
  }

  @SubscribeMessage('typing.stop')
  typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const auth = client.data.auth
    if (!auth || !body?.conversationId) return
    client.to(`conversation:${auth.tenantId}:${body.conversationId}`).emit('typing.stopped', {
      conversationId: body.conversationId,
      userId: auth.userId,
    })
  }

  emitTenant(tenantId: number, type: string, event: unknown) {
    this.server?.to(`tenant:${tenantId}`).emit(type, event)
  }

  emitConversation(tenantId: number, conversationId: string, type: string, event: unknown) {
    this.server?.to(`conversation:${tenantId}:${conversationId}`).emit(type, event)
    this.server?.to(`tenant:${tenantId}`).emit(type, event)
  }
}
