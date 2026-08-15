import { MigrationInterface, QueryRunner } from 'typeorm'

export class AutomationRuntimeFoundation1763900000000 implements MigrationInterface {
  name = 'AutomationRuntimeFoundation1763900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_flow_execution" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "execution_id" uuid NOT NULL,
        "flow_external_id" varchar(64) NOT NULL,
        "conversation_id" varchar(220),
        "contact_id" varchar(220),
        "trigger_id" varchar(64),
        "trigger_event_id" uuid,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "current_node_id" varchar(128),
        "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "variables" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "started_at" timestamptz,
        "waiting_until" timestamptz,
        "completed_at" timestamptz,
        "failed_at" timestamptz,
        "last_error" text,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_lp_flow_execution" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_flow_execution_tenant_exec" ON "lp_flow_execution" ("tenantId", "execution_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_execution_flow_status" ON "lp_flow_execution" ("tenantId", "flow_external_id", "status")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_execution_conversation_status" ON "lp_flow_execution" ("tenantId", "conversation_id", "status")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_flow_execution_trigger_once" ON "lp_flow_execution" ("tenantId", "trigger_event_id", "trigger_id", "flow_external_id") WHERE "trigger_event_id" IS NOT NULL AND "trigger_id" IS NOT NULL`)

    await queryRunner.query(`
      CREATE TABLE "lp_flow_execution_step" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "execution_id" uuid NOT NULL,
        "node_id" varchar(128) NOT NULL,
        "node_type" varchar(80) NOT NULL,
        "logical_iteration" integer NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "attempt" integer NOT NULL DEFAULT 0,
        "input" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "output" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error" text,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        CONSTRAINT "PK_lp_flow_execution_step" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_flow_step_once" ON "lp_flow_execution_step" ("tenantId", "execution_id", "node_id", "logical_iteration")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_step_exec_status" ON "lp_flow_execution_step" ("tenantId", "execution_id", "status")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_flow_execution_step"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_flow_execution"`)
  }
}
