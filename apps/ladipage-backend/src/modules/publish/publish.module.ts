import { Module } from '@nestjs/common';
// import { SseModule, BillingModule } from '@liora/nest-core';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

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
  // imports: [BillingModule, SseModule, FileManagerModule],
  controllers: [PublishController],
  providers: [PublishService],
  exports: [PublishService],
})
export class PublishModule {}
