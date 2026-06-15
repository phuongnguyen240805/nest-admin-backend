import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { API_SECURITY_AUTH } from '@liora/nest-core';

// Ví dụ controller cho luồng publish.
// Sau này sẽ inject PublishService + SubscriptionService (từ nest-core).

@ApiTags('publish')
@ApiSecurity(API_SECURITY_AUTH)
@Controller('publish')
export class PublishController {
  @Get()
  @ApiOperation({ summary: 'Danh sách publish jobs (demo)' })
  listPublishes() {
    return { message: 'List publishes (demo) - integrate with nest-core Billing for quota' };
  }

  @Post()
  @ApiOperation({ summary: 'Bắt đầu publish (demo — tích hợp Billing + FileManager)' })
  async publish() {
    // TODO:
    // 1. Check credit / plan (dùng SubscriptionService từ BillingModule)
    // 2. Build + upload assets (FileManagerModule)
    // 3. Update credit usage
    // 4. Emit SSE event
    // 5. Return embed script info
    return {
      message: 'Publish job started (demo)',
      usage: 'See CreditModule + PublishModule + SseModule from nest-core',
    };
  }
}
