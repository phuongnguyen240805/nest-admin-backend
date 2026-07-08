import { MigrationInterface, QueryRunner } from 'typeorm'

export class LandingAiJobs1756100000000 implements MigrationInterface {
  name = 'LandingAiJobs1756100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_landing_ai_job" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" integer NOT NULL,
        "user_id" varchar(64) NOT NULL,
        "page_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'queued',
        "progress" smallint NOT NULL DEFAULT 0,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb,
        "error_message" text,
        "bull_job_id" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "started_at" timestamptz,
        "completed_at" timestamptz,
        CONSTRAINT "PK_lp_landing_ai_job" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_landing_ai_job_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "message" text NOT NULL,
        "progress" smallint,
        "meta" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_landing_ai_job_event" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lp_landing_ai_job_event_job"
          FOREIGN KEY ("job_id") REFERENCES "lp_landing_ai_job"("id") ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_landing_ai_job_tenant"
        ON "lp_landing_ai_job" ("tenant_id", "created_at" DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_landing_ai_job_status"
        ON "lp_landing_ai_job" ("status")
        WHERE "status" IN ('queued', 'running')
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_lp_landing_ai_job_event_job"
        ON "lp_landing_ai_job_event" ("job_id", "created_at" ASC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_landing_ai_job_event_job"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_landing_ai_job_status"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lp_landing_ai_job_tenant"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_landing_ai_job_event"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_landing_ai_job"`)
  }
}