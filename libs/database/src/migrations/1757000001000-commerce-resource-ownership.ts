import { MigrationInterface, QueryRunner } from 'typeorm'

export class CommerceResourceOwnership1757000001000 implements MigrationInterface {
  name = 'CommerceResourceOwnership1757000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "commerce_resource_ownership" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "appId" varchar(64) NOT NULL DEFAULT 'ladipage',
        "environment" varchar(32) NOT NULL DEFAULT 'development',
        "providerId" varchar(64) NOT NULL DEFAULT 'medusa-primary',
        "organizationId" varchar(64) NOT NULL,
        "resourceKind" varchar(32) NOT NULL,
        "externalId" varchar(128) NOT NULL,
        CONSTRAINT "PK_commerce_resource_ownership" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commerce_resource_ownership_tenant"
      ON "commerce_resource_ownership" ("tenantId")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_commerce_resource_owner_scope"
      ON "commerce_resource_ownership"
      ("tenantId", "appId", "environment", "providerId", "organizationId", "resourceKind", "externalId")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_commerce_resource_external_owner"
      ON "commerce_resource_ownership"
      ("environment", "providerId", "resourceKind", "externalId")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "commerce_resource_ownership"`,
    )
  }
}
