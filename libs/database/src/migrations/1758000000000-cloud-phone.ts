import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Cloud Phone (GADS device farm bridge) — phase 1 tables.
 * Nest owns the rental/billing/session lifecycle; GADS only owns the physical
 * device lock. All tables are tenant-scoped (isolation via tenantId).
 */
export class CloudPhone1758000000000 implements MigrationInterface {
  name = 'CloudPhone1758000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- lp_cloud_phone_plan ---
    await queryRunner.query(`
      CREATE TABLE "lp_cloud_phone_plan" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "code" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "priceDayVnd" integer NOT NULL DEFAULT 0,
        "priceWeekVnd" integer NOT NULL DEFAULT 0,
        "priceMonthVnd" integer NOT NULL DEFAULT 0,
        "deviceGroup" varchar(100),
        "cpu" varchar(50),
        "ram" varchar(50),
        "os" varchar(50),
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_lp_cloud_phone_plan" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_plan_tenantId" ON "lp_cloud_phone_plan" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_cloud_phone_plan_tenant_code" ON "lp_cloud_phone_plan" ("tenantId", "code")`)

    // --- lp_cloud_phone_booking ---
    await queryRunner.query(`
      CREATE TABLE "lp_cloud_phone_booking" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "userId" varchar(64) NOT NULL,
        "gadsUdid" varchar(128) NOT NULL,
        "deviceName" varchar(255),
        "planCode" varchar(64) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "bookedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "releasedAt" TIMESTAMP,
        CONSTRAINT "PK_lp_cloud_phone_booking" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_booking_tenantId" ON "lp_cloud_phone_booking" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_booking_tenant_status" ON "lp_cloud_phone_booking" ("tenantId", "status")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_booking_tenant_udid" ON "lp_cloud_phone_booking" ("tenantId", "gadsUdid")`)

    // --- lp_cloud_phone_session ---
    await queryRunner.query(`
      CREATE TABLE "lp_cloud_phone_session" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "bookingId" integer NOT NULL,
        "gadsSessionId" varchar(128),
        "status" varchar(20) NOT NULL DEFAULT 'STARTING',
        "streamType" varchar(40),
        "startedAt" TIMESTAMP,
        "endedAt" TIMESTAMP,
        "durationSeconds" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_lp_cloud_phone_session" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_session_tenantId" ON "lp_cloud_phone_session" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_session_tenant_booking" ON "lp_cloud_phone_session" ("tenantId", "bookingId")`)

    // --- lp_cloud_phone_action_log ---
    await queryRunner.query(`
      CREATE TABLE "lp_cloud_phone_action_log" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "sessionId" integer NOT NULL,
        "actionType" varchar(32) NOT NULL,
        "payload" jsonb,
        CONSTRAINT "PK_lp_cloud_phone_action_log" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_action_log_tenantId" ON "lp_cloud_phone_action_log" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_cloud_phone_action_log_tenant_session" ON "lp_cloud_phone_action_log" ("tenantId", "sessionId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_cloud_phone_action_log"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_cloud_phone_session"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_cloud_phone_booking"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_cloud_phone_plan"`)
  }
}
