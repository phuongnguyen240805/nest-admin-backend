import { MigrationInterface, QueryRunner } from 'typeorm'

export class BillingOrderPayos1756000000000 implements MigrationInterface {
  name = 'BillingOrderPayos1756000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS billing_order_code_seq
      START WITH 1000000000
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_order" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" integer NOT NULL,
        "organizationId" uuid NOT NULL,
        "orderCode" bigint NOT NULL,
        "paymentProvider" varchar(20) NOT NULL DEFAULT 'payos',
        "planTier" varchar(20) NOT NULL,
        "period" varchar(20) NOT NULL,
        "amountVnd" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'VND',
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "payosPaymentLinkId" varchar(64),
        "payosCheckoutUrl" text,
        "payosQrCode" text,
        "description" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "paidAt" TIMESTAMPTZ,
        "expiresAt" TIMESTAMPTZ,
        "webhookEventId" varchar(128),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_order" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_billing_order_orderCode" UNIQUE ("orderCode")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_order_organizationId"
      ON "billing_order" ("organizationId")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_order_status"
      ON "billing_order" ("status")
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_billing_order_webhookEventId"
      ON "billing_order" ("webhookEventId")
      WHERE "webhookEventId" IS NOT NULL
    `)

    await queryRunner.query(`
      ALTER TABLE "billing_order"
      ADD CONSTRAINT "FK_billing_order_organization"
      FOREIGN KEY ("organizationId") REFERENCES "sys_organizations"("id") ON DELETE CASCADE
    `).catch(() => undefined)

    await queryRunner.query(`
      ALTER TABLE "sys_subscription"
      ADD COLUMN IF NOT EXISTS "paymentProvider" varchar(20) DEFAULT 'stripe'
    `)

    await queryRunner.query(`
      ALTER TABLE "sys_subscription"
      ADD COLUMN IF NOT EXISTS "lastOrderId" uuid
    `)

    await queryRunner.query(`
      ALTER TABLE "sys_subscription"
      ADD CONSTRAINT "FK_sys_subscription_lastOrder"
      FOREIGN KEY ("lastOrderId") REFERENCES "billing_order"("id") ON DELETE SET NULL
    `).catch(() => undefined)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sys_subscription" DROP CONSTRAINT IF EXISTS "FK_sys_subscription_lastOrder"
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_subscription" DROP COLUMN IF EXISTS "lastOrderId"
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_subscription" DROP COLUMN IF EXISTS "paymentProvider"
    `)
    await queryRunner.query(`ALTER TABLE "billing_order" DROP CONSTRAINT IF EXISTS "FK_billing_order_organization"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_order_webhookEventId"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_order_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_order_organizationId"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_order"`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS billing_order_code_seq`)
  }
}