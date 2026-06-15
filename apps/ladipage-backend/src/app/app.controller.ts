import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@liora/nest-core';

import { AppService } from './app.service';

@ApiTags('LadiPage')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'App info (protected — cần JWT)' })
  getData() {
    return this.appService.getData();
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe (Docker / load balancer)' })
  ready() {
    return { status: 'ok', service: 'ladipage-backend' };
  }
}