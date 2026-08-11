import { MigrationInterface, QueryRunner } from 'typeorm'

export class DomainOutboxEvents1763500000000 implements MigrationInterface {
  name = 'DomainOutboxEvents1763500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "domain_outbox_event" (
        "id" SERIAL NOT NULL,
        "event_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" integer NOT NULL,
        "aggregate_type" varchar(60) NOT NULL,
        "aggregate_id" varchar(220) NOT NULL,
        "event_type" varchar(120) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_domain_outbox_event" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_domain_outbox_event_id" ON "domain_outbox_event" ("event_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_domain_outbox_pending" ON "domain_outbox_event" ("tenant_id", "status", "available_at")`)
    await queryRunner.query(`CREATE INDEX "IDX_domain_outbox_aggregate" ON "domain_outbox_event" ("tenant_id", "aggregate_type", "aggregate_id", "created_at")`)
    await queryRunner.query(`CREATE INDEX "IDX_domain_outbox_order_payload" ON "domain_outbox_event" ("tenant_id", (("payload" ->> 'orderId'))) WHERE ("payload" ? 'orderId')`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "domain_outbox_event"`)
  }
}
