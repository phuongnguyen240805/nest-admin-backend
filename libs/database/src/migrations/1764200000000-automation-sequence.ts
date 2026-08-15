import { MigrationInterface, QueryRunner } from 'typeorm'

export class AutomationSequence1764200000000 implements MigrationInterface {
  name = 'AutomationSequence1764200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_automation_sequence" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "active" boolean NOT NULL DEFAULT true,
        "timezone" varchar(80) NOT NULL DEFAULT 'UTC',
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_delete" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_lp_automation_sequence" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_ext" ON "lp_automation_sequence" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_sequence_status" ON "lp_automation_sequence" ("tenantId", "status")`)

    await queryRunner.query(`
      CREATE TABLE "lp_automation_sequence_step" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "sequence_id" varchar(64) NOT NULL,
        "flow_id" varchar(64) NOT NULL,
        "order" integer NOT NULL,
        "delay_days" integer NOT NULL DEFAULT 0,
        "delay_minutes" integer NOT NULL DEFAULT 0,
        "specific_date_time" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "anytime" boolean NOT NULL DEFAULT true,
        "send_time_start" varchar(5),
        "send_time_end" varchar(5),
        "send_days" jsonb NOT NULL DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'::jsonb,
        CONSTRAINT "PK_lp_automation_sequence_step" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_step_ext" ON "lp_automation_sequence_step" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_step_order" ON "lp_automation_sequence_step" ("tenantId", "sequence_id", "order")`)

    await queryRunner.query(`
      CREATE TABLE "lp_automation_sequence_enrollment" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "enrollment_id" uuid NOT NULL,
        "sequence_id" varchar(64) NOT NULL,
        "contact_identity_id" integer,
        "conversation_id" varchar(220) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'ACTIVE',
        "current_order" integer NOT NULL DEFAULT -1,
        "last_step_id" varchar(64),
        "next_step_id" varchar(64),
        "next_run_at" timestamptz,
        "enrolled_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_at" timestamptz,
        "last_error" text,
        CONSTRAINT "PK_lp_automation_sequence_enrollment" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_enrollment_id" ON "lp_automation_sequence_enrollment" ("tenantId", "enrollment_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_enrollment_once" ON "lp_automation_sequence_enrollment" ("tenantId", "sequence_id", "conversation_id") WHERE "status" = 'ACTIVE'`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_sequence_enrollment_status" ON "lp_automation_sequence_enrollment" ("tenantId", "status", "next_run_at")`)

    await queryRunner.query(`
      CREATE TABLE "lp_automation_sequence_dispatch" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "dispatch_id" uuid NOT NULL,
        "idempotency_key" varchar(255) NOT NULL,
        "enrollment_id" uuid NOT NULL,
        "sequence_id" varchar(64) NOT NULL,
        "step_id" varchar(64) NOT NULL,
        "run_at" timestamptz NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "flow_execution_id" uuid,
        "last_error" text,
        "completed_at" timestamptz,
        CONSTRAINT "PK_lp_automation_sequence_dispatch" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_dispatch_id" ON "lp_automation_sequence_dispatch" ("tenantId", "dispatch_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_sequence_dispatch_key" ON "lp_automation_sequence_dispatch" ("tenantId", "idempotency_key")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_sequence_dispatch_due" ON "lp_automation_sequence_dispatch" ("tenantId", "status", "run_at")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_sequence_dispatch_enrollment" ON "lp_automation_sequence_dispatch" ("tenantId", "enrollment_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_sequence_dispatch"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_sequence_enrollment"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_sequence_step"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_sequence"`)
  }
}
