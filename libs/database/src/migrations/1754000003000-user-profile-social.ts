import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Profile bio + social links for LadiPage account settings.
 */
export class UserProfileSocial1754000003000 implements MigrationInterface {
  name = 'UserProfileSocial1754000003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "bio" varchar(500) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "social_facebook" varchar(500) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "social_x" varchar(500) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "social_linkedin" varchar(500) NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD COLUMN IF NOT EXISTS "social_instagram" varchar(500) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "social_instagram"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "social_linkedin"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "social_x"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "social_facebook"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP COLUMN IF EXISTS "bio"`)
  }
}