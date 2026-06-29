import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DomainEntity } from './entities';
import { DomainService } from './domain.service';

/**
 * DomainModule
 * Quản lý Custom Domain + DNS + SSL (Let's Encrypt hoặc provider khác).
 * Có thể gọi external API hoặc dùng certbot sidecar.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DomainEntity])],
  providers: [DomainService],
  exports: [TypeOrmModule, DomainService],
})
export class DomainModule {}
