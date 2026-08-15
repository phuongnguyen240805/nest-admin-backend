import { MigrationInterface, QueryRunner } from 'typeorm'

export class AutomationActionDispatch1764400000000 implements MigrationInterface {
  name = 'AutomationActionDispatch1764400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_automation_action_dispatch" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "dispatch_id" uuid NOT NULL,
        "idempotency_key" varchar(255) NOT NULL,
        "execution_id" uuid NOT NULL,
        "node_id" varchar(128) NOT NULL,
        "logical_iteration" integer NOT NULL DEFAULT 0,
        "conversation_id" varchar(220),
        "action_type" varchar(80) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result_variable" varchar(128),
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "available_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_error" text,
        "completed_at" timestamptz,
        CONSTRAINT "PK_lp_automation_action_dispatch" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_action_dispatch_id" ON "lp_automation_action_dispatch" ("tenantId", "dispatch_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_action_idempotency" ON "lp_automation_action_dispatch" ("tenantId", "idempotency_key")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_action_status" ON "lp_automation_action_dispatch" ("tenantId", "status", "available_at")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_action_execution" ON "lp_automation_action_dispatch" ("tenantId", "execution_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_action_dispatch"`)
  }
}
