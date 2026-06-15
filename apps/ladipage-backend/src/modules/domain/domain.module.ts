import { Module } from '@nestjs/common';

/**
 * DomainModule
 * Quản lý Custom Domain + DNS + SSL (Let's Encrypt hoặc provider khác).
 * Có thể gọi external API hoặc dùng certbot sidecar.
 */
@Module({})
export class DomainModule {}
