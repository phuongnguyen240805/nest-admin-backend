import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { SseModule, BillingModule } from '@liora/nest-core';
import { PageEntity } from './entities';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { PageService } from './services/page.service';

/**
 * PublishModule
 * Xử lý luồng Publish:
 * - Build static site / SPA
 * - Upload assets (qua FileManager)
 * - Generate embed script
 * - Ghi nhận usage credit (dùng SubscriptionService.updateCredit)
 * - Emit realtime status qua SSE / Socket
 *
 * Tái sử dụng trực tiếp từ nest-core:
 *   BillingModule (credit + plan check)
 *   SseModule / SocketModule (realtime)
 *   FileManagerModule (assets)
 */
@Module({
  imports: [TypeOrmModule.forFeature([PageEntity])],
  controllers: [PublishController],
  providers: [PageService, PublishService],
  exports: [TypeOrmModule, PageService, PublishService],
})
export class PublishModule {}
