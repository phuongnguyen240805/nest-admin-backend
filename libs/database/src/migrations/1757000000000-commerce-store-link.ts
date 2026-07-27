import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Commerce (Medusa bridge) — persist org ↔ sales channel link.
 * Replaces the in-memory store so tenant isolation survives restarts (G5).
 */
export class CommerceStoreLink1757000000000 implements MigrationInterface {
  name = 'CommerceStoreLink1757000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "commerce_store_link" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "organizationId" varchar(64) NOT NULL,
        "mode" varchar(20) NOT NULL DEFAULT 'hosted_shared',
        "salesChannelId" varchar(100),
        "salesChannelName" varchar(255),
        "publishableKeyId" varchar(100),
        "publishableKeyPreview" varchar(32),
        "regionId" varchar(100),
        "currencyCode" varchar(10) NOT NULL DEFAULT 'vnd',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "healthMessage" varchar(500),
        "provisionedAt" TIMESTAMP,
        "lastHealthCheckAt" TIMESTAMP,
        CONSTRAINT "PK_commerce_store_link" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_commerce_store_link_tenantId" ON "commerce_store_link" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_commerce_store_link_tenant_org" ON "commerce_store_link" ("tenantId", "organizationId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "commerce_store_link"`)
  }
}
