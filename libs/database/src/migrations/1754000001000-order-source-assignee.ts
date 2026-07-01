import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add appv6 order source and assignee fields for LadiPage sales order parity.
 */
export class OrderSourceAssignee1754000001000 implements MigrationInterface {
  name = 'OrderSourceAssignee1754000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_order"
      ADD COLUMN IF NOT EXISTS "source" varchar(100) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_order"
      ADD COLUMN IF NOT EXISTS "assignee_id" varchar(36) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_order"
      ADD COLUMN IF NOT EXISTS "assignee_name" varchar(255) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "assignee_name"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "assignee_id"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "source"`)
  }
}
