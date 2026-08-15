import { MigrationInterface, QueryRunner } from 'typeorm'

export class AutomationRuntimeWorker1764100000000 implements MigrationInterface {
  name = 'AutomationRuntimeWorker1764100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_flow_execution" ADD COLUMN IF NOT EXISTS "lock_token" uuid`)
    await queryRunner.query(`ALTER TABLE "lp_flow_execution" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_flow_execution_lock" ON "lp_flow_execution" ("status", "locked_until")`)

    await queryRunner.query(`
      CREATE TABLE "lp_automation_outbound_dispatch" (
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
        "conversation_id" varchar(220) NOT NULL,
        "client_message_id" uuid NOT NULL,
        "message_type" varchar(30) NOT NULL DEFAULT 'text',
        "content" text NOT NULL DEFAULT '',
        "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "available_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "provider_message_id" varchar(220),
        "last_error" text,
        "completed_at" timestamptz,
        CONSTRAINT "PK_lp_automation_outbound_dispatch" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_outbound_dispatch_id" ON "lp_automation_outbound_dispatch" ("tenantId", "dispatch_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_outbound_idempotency" ON "lp_automation_outbound_dispatch" ("tenantId", "idempotency_key")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_outbound_status_available" ON "lp_automation_outbound_dispatch" ("tenantId", "status", "available_at")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_outbound_execution" ON "lp_automation_outbound_dispatch" ("tenantId", "execution_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_outbound_dispatch"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_flow_execution_lock"`)
    await queryRunner.query(`ALTER TABLE "lp_flow_execution" DROP COLUMN IF EXISTS "locked_until"`)
    await queryRunner.query(`ALTER TABLE "lp_flow_execution" DROP COLUMN IF EXISTS "lock_token"`)
  }
}
