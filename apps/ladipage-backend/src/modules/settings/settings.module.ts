import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TenantModule } from '@liora/nest-core'
import { ApiKeyService } from './api-key.service'
import { ApiKeyEntity } from './entities'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

@Module({
  imports: [TenantModule, TypeOrmModule.forFeature([ApiKeyEntity])],
  controllers: [SettingsController],
  providers: [SettingsService, ApiKeyService],
  exports: [SettingsService, ApiKeyService, TypeOrmModule],
})
export class SettingsModule {}
