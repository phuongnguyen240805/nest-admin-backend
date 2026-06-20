import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 5: Link orders to CRM persons + legacy id mapping table.
 */
export class CrmV2OrderPerson1753000004000 implements MigrationInterface {
  name = 'CrmV2OrderPerson1753000004000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lp_order"
      ADD COLUMN IF NOT EXISTS "person_id" uuid NULL
    `)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lp_order_tenant_person" ON "lp_order" ("tenantId", "person_id")`,
    )
    await queryRunner.query(`
      ALTER TABLE "lp_order"
      ADD CONSTRAINT "FK_lp_order_person"
      FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE SET NULL
    `)

    await queryRunner.query(`
      CREATE TABLE "crm_id_map" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" integer NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "legacy_id" integer NOT NULL,
        "crm_id" uuid NOT NULL,
        CONSTRAINT "PK_crm_id_map" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_id_map_legacy" ON "crm_id_map" ("tenantId", "entity_type", "legacy_id")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_id_map_crm_id" ON "crm_id_map" ("crm_id")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_id_map"`)
    await queryRunner.query(
      `ALTER TABLE "lp_order" DROP CONSTRAINT IF EXISTS "FK_lp_order_person"`,
    )
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_order_tenant_person"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "person_id"`)
  }
}