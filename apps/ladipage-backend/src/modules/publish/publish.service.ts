import { Injectable } from '@nestjs/common';

// Nơi chứa business logic publish.
// Nên inject:
// - SubscriptionService (để updateCredit)
// - SseService (realtime)
// - Storage / Netdisk services (assets)

@Injectable()
export class PublishService {
  async startPublish(funnelId: string, userId: number) {
    // TODO: integrate real logic + credit deduction
    return { jobId: 'demo-' + Date.now(), status: 'queued' };
  }
}
