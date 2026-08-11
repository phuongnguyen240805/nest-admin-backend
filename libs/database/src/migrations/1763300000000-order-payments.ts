import { MigrationInterface, QueryRunner } from 'typeorm'

export class OrderPayments1763300000000 implements MigrationInterface {
  name = 'OrderPayments1763300000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_order_payment" (
        "id" SERIAL NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "order_id" integer NOT NULL,
        "provider" varchar(30) NOT NULL,
        "method" varchar(40) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "amount" decimal(14,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'VND',
        "reference_code" varchar(80),
        "provider_transaction_id" varchar(120),
        "idempotency_key" varchar(120),
        "qr_url" text,
        "paid_at" timestamptz,
        "expired_at" timestamptz,
        "cancelled_at" timestamptz,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_lp_order_payment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_order_payment_order" FOREIGN KEY ("order_id") REFERENCES "lp_order"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_order_payment_tenant_order" ON "lp_order_payment" ("tenantId", "order_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_payment_active_provider" ON "lp_order_payment" ("tenantId", "order_id", "provider") WHERE "status" IN ('PENDING', 'COD_PENDING')`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_payment_reference" ON "lp_order_payment" ("reference_code") WHERE "reference_code" IS NOT NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_payment_idempotency" ON "lp_order_payment" ("tenantId", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_payment_provider_tx" ON "lp_order_payment" ("provider", "provider_transaction_id") WHERE "provider_transaction_id" IS NOT NULL`)

    await queryRunner.query(`
      CREATE TABLE "lp_order_payment_event" (
        "id" SERIAL NOT NULL,
        "tenant_id" integer NOT NULL,
        "payment_id" integer NOT NULL,
        "type" varchar(80) NOT NULL,
        "status" varchar(30) NOT NULL,
        "provider_event_id" varchar(120),
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_order_payment_event" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_order_payment_event_payment" FOREIGN KEY ("payment_id") REFERENCES "lp_order_payment"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_order_payment_event_tenant_payment" ON "lp_order_payment_event" ("tenant_id", "payment_id", "created_at")`)

    await queryRunner.query(`
      CREATE TABLE "lp_payment_webhook_event" (
        "id" SERIAL NOT NULL,
        "tenant_id" integer,
        "payment_id" integer,
        "provider" varchar(30) NOT NULL DEFAULT 'sepay',
        "provider_event_id" varchar(120) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'received',
        "last_error" text,
        "payload" jsonb NOT NULL,
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_payment_webhook_event" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_payment_webhook_payment" FOREIGN KEY ("payment_id") REFERENCES "lp_order_payment"("id") ON DELETE SET NULL
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_payment_webhook_provider_event" ON "lp_payment_webhook_event" ("provider", "provider_event_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_payment_webhook_event"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_order_payment_event"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_order_payment"`)
  }
}
