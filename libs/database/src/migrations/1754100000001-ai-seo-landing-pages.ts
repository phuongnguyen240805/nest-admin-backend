import { MigrationInterface, QueryRunner } from 'typeorm'

export class AiSeoLandingPages1754100000001 implements MigrationInterface {
  name = 'AiSeoLandingPages1754100000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_seo_project"
      ADD COLUMN IF NOT EXISTS "is_engaged" boolean NOT NULL DEFAULT true
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_seo_project_page" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" integer NOT NULL,
        "seo_project_id" uuid NOT NULL,
        "page_url" varchar(500) NOT NULL,
        "website_page_id" varchar(128),
        "source" varchar(20) NOT NULL DEFAULT 'external',
        "scan_status" varchar(30) NOT NULL DEFAULT 'pending',
        "last_scan_job_id" varchar(128),
        "last_scanned_at" timestamptz,
        "scores" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_seo_project_page" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_seo_project_page_project" FOREIGN KEY ("seo_project_id")
          REFERENCES "lp_seo_project"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_seo_project_page_project"
        ON "lp_seo_project_page" ("seo_project_id")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_lp_seo_project_page_project_website_page"
        ON "lp_seo_project_page" ("seo_project_id", "website_page_id")
        WHERE "website_page_id" IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_project_page_project_website_page"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_project_page_project"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_seo_project_page"`)
    await queryRunner.query(`ALTER TABLE "lp_seo_project" DROP COLUMN IF EXISTS "is_engaged"`)
  }
}