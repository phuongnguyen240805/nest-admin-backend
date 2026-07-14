import { MigrationInterface, QueryRunner } from 'typeorm'

export class McpApiKeyLandingSchema1756200000000 implements MigrationInterface {
  name = 'McpApiKeyLandingSchema1756200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_api_key" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64),
        "owner_id" varchar(64) NOT NULL,
        "ladi_uid" varchar(64),
        "name" varchar(255) NOT NULL,
        "key_prefix" varchar(32) NOT NULL,
        "key_hash" varchar(128) NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "is_default" boolean NOT NULL DEFAULT false,
        "is_delete" boolean NOT NULL DEFAULT false,
        "last_used_at" timestamptz,
        "expires_at" timestamptz,
        "revoked_at" timestamptz,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_lp_api_key" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lp_api_key_tenant_hash"
        ON "lp_api_key" ("tenantId", "key_hash")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_api_key_tenant_owner"
        ON "lp_api_key" ("tenantId", "owner_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_api_key_tenant_status"
        ON "lp_api_key" ("tenantId", "status")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_api_key_external"
        ON "lp_api_key" ("_id")
        WHERE "_id" IS NOT NULL
    `)

    await queryRunner.query(`
      ALTER TABLE "lp_page"
      ADD COLUMN IF NOT EXISTS "render_engine" varchar(50) NOT NULL DEFAULT 'legacy'
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_page"
      ADD COLUMN IF NOT EXISTS "external_site_id" varchar(128)
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_page"
      ADD COLUMN IF NOT EXISTS "external_page_id" varchar(128)
    `)
    await queryRunner.query(`
      ALTER TABLE "lp_page"
      ADD COLUMN IF NOT EXISTS "published_at" timestamptz
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_page_tenant_engine"
        ON "lp_page" ("tenantId", "render_engine")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_page_external_mapping"
        ON "lp_page" ("external_site_id", "external_page_id")
        WHERE "external_site_id" IS NOT NULL AND "external_page_id" IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_page_external_mapping"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_page_tenant_engine"`)
    await queryRunner.query(`ALTER TABLE "lp_page" DROP COLUMN IF EXISTS "published_at"`)
    await queryRunner.query(`ALTER TABLE "lp_page" DROP COLUMN IF EXISTS "external_page_id"`)
    await queryRunner.query(`ALTER TABLE "lp_page" DROP COLUMN IF EXISTS "external_site_id"`)
    await queryRunner.query(`ALTER TABLE "lp_page" DROP COLUMN IF EXISTS "render_engine"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_api_key_external"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_api_key_tenant_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_api_key_tenant_owner"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_api_key_tenant_hash"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_api_key"`)
  }
}
