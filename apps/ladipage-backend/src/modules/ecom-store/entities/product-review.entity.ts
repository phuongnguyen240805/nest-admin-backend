import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_product_review')
@Index(['productId'])
export class ProductReviewEntity extends TenantScopedEntity {
  @Column({ type: 'int' })
  productId: number

  @Column({ type: 'int' })
  rating: number

  @Column({ type: 'text', nullable: true })
  content: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewerName: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null

  @Column({ type: 'jsonb', nullable: true })
  imageUrls: string[] | null

  @Column({ type: 'jsonb', nullable: true })
  productNames: string[] | null
}