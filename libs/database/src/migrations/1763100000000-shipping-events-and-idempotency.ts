import { MigrationInterface, QueryRunner } from 'typeorm'

export class ShippingEventsAndIdempotency1763100000000
  implements MigrationInterface
{
  name = 'ShippingEventsAndIdempotency1763100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "providerOrderId" varchar(120)`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(120)`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "providerStatus" varchar(100)`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "estimatedDeliveryAt" TIMESTAMPTZ`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lp_shipment_tenant_idempotency" ON "lp_shipment" ("tenantId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_shipment_event" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "shipmentId" integer NOT NULL,
        "provider" varchar(20) NOT NULL,
        "providerEventId" varchar(120),
        "providerStatus" varchar(100),
        "status" varchar(50) NOT NULL,
        "description" text,
        "location" varchar(255),
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "rawPayload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_lp_shipment_event" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_shipment_event_shipment" FOREIGN KEY ("shipmentId") REFERENCES "lp_shipment"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_shipment_event_tenant" ON "lp_shipment_event" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_shipment_event_timeline" ON "lp_shipment_event" ("tenantId", "shipmentId", "occurredAt")`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_lp_shipment_event_provider_id" ON "lp_shipment_event" ("tenantId", "providerEventId") WHERE "providerEventId" IS NOT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_shipment_event"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_shipment_tenant_idempotency"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "estimatedDeliveryAt"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "providerStatus"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "idempotencyKey"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "providerOrderId"`)
  }
}
