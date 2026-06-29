import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationSeedStore } from './data/application-seed.store';
import { ApplicationEntity } from './entities';
import { ApplicationCatalogService } from './services/application-catalog.service';
import { ApplicationLifecycleService } from './services/application-lifecycle.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationEntity])],
  providers: [
    ApplicationSeedStore,
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
