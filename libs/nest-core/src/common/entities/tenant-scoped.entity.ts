import { Column, Index } from 'typeorm'

import { CompleteEntity } from '@liora/database/base.entity'

/**
 * Base entity for all business tables scoped by tenantId.
 * Every query in services must filter by tenantId from TenantContextService.
 */
export abstract class TenantScopedEntity extends CompleteEntity {
  @Column({ type: 'int' })
  @Index()
  tenantId: number
}