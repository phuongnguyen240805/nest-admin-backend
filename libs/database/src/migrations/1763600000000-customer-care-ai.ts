import { MigrationInterface, QueryRunner } from 'typeorm'

export class CustomerCareAi1763600000000 implements MigrationInterface {
  name = 'CustomerCareAi1763600000000'

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "cc_ai_tenant_config" ("id" SERIAL PRIMARY KEY, "tenant_id" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "mode" varchar(30) NOT NULL DEFAULT 'copilot', "model" varchar(160), "temperature" double precision NOT NULL DEFAULT 0.2, "max_output_tokens" integer NOT NULL DEFAULT 1200, "prompt_version" varchar(80) NOT NULL DEFAULT 'cc-v1', "daily_budget" decimal(14,4), "auto_reply_enabled" boolean NOT NULL DEFAULT false, "auto_action_enabled" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE UNIQUE INDEX "IDX_cc_ai_tenant_config_tenant" ON "cc_ai_tenant_config" ("tenant_id")`)

    await q.query(`CREATE TABLE "cc_ai_job" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" integer NOT NULL, "conversation_id" uuid NOT NULL, "trigger_message_id" varchar(220), "job_type" varchar(40) NOT NULL, "status" varchar(30) NOT NULL DEFAULT 'queued', "priority" integer NOT NULL DEFAULT 10, "attempts" integer NOT NULL DEFAULT 0, "started_at" timestamptz, "completed_at" timestamptz, "error_code" varchar(80), "error_message" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE INDEX "IDX_cc_ai_job_case" ON "cc_ai_job" ("tenant_id", "conversation_id", "created_at")`)

    await q.query(`CREATE TABLE "cc_ai_result" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "job_id" uuid NOT NULL REFERENCES "cc_ai_job"("id") ON DELETE CASCADE, "tenant_id" integer NOT NULL, "conversation_id" uuid NOT NULL, "result_type" varchar(40) NOT NULL, "content" text NOT NULL, "structured_result" jsonb NOT NULL DEFAULT '{}'::jsonb, "model" varchar(160), "gateway" varchar(60), "prompt_version" varchar(80) NOT NULL, "usage" jsonb NOT NULL DEFAULT '{}'::jsonb, "latency_ms" integer, "created_at" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE INDEX "IDX_cc_ai_result_case" ON "cc_ai_result" ("tenant_id", "conversation_id", "created_at")`)

    await q.query(`CREATE TABLE "cc_ai_feedback" ("id" SERIAL PRIMARY KEY, "tenant_id" integer NOT NULL, "result_id" uuid NOT NULL REFERENCES "cc_ai_result"("id") ON DELETE CASCADE, "user_id" integer NOT NULL, "rating" smallint NOT NULL, "reason" varchar(500), "edited_content" text, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "CHK_cc_ai_feedback_rating" CHECK ("rating" BETWEEN -1 AND 1))`)
    await q.query(`CREATE INDEX "IDX_cc_ai_feedback_result" ON "cc_ai_feedback" ("tenant_id", "result_id", "user_id")`)

    await q.query(`CREATE TABLE "cc_ai_action_request" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" integer NOT NULL, "conversation_id" uuid NOT NULL, "job_id" uuid REFERENCES "cc_ai_job"("id") ON DELETE SET NULL, "action_type" varchar(80) NOT NULL, "arguments" jsonb NOT NULL DEFAULT '{}'::jsonb, "risk_level" varchar(20) NOT NULL DEFAULT 'medium', "policy_result" jsonb NOT NULL DEFAULT '{}'::jsonb, "status" varchar(30) NOT NULL DEFAULT 'proposed', "proposed_by_model" varchar(160), "approved_by" integer, "approved_at" timestamptz, "executed_at" timestamptz, "execution_result" jsonb, "idempotency_key" varchar(120), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE INDEX "IDX_cc_ai_action_case" ON "cc_ai_action_request" ("tenant_id", "conversation_id", "status")`)
    await q.query(`CREATE UNIQUE INDEX "IDX_cc_ai_action_idempotency" ON "cc_ai_action_request" ("tenant_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`)

    await q.query(`CREATE TABLE "cc_ai_tool_call" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenant_id" integer NOT NULL, "job_id" uuid NOT NULL REFERENCES "cc_ai_job"("id") ON DELETE CASCADE, "conversation_id" uuid NOT NULL, "tool_name" varchar(120) NOT NULL, "arguments" jsonb NOT NULL DEFAULT '{}'::jsonb, "result_summary" jsonb, "result_hash" varchar(64), "status" varchar(30) NOT NULL, "duration_ms" integer NOT NULL, "error" text, "created_at" timestamptz NOT NULL DEFAULT now())`)
    await q.query(`CREATE INDEX "IDX_cc_ai_tool_call_job" ON "cc_ai_tool_call" ("tenant_id", "job_id", "created_at")`)
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "cc_ai_tool_call"`)
    await q.query(`DROP TABLE IF EXISTS "cc_ai_action_request"`)
    await q.query(`DROP TABLE IF EXISTS "cc_ai_feedback"`)
    await q.query(`DROP TABLE IF EXISTS "cc_ai_result"`)
    await q.query(`DROP TABLE IF EXISTS "cc_ai_job"`)
    await q.query(`DROP TABLE IF EXISTS "cc_ai_tenant_config"`)
  }
}
