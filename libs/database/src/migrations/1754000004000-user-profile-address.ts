import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Profile address fields for LadiPage account settings.
 */
export class UserProfileAddress1754000004000 implements MigrationInterface {
  name = 'UserProfileAddress1754000004000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "address_country" varchar(200) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "address_city_state" varchar(500) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "postal_code" varchar(50) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "tax_id" varchar(100) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "tax_id"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "postal_code"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "address_city_state"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "address_country"`)
  }
}