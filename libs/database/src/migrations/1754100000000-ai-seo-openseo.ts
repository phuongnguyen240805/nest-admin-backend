import { MigrationInterface, QueryRunner } from 'typeorm'

export class AiSeoOpenseo1754100000000 implements MigrationInterface {
  name = 'AiSeoOpenseo1754100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_seo_project" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" integer NOT NULL,
        "store_id" varchar(64),
        "landing_page_id" uuid,
        "name" varchar(255) NOT NULL,
        "hostname" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'draft',
        "openseo_project_id" varchar(128),
        "task_status" varchar(30) NOT NULL DEFAULT 'pending',
        "pixel_tag_state" varchar(30) NOT NULL DEFAULT 'not_installed',
        "is_favorite" boolean NOT NULL DEFAULT false,
        "holistic_scores" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "connected_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "site_audit" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "last_analysis_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_seo_project" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_seo_task" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "seo_project_id" uuid NOT NULL,
        "external_task_id" varchar(128),
        "type" varchar(30) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'pending',
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_seo_task" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_seo_task_project" FOREIGN KEY ("seo_project_id")
          REFERENCES "lp_seo_project"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_seo_keyword_cache" (
        "tenant_id" integer NOT NULL,
        "seed_hash" varchar(128) NOT NULL,
        "response" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_seo_keyword_cache" PRIMARY KEY ("tenant_id", "seed_hash")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_seo_integration" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" integer NOT NULL,
        "provider" varchar(30) NOT NULL,
        "encrypted_credentials" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_seo_integration" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_seo_project_tenant_landing"
        ON "lp_seo_project" ("tenant_id", "landing_page_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_seo_project_tenant_hostname"
        ON "lp_seo_project" ("tenant_id", "hostname")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_seo_task_project"
        ON "lp_seo_task" ("seo_project_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_seo_task_external"
        ON "lp_seo_task" ("external_task_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_seo_keyword_cache_expires_at"
        ON "lp_seo_keyword_cache" ("expires_at")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_lp_seo_integration_tenant_provider"
        ON "lp_seo_integration" ("tenant_id", "provider")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_integration_tenant_provider"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_keyword_cache_expires_at"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_task_external"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_task_project"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_project_tenant_hostname"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_seo_project_tenant_landing"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_seo_integration"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_seo_keyword_cache"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_seo_task"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_seo_project"`)
  }
}
