import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Bridge CRM v2 persons to legacy lp_customer_tag / lp_segment via map tables.
 */
export class CrmPersonTagSegmentBridge1753000007000 implements MigrationInterface {
  name = 'CrmPersonTagSegmentBridge1753000007000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_person_tag_map" (
        "id" SERIAL NOT NULL,
        "personId" uuid NOT NULL,
        "tagId" integer NOT NULL,
        CONSTRAINT "PK_crm_person_tag_map" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_person_tag_map_unique" ON "crm_person_tag_map" ("personId", "tagId")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_person_tag_map_tag" ON "crm_person_tag_map" ("tagId")`,
    )
    await queryRunner.query(`
      ALTER TABLE "crm_person_tag_map"
      ADD CONSTRAINT "FK_crm_person_tag_map_person"
      FOREIGN KEY ("personId") REFERENCES "crm_person"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "crm_person_tag_map"
      ADD CONSTRAINT "FK_crm_person_tag_map_tag"
      FOREIGN KEY ("tagId") REFERENCES "lp_customer_tag"("id") ON DELETE CASCADE
    `)

    await queryRunner.query(`
      CREATE TABLE "crm_person_segment_map" (
        "id" SERIAL NOT NULL,
        "personId" uuid NOT NULL,
        "segmentId" integer NOT NULL,
        CONSTRAINT "PK_crm_person_segment_map" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_person_segment_map_unique" ON "crm_person_segment_map" ("personId", "segmentId")`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_person_segment_map_segment" ON "crm_person_segment_map" ("segmentId")`,
    )
    await queryRunner.query(`
      ALTER TABLE "crm_person_segment_map"
      ADD CONSTRAINT "FK_crm_person_segment_map_person"
      FOREIGN KEY ("personId") REFERENCES "crm_person"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "crm_person_segment_map"
      ADD CONSTRAINT "FK_crm_person_segment_map_segment"
      FOREIGN KEY ("segmentId") REFERENCES "lp_segment"("id") ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_person_segment_map"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_person_tag_map"`)
  }
}