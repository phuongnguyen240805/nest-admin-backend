import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 7: CRM custom field definitions + values (Pro tier).
 */
export class CrmV2CustomFields1753000005000 implements MigrationInterface {
  name = 'CrmV2CustomFields1753000005000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_custom_field_def" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "target_type" varchar(30) NOT NULL DEFAULT 'person',
        "field_name" varchar(100) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "data_type" varchar(30) NOT NULL DEFAULT 'TEXT',
        "description" text,
        "options" jsonb,
        "is_required" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_crm_custom_field_def" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_custom_field_def_tenant" ON "crm_custom_field_def" ("tenantId")`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_custom_field_def_unique" ON "crm_custom_field_def" ("tenantId", "target_type", "field_name") WHERE "deleted_at" IS NULL`,
    )

    await queryRunner.query(`
      CREATE TABLE "crm_custom_field_value" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "field_id" uuid NOT NULL,
        "person_id" uuid,
        "opportunity_id" uuid,
        "value" text,
        CONSTRAINT "PK_crm_custom_field_value" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_custom_field_value_field" FOREIGN KEY ("field_id") REFERENCES "crm_custom_field_def"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_crm_custom_field_value_person" FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_crm_custom_field_value_opportunity" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunity"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_custom_field_value_person" ON "crm_custom_field_value" ("field_id", "person_id") WHERE "person_id" IS NOT NULL`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_custom_field_value_opp" ON "crm_custom_field_value" ("field_id", "opportunity_id") WHERE "opportunity_id" IS NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_custom_field_value"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_custom_field_def"`)
  }
}