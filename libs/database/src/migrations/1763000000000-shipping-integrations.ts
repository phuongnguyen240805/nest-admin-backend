import { MigrationInterface, QueryRunner } from 'typeorm'

export class ShippingIntegrations1763000000000 implements MigrationInterface {
  name = 'ShippingIntegrations1763000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_shipping_integration" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "provider" varchar(20) NOT NULL,
        "name" varchar(100) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "ciphertext" text NOT NULL,
        "iv" varchar(64) NOT NULL,
        "authTag" varchar(64) NOT NULL,
        "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "connectedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_lp_shipping_integration" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_shipping_integration_tenantId" ON "lp_shipping_integration" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_shipping_integration_tenant_provider" ON "lp_shipping_integration" ("tenantId", "provider")`)

    await queryRunner.query(`
      CREATE TABLE "lp_shipment" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "orderId" integer NOT NULL,
        "integrationId" integer NOT NULL,
        "provider" varchar(20) NOT NULL,
        "trackingCode" varchar(120),
        "serviceCode" varchar(80),
        "serviceName" varchar(150),
        "status" varchar(50) NOT NULL DEFAULT 'CREATED',
        "fee" decimal(14,2) NOT NULL DEFAULT 0,
        "codAmount" decimal(14,2) NOT NULL DEFAULT 0,
        "recipientName" varchar(255) NOT NULL,
        "recipientPhone" varchar(30) NOT NULL,
        "address" text NOT NULL,
        "province" varchar(120),
        "district" varchar(120),
        "ward" varchar(120),
        "providerPayload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "lastTrackedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_lp_shipment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_shipment_order" FOREIGN KEY ("orderId") REFERENCES "lp_order"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lp_shipment_integration" FOREIGN KEY ("integrationId") REFERENCES "lp_shipping_integration"("id") ON DELETE RESTRICT
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_shipment_tenantId" ON "lp_shipment" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_shipment_tenant_order" ON "lp_shipment" ("tenantId", "orderId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_shipment_tenant_tracking" ON "lp_shipment" ("tenantId", "trackingCode")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_shipment"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_shipping_integration"`)
  }
}
