import { MigrationInterface, QueryRunner } from 'typeorm'

export class OrderLifecycleV21763200000000 implements MigrationInterface {
  name = 'OrderLifecycleV21763200000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "business_status" varchar(30) NOT NULL DEFAULT 'CONFIRMED'`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "payment_status" varchar(30) NOT NULL DEFAULT 'UNKNOWN'`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "fulfillment_status" varchar(30) NOT NULL DEFAULT 'UNFULFILLED'`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamptz`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz`)
    await queryRunner.query(`ALTER TABLE "lp_order" ADD COLUMN IF NOT EXISTS "cancel_reason" text`)

    await queryRunner.query(`
      UPDATE "lp_order"
      SET "business_status" = CASE
        WHEN "status" = 'SPAM' THEN 'SPAM'
        WHEN "status" = 'COMPLETED' THEN 'COMPLETED'
        WHEN "isIncomplete" = true THEN 'DRAFT'
        ELSE 'CONFIRMED'
      END,
      "payment_status" = CASE
        WHEN "status" = 'UNPAID' THEN 'PENDING'
        WHEN lower(COALESCE("paymentMethod", '')) IN ('cod', 'cash_on_delivery', 'cash-on-delivery') THEN 'COD_PENDING'
        ELSE 'UNKNOWN'
      END,
      "fulfillment_status" = CASE
        WHEN "status" = 'SHIPPED' THEN 'SHIPPED'
        ELSE 'UNFULFILLED'
      END,
      "confirmed_at" = CASE
        WHEN "status" NOT IN ('SPAM') AND "isIncomplete" = false THEN COALESCE("confirmed_at", "created_at")
        ELSE "confirmed_at"
      END,
      "completed_at" = CASE
        WHEN "status" = 'COMPLETED' THEN COALESCE("completed_at", "updated_at")
        ELSE "completed_at"
      END
    `)

    await queryRunner.query(`
      UPDATE "lp_order" o
      SET "fulfillment_status" = CASE s."status"
        WHEN 'WAITING_PICKUP' THEN 'READY_TO_SHIP'
        WHEN 'PICKING_UP' THEN 'READY_TO_SHIP'
        WHEN 'PICKED_UP' THEN 'SHIPPED'
        WHEN 'IN_TRANSIT' THEN 'IN_TRANSIT'
        WHEN 'DELIVERING' THEN 'DELIVERING'
        WHEN 'DELIVERED' THEN 'DELIVERED'
        WHEN 'DELIVERY_FAILED' THEN 'DELIVERY_FAILED'
        WHEN 'RETURNING' THEN 'RETURNING'
        WHEN 'RETURNED' THEN 'RETURNED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        ELSE o."fulfillment_status"
      END
      FROM "lp_shipment" s
      WHERE s."tenantId" = o."tenantId" AND s."orderId" = o."id"
    `)

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_order_tenant_business_status" ON "lp_order" ("tenantId", "business_status")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_order_tenant_payment_status" ON "lp_order" ("tenantId", "payment_status")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lp_order_tenant_fulfillment_status" ON "lp_order" ("tenantId", "fulfillment_status")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_order_tenant_fulfillment_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_order_tenant_payment_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lp_order_tenant_business_status"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "cancel_reason"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "cancelled_at"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "completed_at"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "confirmed_at"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "fulfillment_status"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "payment_status"`)
    await queryRunner.query(`ALTER TABLE "lp_order" DROP COLUMN IF EXISTS "business_status"`)
  }
}
