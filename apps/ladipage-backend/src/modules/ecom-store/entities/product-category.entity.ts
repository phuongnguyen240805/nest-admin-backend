import { Column, Entity } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_product_category')
export class ProductCategoryEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'int', nullable: true })
  parentId: number | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null

  @Column({ type: 'boolean', default: true })
  visible: boolean
}