import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Widen lp_product.imageUrl from varchar(500) to text so long image URLs
 * and data URIs no longer overflow the column on product create/update.
 */
export class ProductImageUrlText1759000000000 implements MigrationInterface {
  name = 'ProductImageUrlText1759000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_product"
      ALTER COLUMN "imageUrl" TYPE text
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_product"
      ALTER COLUMN "imageUrl" TYPE varchar(500)
    `)
  }
}
