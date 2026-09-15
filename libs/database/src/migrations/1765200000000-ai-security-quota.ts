import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AiSecurityQuota1765200000000 implements MigrationInterface {
  name = 'AiSecurityQuota1765200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_ai_usage_quota_daily" (
        "tenant_id" integer NOT NULL,
        "usage_day" date NOT NULL,
        "used_units" integer NOT NULL DEFAULT 0 CHECK ("used_units" >= 0),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_lp_ai_usage_quota_daily" PRIMARY KEY ("tenant_id", "usage_day")
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_ai_usage_quota_daily_day"
      ON "lp_ai_usage_quota_daily" ("usage_day")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_lp_ai_usage_quota_daily_day"')
    await queryRunner.query('DROP TABLE IF EXISTS "lp_ai_usage_quota_daily"')
  }
}
