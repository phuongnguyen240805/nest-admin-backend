import { MigrationInterface, QueryRunner } from 'typeorm'

export class AiSeoUmami1754100000002 implements MigrationInterface {
  name = 'AiSeoUmami1754100000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_seo_project"
      ADD COLUMN IF NOT EXISTS "umami_website_id" varchar(128),
      ADD COLUMN IF NOT EXISTS "umami_share_id" varchar(128),
      ADD COLUMN IF NOT EXISTS "traffic_script_state" varchar(30) NOT NULL DEFAULT 'not_installed',
      ADD COLUMN IF NOT EXISTS "traffic_synced_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "traffic_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_seo_project"
      DROP COLUMN IF EXISTS "traffic_snapshot",
      DROP COLUMN IF EXISTS "traffic_synced_at",
      DROP COLUMN IF EXISTS "traffic_script_state",
      DROP COLUMN IF EXISTS "umami_share_id",
      DROP COLUMN IF EXISTS "umami_website_id"
    `)
  }
}
