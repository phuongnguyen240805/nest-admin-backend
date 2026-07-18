import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CloudflareSaasService } from './cloudflare-saas.service';
import { DomainEntity } from './entities';
import { DomainService } from './domain.service';
import { LandingDomainController } from './landing-domain.controller';

/**
 * DomainModule
 * - Legacy RPC DomainService (list domains)
 * - Plan B: Cloudflare SaaS Custom Hostname control-plane (LandingDomainController)
 */
@Module({
  imports: [TypeOrmModule.forFeature([DomainEntity])],
  controllers: [LandingDomainController],
  providers: [DomainService, CloudflareSaasService],
  exports: [TypeOrmModule, DomainService, CloudflareSaasService],
})
export class DomainModule {}
