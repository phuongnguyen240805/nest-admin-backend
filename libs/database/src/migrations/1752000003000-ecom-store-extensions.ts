import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Ecom store extensions: order tag color, product type, category image/visible, review media.
 */
export class EcomStoreExtensions1752000003000 implements MigrationInterface {
  name = 'EcomStoreExtensions1752000003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_order_tag"
      ADD COLUMN IF NOT EXISTS "color" varchar(20) NOT NULL DEFAULT '#e5e7eb'
    `)

    await queryRunner.query(`
      ALTER TABLE "lp_product"
      ADD COLUMN IF NOT EXISTS "type" varchar(50) NOT NULL DEFAULT 'physical'
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_product"
      ADD COLUMN IF NOT EXISTS "typeName" varchar(100) NOT NULL DEFAULT 'Sản phẩm vật lý'
    `)

    await queryRunner.query(`
      ALTER TABLE "lp_product_category"
      ADD COLUMN IF NOT EXISTS "imageUrl" varchar(500)
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_product_category"
      ADD COLUMN IF NOT EXISTS "visible" boolean NOT NULL DEFAULT true
    `)

    await queryRunner.query(`
      ALTER TABLE "lp_product_review"
      ADD COLUMN IF NOT EXISTS "avatarUrl" varchar(500)
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_product_review"
      ADD COLUMN IF NOT EXISTS "imageUrls" jsonb
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_product_review"
      ADD COLUMN IF NOT EXISTS "productNames" jsonb
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_product_review" DROP COLUMN IF EXISTS "productNames"`)
    await queryRunner.query(`ALTER TABLE "lp_product_review" DROP COLUMN IF EXISTS "imageUrls"`)
    await queryRunner.query(`ALTER TABLE "lp_product_review" DROP COLUMN IF EXISTS "avatarUrl"`)
    await queryRunner.query(`ALTER TABLE "lp_product_category" DROP COLUMN IF EXISTS "visible"`)
    await queryRunner.query(`ALTER TABLE "lp_product_category" DROP COLUMN IF EXISTS "imageUrl"`)
    await queryRunner.query(`ALTER TABLE "lp_product" DROP COLUMN IF EXISTS "typeName"`)
    await queryRunner.query(`ALTER TABLE "lp_product" DROP COLUMN IF EXISTS "type"`)
    await queryRunner.query(`ALTER TABLE "lp_order_tag" DROP COLUMN IF EXISTS "color"`)
  }
}