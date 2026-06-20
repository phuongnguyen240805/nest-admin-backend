import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 4: CRM sales tables (pipeline, opportunity, task, note, activity).
 */
export class CrmV2Sales1753000003000 implements MigrationInterface {
  name = 'CrmV2Sales1753000003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_pipeline" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_crm_pipeline" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_pipeline_tenantId" ON "crm_pipeline" ("tenantId")`)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_pipeline_tenant_default" ON "crm_pipeline" ("tenantId", "is_default") WHERE "deleted_at" IS NULL`,
    )

    await queryRunner.query(`
      CREATE TABLE "crm_pipeline_stage" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pipeline_id" uuid NOT NULL,
        "slug" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "color" varchar(20),
        CONSTRAINT "PK_crm_pipeline_stage" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_pipeline_stage_pipeline" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipeline"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_pipeline_stage_pipeline_pos" ON "crm_pipeline_stage" ("pipeline_id", "position")`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_pipeline_stage_slug" ON "crm_pipeline_stage" ("pipeline_id", "slug")`,
    )

    await queryRunner.query(`
      CREATE TABLE "crm_opportunity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "amount" jsonb,
        "close_date" date,
        "pipeline_id" uuid NOT NULL,
        "stage_id" uuid NOT NULL,
        "person_id" uuid,
        "company_id" uuid,
        "position" integer NOT NULL DEFAULT 0,
        "owner_id" integer,
        "search_vector" tsvector,
        CONSTRAINT "PK_crm_opportunity" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_opportunity_pipeline" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipeline"("id"),
        CONSTRAINT "FK_crm_opportunity_stage" FOREIGN KEY ("stage_id") REFERENCES "crm_pipeline_stage"("id"),
        CONSTRAINT "FK_crm_opportunity_person" FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_opportunity_company" FOREIGN KEY ("company_id") REFERENCES "crm_company"("id") ON DELETE SET NULL
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_opportunity_tenantId" ON "crm_opportunity" ("tenantId")`)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_opportunity_tenant_stage" ON "crm_opportunity" ("tenantId", "stage_id") WHERE "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_opportunity_search_vector" ON "crm_opportunity" USING GIN ("search_vector")`,
    )

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION crm_opportunity_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('simple', coalesce(NEW.name, ''));
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `)
    await queryRunner.query(`
      CREATE TRIGGER crm_opportunity_search_vector_update
      BEFORE INSERT OR UPDATE ON "crm_opportunity"
      FOR EACH ROW EXECUTE PROCEDURE crm_opportunity_search_vector_trigger()
    `)

    await queryRunner.query(`
      CREATE TABLE "crm_task" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "body" text,
        "status" varchar(20) NOT NULL DEFAULT 'TODO',
        "due_date" TIMESTAMP,
        "person_id" uuid,
        "company_id" uuid,
        "opportunity_id" uuid,
        "assignee_id" integer,
        CONSTRAINT "PK_crm_task" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_task_person" FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_task_company" FOREIGN KEY ("company_id") REFERENCES "crm_company"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_task_opportunity" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunity"("id") ON DELETE SET NULL
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_task_tenantId" ON "crm_task" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_crm_task_person" ON "crm_task" ("person_id")`)

    await queryRunner.query(`
      CREATE TABLE "crm_note" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "title" varchar(255),
        "body" text NOT NULL,
        "person_id" uuid,
        "company_id" uuid,
        "opportunity_id" uuid,
        CONSTRAINT "PK_crm_note" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_note_person" FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_note_company" FOREIGN KEY ("company_id") REFERENCES "crm_company"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_crm_note_opportunity" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunity"("id") ON DELETE SET NULL
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_note_tenantId" ON "crm_note" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_crm_note_person" ON "crm_note" ("person_id")`)

    await queryRunner.query(`
      CREATE TABLE "crm_activity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" integer NOT NULL,
        "happens_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar(255) NOT NULL,
        "action" varchar(30) NOT NULL,
        "target_type" varchar(30) NOT NULL,
        "target_id" uuid NOT NULL,
        "person_id" uuid,
        "opportunity_id" uuid,
        "properties" jsonb,
        CONSTRAINT "PK_crm_activity" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_activity_tenantId" ON "crm_activity" ("tenantId")`)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_activity_person_timeline" ON "crm_activity" ("tenantId", "person_id", "happens_at" DESC)`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_activity_opp_timeline" ON "crm_activity" ("tenantId", "opportunity_id", "happens_at" DESC)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_activity"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_note"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_task"`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_opportunity_search_vector_update ON "crm_opportunity"`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS crm_opportunity_search_vector_trigger()`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_opportunity"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_pipeline_stage"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_pipeline"`)
  }
}