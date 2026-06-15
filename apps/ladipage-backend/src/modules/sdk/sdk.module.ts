import { Module } from '@nestjs/common';

/**
 * SdkModule (Optional)
 * Quản lý version của Builder SDK (nếu builder là separate package).
 * Có thể phục vụ manifest, changelog, download SDK.
 */
@Module({})
export class SdkModule {}
