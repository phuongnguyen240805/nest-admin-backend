import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '@liora/nest-core';

import { ApplicationsController } from './applications.controller';
import { ApplicationSeedStore } from './data/application-seed.store';
import { ApplicationEntity } from './entities';
import { ApplicationAccessService } from './services/application-access.service';
import { ApplicationCatalogService } from './services/application-catalog.service';
import { ApplicationLifecycleService } from './services/application-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity]),
    TenantModule,
  ],
  controllers: [ApplicationsController],
  providers: [
    ApplicationSeedStore,
    ApplicationAccessService,
    ApplicationCatalogService,
    ApplicationLifecycleService,
  ],
  exports: [
    TypeOrmModule,
    ApplicationSeedStore,
    ApplicationCatalogService,
    ApplicationLifecycleService,
  ],
})
export class AppStoreModule {}
