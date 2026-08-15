import { MigrationInterface, QueryRunner } from 'typeorm'

export class AutomationBroadcastRuntime1764300000000 implements MigrationInterface {
  name = 'AutomationBroadcastRuntime1764300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_automation_broadcast_recipient" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "recipient_id" uuid NOT NULL,
        "broadcast_id" varchar(64) NOT NULL,
        "contact_identity_id" integer,
        "conversation_id" varchar(220) NOT NULL,
        "channel_account_id" integer NOT NULL,
        "provider" varchar(40) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "flow_execution_id" uuid,
        "last_error" text,
        "completed_at" timestamptz,
        CONSTRAINT "PK_lp_automation_broadcast_recipient" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_broadcast_recipient_id" ON "lp_automation_broadcast_recipient" ("tenantId", "recipient_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_auto_broadcast_recipient_once" ON "lp_automation_broadcast_recipient" ("tenantId", "broadcast_id", "conversation_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_auto_broadcast_recipient_status" ON "lp_automation_broadcast_recipient" ("tenantId", "broadcast_id", "status")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_broadcast_recipient"`)
  }
}
