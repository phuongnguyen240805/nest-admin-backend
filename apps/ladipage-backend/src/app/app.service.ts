import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getData(): { message: string; reuse: string } {
    return {
      message: 'LadiPage Backend is running',
      reuse: 'Powered by @liora/nest-core (Auth, Tenant, Billing, File, Realtime, AI...)',
    };
  }
}
