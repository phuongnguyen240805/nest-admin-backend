import { MigrationInterface, QueryRunner } from 'typeorm'

export class ShippingOrchestration1763800000000 implements MigrationInterface {
  name = 'ShippingOrchestration1763800000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "subtotal" decimal(14,2) NOT NULL DEFAULT 0`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "shipping_fee" decimal(14,2) NOT NULL DEFAULT 0`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "discount" decimal(14,2) NOT NULL DEFAULT 0`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "shipping_payer" varchar(20) NOT NULL DEFAULT 'customer'`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "shipping_quote_id" integer`)
    await queryRunner.query(`UPDATE "lp_order" SET "subtotal" = "total" WHERE "subtotal" = 0`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_shipping_quote" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "provider" varchar(20) NOT NULL,
        "serviceCode" varchar(80),
        "serviceName" varchar(150),
        "total" decimal(14,2) NOT NULL DEFAULT 0,
        "serviceFee" decimal(14,2) NOT NULL DEFAULT 0,
        "insuranceFee" decimal(14,2) NOT NULL DEFAULT 0,
        "requestPayload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "providerPayload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "consumedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_lp_shipping_quote" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_shipping_quote_tenant_expiry" ON "lp_shipping_quote" ("tenantId", "expiresAt")`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD CONSTRAINT "FK_lp_order_shipping_quote" FOREIGN KEY ("shipping_quote_id") REFERENCES "lp_shipping_quote"("id") ON DELETE SET NULL`)

    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "last_error" text`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "request_payload" jsonb NOT NULL DEFAULT '{}'::jsonb`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD COLUMN IF NOT EXISTS "quote_id" integer`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" ADD CONSTRAINT "FK_lp_shipment_quote" FOREIGN KEY ("quote_id") REFERENCES "lp_shipping_quote"("id") ON DELETE SET NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP CONSTRAINT IF EXISTS "FK_lp_shipment_quote"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "quote_id"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "request_payload"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "last_error"`)
    await queryRunner.query(`ALTER TABLE "lp_shipment" DROP COLUMN IF EXISTS "attempt_count"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP CONSTRAINT IF EXISTS "FK_lp_order_shipping_quote"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_shipping_quote"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "shipping_quote_id"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "shipping_payer"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "discount"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "shipping_fee"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "subtotal"`)
  }
}
