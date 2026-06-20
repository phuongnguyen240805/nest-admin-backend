import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 8: CRM enterprise custom objects (JSONB hybrid — no metadata engine).
 */
export class CrmV2Enterprise1753000006000 implements MigrationInterface {
  name = 'CrmV2Enterprise1753000006000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_object_definition" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "slug" varchar(100) NOT NULL,
        "label" varchar(255) NOT NULL,
        "description" text,
        CONSTRAINT "PK_crm_object_definition" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_object_def_tenant" ON "crm_object_definition" ("tenantId")`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_object_def_slug" ON "crm_object_definition" ("tenantId", "slug") WHERE "deleted_at" IS NULL`,
    )

    await queryRunner.query(`
      CREATE TABLE "crm_field_definition" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "object_id" uuid NOT NULL,
        "field_slug" varchar(100) NOT NULL,
        "label" varchar(255) NOT NULL,
        "data_type" varchar(30) NOT NULL DEFAULT 'TEXT',
        "is_required" boolean NOT NULL DEFAULT false,
        "options" jsonb,
        "position" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_crm_field_definition" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_field_def_object" FOREIGN KEY ("object_id") REFERENCES "crm_object_definition"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_field_def_slug" ON "crm_field_definition" ("object_id", "field_slug")`,
    )

    await queryRunner.query(`
      CREATE TABLE "crm_dynamic_record" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "object_id" uuid NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "search_vector" tsvector,
        CONSTRAINT "PK_crm_dynamic_record" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_dynamic_record_object" FOREIGN KEY ("object_id") REFERENCES "crm_object_definition"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_dynamic_record_tenant" ON "crm_dynamic_record" ("tenantId")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_dynamic_record_object" ON "crm_dynamic_record" ("tenantId", "object_id") WHERE "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_dynamic_record_data" ON "crm_dynamic_record" USING GIN ("data")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_dynamic_record"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_field_definition"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_object_definition"`)
  }
}