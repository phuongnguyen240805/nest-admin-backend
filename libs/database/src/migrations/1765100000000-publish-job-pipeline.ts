import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Durable source of truth for Phase 7 async landing publish jobs.
 * BullMQ delivery is deliberately not the source of truth: a worker-side
 * reconciler can recreate missing queue entries from rows that remain queued.
 */
export class PublishJobPipeline1765100000000 implements MigrationInterface {
  name = 'PublishJobPipeline1765100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_publish_job" (
        "id" SERIAL NOT NULL,
        "tenantId" integer NOT NULL,
        "job_id" varchar(64) NOT NULL,
        "user_id" integer NOT NULL,
        "owner_id" uuid NOT NULL,
        "page_id" varchar(64) NOT NULL,
        "organization_id" uuid NULL,
        "idempotency_key" varchar(128) NOT NULL,
        "request_hash" varchar(64) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'queued',
        "step" varchar(64) NOT NULL DEFAULT 'queued',
        "progress" integer NOT NULL DEFAULT 0,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb NULL,
        "error_code" varchar(64) NULL,
        "error_message" text NULL,
        "queue_attempts" integer NOT NULL DEFAULT 0,
        "started_at" timestamptz NULL,
        "finished_at" timestamptz NULL,
        "create_by" integer NULL,
        "update_by" integer NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_publish_job" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lp_publish_job_job_id" UNIQUE ("job_id"),
        CONSTRAINT "UQ_lp_publish_job_idempotency"
          UNIQUE ("tenantId", "user_id", "page_id", "idempotency_key"),
        CONSTRAINT "CHK_lp_publish_job_progress" CHECK ("progress" BETWEEN 0 AND 100)
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_publish_job_tenant_status_created"
      ON "lp_publish_job" ("tenantId", "status", "created_at")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_publish_job_user_created"
      ON "lp_publish_job" ("tenantId", "user_id", "created_at" DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_publish_job"`)
  }
}
