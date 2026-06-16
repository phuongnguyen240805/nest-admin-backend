import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_product_tag_map')
@Index(['productId', 'tagId'], { unique: true })
export class ProductTagMapEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  productId: number

  @Column({ type: 'int' })
  tagId: number
}