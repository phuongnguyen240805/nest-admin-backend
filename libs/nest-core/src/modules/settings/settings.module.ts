import { Module } from '@nestjs/common'

/**
 * Settings module — Phase 1+ implementation.
 *
 * Planned APIs:
 *   GET  /api/settings/workspace
 *   PUT  /api/settings/workspace
 *   GET  /api/settings/integrations
 *   PUT  /api/settings/integrations
 *
 * All endpoints will be tenant-scoped via TenantContextService.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class SettingsModule {}