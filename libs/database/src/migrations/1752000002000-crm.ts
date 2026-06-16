import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 4: CRM tables (customers, companies, segments, tags, custom fields...).
 */
export class Crm1752000002000 implements MigrationInterface {
  name = 'Crm1752000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_customer" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "email" varchar(255),
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        CONSTRAINT "PK_lp_customer" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_customer_tenantId" ON "lp_customer" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_customer_tenant_phone" ON "lp_customer" ("tenantId", "phone")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_customer_tenant_email" ON "lp_customer" ("tenantId", "email")`)

    await queryRunner.query(`
      CREATE TABLE "lp_company" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        CONSTRAINT "PK_lp_company" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_company_tenantId" ON "lp_company" ("tenantId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_customer_company" (
        "id" SERIAL NOT NULL,
        "customerId" integer NOT NULL,
        "companyId" integer NOT NULL,
        CONSTRAINT "PK_lp_customer_company" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_customer_company_unique" ON "lp_customer_company" ("customerId", "companyId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_segment" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "rules" jsonb,
        CONSTRAINT "PK_lp_segment" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_segment_tenantId" ON "lp_segment" ("tenantId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_customer_segment" (
        "id" SERIAL NOT NULL,
        "customerId" integer NOT NULL,
        "segmentId" integer NOT NULL,
        CONSTRAINT "PK_lp_customer_segment" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_customer_segment_unique" ON "lp_customer_segment" ("customerId", "segmentId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_customer_tag" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        CONSTRAINT "PK_lp_customer_tag" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_customer_tag_tenantId" ON "lp_customer_tag" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_customer_tag_tenant_name" ON "lp_customer_tag" ("tenantId", "name")`)

    await queryRunner.query(`
      CREATE TABLE "lp_customer_tag_map" (
        "id" SERIAL NOT NULL,
        "customerId" integer NOT NULL,
        "tagId" integer NOT NULL,
        CONSTRAINT "PK_lp_customer_tag_map" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_customer_tag_map_unique" ON "lp_customer_tag_map" ("customerId", "tagId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_customer_custom_field" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "fieldName" varchar(100) NOT NULL,
        "displayName" varchar(255) NOT NULL,
        "dataType" varchar(30) NOT NULL DEFAULT 'TEXT',
        "description" text,
        "options" jsonb,
        CONSTRAINT "PK_lp_customer_custom_field" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_customer_custom_field_tenantId" ON "lp_customer_custom_field" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_customer_custom_field_unique" ON "lp_customer_custom_field" ("tenantId", "fieldName")`)

    await queryRunner.query(`
      CREATE TABLE "lp_customer_field_value" (
        "id" SERIAL NOT NULL,
        "customerId" integer NOT NULL,
        "fieldId" integer NOT NULL,
        "value" text,
        CONSTRAINT "PK_lp_customer_field_value" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_customer_field_value_unique" ON "lp_customer_field_value" ("customerId", "fieldId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_sync_error_log" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "customerId" integer,
        "errorCode" varchar(50) NOT NULL,
        "actionType" varchar(100) NOT NULL,
        "errorContent" text NOT NULL,
        CONSTRAINT "PK_lp_sync_error_log" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_sync_error_log_tenantId" ON "lp_sync_error_log" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_sync_error_log_customerId" ON "lp_sync_error_log" ("customerId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_sync_error_log"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer_field_value"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer_custom_field"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer_tag_map"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer_tag"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer_segment"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_segment"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer_company"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_company"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_customer"`)
  }
}