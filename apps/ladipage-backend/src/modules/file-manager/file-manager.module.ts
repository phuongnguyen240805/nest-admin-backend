import { Module } from '@nestjs/common';
import { NetdiskModule, ToolsModule } from '@liora/nest-core';
// UploadModule được export bởi ToolsModule (xem tools/tools.module.ts)
// Nếu cần import trực tiếp UploadModule ở nơi khác, cân nhắc export thêm ở nest-core/src/index.ts

/**
 * FileManagerModule (tái sử dụng từ nest-core)
 *
 * Wrap + mở rộng:
 * - NetdiskModule (quản lý cao cấp)
 * - UploadModule + Storage (từ ToolsModule)
 *
 * Mục tiêu: cung cấp API upload media cho landing page (hình ảnh, video, font...),
 * hỗ trợ chuyển sang R2 / MinIO / S3 sau này mà không đổi interface.
 */
@Module({
  imports: [ToolsModule, NetdiskModule],
  controllers: [],
  providers: [
    // TODO: tạo FileManagerService wrapper nếu cần custom logic (R2 adapter, quota, v.v.)
  ],
  exports: [ToolsModule, NetdiskModule],
})
export class FileManagerModule {}
