import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add App Store metrics used by application/list and marketplace cards.
 */
export class ApplicationMetrics1754000002000 implements MigrationInterface {
  name = 'ApplicationMetrics1754000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_application"
      ADD COLUMN IF NOT EXISTS "views_count" integer NOT NULL DEFAULT 0
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_application"
      ADD COLUMN IF NOT EXISTS "installs_count" integer NOT NULL DEFAULT 0
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_application" DROP COLUMN IF EXISTS "installs_count"`)
    await queryRunner.query(`ALTER TABLE "lp_application" DROP COLUMN IF EXISTS "views_count"`)
  }
}
