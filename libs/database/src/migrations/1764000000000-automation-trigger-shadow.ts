import { MigrationInterface, QueryRunner } from 'typeorm'

export class AutomationTriggerShadow1764000000000 implements MigrationInterface {
  name = 'AutomationTriggerShadow1764000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_automation_trigger" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "flow_id" varchar(64) NOT NULL,
        "event_type" varchar(120) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "priority" integer NOT NULL DEFAULT 0,
        "conditions" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_delete" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_lp_automation_trigger" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_automation_trigger_tenant_ext" ON "lp_automation_trigger" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_automation_trigger_event_enabled" ON "lp_automation_trigger" ("tenantId", "event_type", "enabled")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_automation_trigger_flow" ON "lp_automation_trigger" ("tenantId", "flow_id")`)

    await queryRunner.query(`
      CREATE TABLE "domain_event_delivery" (
        "id" SERIAL NOT NULL,
        "event_id" uuid NOT NULL,
        "tenant_id" integer NOT NULL,
        "consumer" varchar(80) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'observed',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "observed_at" timestamptz,
        "processed_at" timestamptz,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_domain_event_delivery" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_domain_event_delivery_event_consumer" ON "domain_event_delivery" ("event_id", "consumer")`)
    await queryRunner.query(`CREATE INDEX "IDX_domain_event_delivery_consumer_status" ON "domain_event_delivery" ("tenant_id", "consumer", "status", "created_at")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_event_delivery"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_automation_trigger"`)
  }
}
