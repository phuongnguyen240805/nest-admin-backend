import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import { ProductStatus } from '../common/enums'

@Entity('lp_product')
@Index(['tenantId', 'sku'], { unique: true })
export class ProductEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 100 })
  sku: string

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  price: number

  @Column({ type: 'int', default: 0 })
  stock: number

  @Column({ type: 'varchar', length: 20, default: ProductStatus.ACTIVE })
  status: ProductStatus

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'int', nullable: true })
  categoryId: number | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null
}