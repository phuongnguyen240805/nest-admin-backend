import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Reverse-derived core tables for App Store, Ladiwork, Automation, Landing, Domain, and Reports.
 */
export class ReverseMissingFeatures1754000000000 implements MigrationInterface {
  name = 'ReverseMissingFeatures1754000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_application" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "ladi_uid" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(100) NOT NULL,
        "logo" varchar(500),
        "thumb" varchar(500),
        "price" integer NOT NULL DEFAULT 0,
        "status_active" boolean NOT NULL DEFAULT false,
        "status_actived_at" TIMESTAMPTZ,
        "status_pin" boolean NOT NULL DEFAULT false,
        "is_delete" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_lp_application" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_app_tenant_ext" ON "lp_application" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_app_tenant_store_code" ON "lp_application" ("tenantId", "store_id", "code")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_app_tenant_owner" ON "lp_application" ("tenantId", "owner_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_crm_pipeline" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "creator_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "alias" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "scope_type" varchar(50) NOT NULL DEFAULT 'PRIVATE',
        "pipeline_category_id" varchar(64),
        "category_id" varchar(64),
        "avatar" varchar(500),
        "count" integer NOT NULL DEFAULT 0,
        "deal_probability" boolean NOT NULL DEFAULT false,
        "is_delete" boolean NOT NULL DEFAULT false,
        "privacy_mode" boolean NOT NULL DEFAULT false,
        "notification" boolean NOT NULL DEFAULT false,
        "timer_notification" varchar(100),
        "unit_notification" varchar(30) NOT NULL DEFAULT 'MONTH',
        "next_time_check_notification_deal_delayer" TIMESTAMPTZ,
        "stages" jsonb NOT NULL DEFAULT '[]',
        "custom_fields" jsonb NOT NULL DEFAULT '[]',
        "pipelines" jsonb NOT NULL DEFAULT '[]',
        "prioritize_ladiuid" jsonb NOT NULL DEFAULT '[]',
        "scope_users" jsonb NOT NULL DEFAULT '[]',
        "scope_object_users" jsonb NOT NULL DEFAULT '[]',
        "scope_teams" jsonb NOT NULL DEFAULT '[]',
        CONSTRAINT "PK_lp_crm_pipeline" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_pipeline_tenant_ext" ON "lp_crm_pipeline" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_pipeline_tenant_owner" ON "lp_crm_pipeline" ("tenantId", "owner_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_pipeline_tenant_store" ON "lp_crm_pipeline" ("tenantId", "store_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_crm_deal" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "pipeline_id" varchar(64) NOT NULL,
        "pipeline_stage_id" varchar(64) NOT NULL,
        "title" varchar(255) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'OPEN',
        "position" integer NOT NULL DEFAULT 0,
        "total_value" integer NOT NULL DEFAULT 0,
        "weighted_value" integer NOT NULL DEFAULT 0,
        "priority" integer NOT NULL DEFAULT 0,
        "activity_status" varchar(50),
        "expected_close_date" TIMESTAMPTZ,
        "customer_id" varchar(64),
        "customer_name" varchar(255),
        "customer" jsonb NOT NULL DEFAULT '{}',
        "identity_id" integer,
        "stage_probability" integer NOT NULL DEFAULT 0,
        "final_probability" integer NOT NULL DEFAULT 0,
        "total_deal_notes" integer NOT NULL DEFAULT 0,
        "labels" jsonb NOT NULL DEFAULT '[]',
        "scope_users" jsonb NOT NULL DEFAULT '[]',
        CONSTRAINT "PK_lp_crm_deal" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_deal_tenant_ext" ON "lp_crm_deal" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_deal_tenant_pipe_stage" ON "lp_crm_deal" ("tenantId", "pipeline_id", "pipeline_stage_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_crm_filter" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" integer NOT NULL,
        "entity" varchar(100) NOT NULL,
        "key_name" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "filter_type" varchar(50) NOT NULL,
        "visibility" varchar(50) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_editable" boolean NOT NULL DEFAULT false,
        "is_temporary" boolean NOT NULL DEFAULT false,
        "conditions" jsonb NOT NULL DEFAULT '{}',
        "conditions_conditions" jsonb NOT NULL DEFAULT '[]',
        "conditions_glue" varchar(20) NOT NULL DEFAULT 'AND',
        CONSTRAINT "PK_lp_crm_filter" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_filter_tenant_ext" ON "lp_crm_filter" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_filter_entity_key" ON "lp_crm_filter" ("tenantId", "entity", "key_name")`)

    await queryRunner.query(`
      CREATE TABLE "lp_ladiwork_dashboard" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "widget_key" varchar(100) NOT NULL,
        "type" varchar(50) NOT NULL,
        "name" varchar(255),
        "visible" boolean NOT NULL DEFAULT true,
        "expanded" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL DEFAULT 0,
        "stage_id" varchar(64),
        "stage_name" varchar(255),
        "count" integer NOT NULL DEFAULT 0,
        "total_value" integer NOT NULL DEFAULT 0,
        "stages" jsonb NOT NULL DEFAULT '[]',
        CONSTRAINT "PK_lp_ladiwork_dashboard" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_lw_dash_tenant_ext" ON "lp_ladiwork_dashboard" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_lw_dash_widget" ON "lp_ladiwork_dashboard" ("tenantId", "widget_key")`)

    await queryRunner.query(`
      CREATE TABLE "lp_flow" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "creator_id" varchar(64) NOT NULL,
        "sub_owner_id" varchar(64),
        "name" varchar(255) NOT NULL,
        "alias" varchar(255) NOT NULL,
        "status" varchar(50) NOT NULL,
        "type" varchar(50),
        "scope_type" varchar(50) NOT NULL DEFAULT 'PRIVATE',
        "is_delete" boolean NOT NULL DEFAULT false,
        "is_sharing" boolean NOT NULL DEFAULT false,
        "total_subscribe" integer NOT NULL DEFAULT 0,
        "flow_config_count" integer NOT NULL DEFAULT 0,
        "updated_last" TIMESTAMPTZ,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "trigger_types" jsonb NOT NULL DEFAULT '[]',
        "integration_ids" jsonb NOT NULL DEFAULT '[]',
        "scope_users" jsonb NOT NULL DEFAULT '[]',
        "scope_teams" jsonb NOT NULL DEFAULT '[]',
        "graph" jsonb,
        CONSTRAINT "PK_lp_flow" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_flow_tenant_ext" ON "lp_flow" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_tenant_owner" ON "lp_flow" ("tenantId", "owner_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_tenant_store" ON "lp_flow" ("tenantId", "store_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_broadcast" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "creator_id" varchar(64) NOT NULL,
        "sub_owner_id" varchar(64),
        "flow_id" varchar(64),
        "name" varchar(255) NOT NULL,
        "alias" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(50) NOT NULL,
        "version" varchar(20),
        "scope_type" varchar(50) NOT NULL DEFAULT 'PRIVATE',
        "config_type" varchar(50),
        "is_delete" boolean NOT NULL DEFAULT false,
        "sent_date" TIMESTAMPTZ,
        "start_date" TIMESTAMPTZ,
        "total_click" integer NOT NULL DEFAULT 0,
        "total_delivery" integer NOT NULL DEFAULT 0,
        "total_read" integer NOT NULL DEFAULT 0,
        "total_send" integer NOT NULL DEFAULT 0,
        "segments" jsonb NOT NULL DEFAULT '[]',
        "tags" jsonb NOT NULL DEFAULT '[]',
        "conditions" jsonb NOT NULL DEFAULT '[]',
        "scope_users" jsonb NOT NULL DEFAULT '[]',
        "scope_teams" jsonb NOT NULL DEFAULT '[]',
        "email" jsonb NOT NULL DEFAULT '{}',
        "messenger" jsonb NOT NULL DEFAULT '{}',
        "sms" jsonb NOT NULL DEFAULT '{}',
        "zalo" jsonb NOT NULL DEFAULT '{}',
        "operator" jsonb,
        "send_limit_option" jsonb,
        CONSTRAINT "PK_lp_broadcast" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_broadcast_tenant_ext" ON "lp_broadcast" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_broadcast_tenant_owner" ON "lp_broadcast" ("tenantId", "owner_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_broadcast_tenant_store" ON "lp_broadcast" ("tenantId", "store_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_integration" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "creator_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "alias" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" boolean NOT NULL DEFAULT true,
        "is_delete" boolean NOT NULL DEFAULT false,
        "is_default" boolean NOT NULL DEFAULT false,
        "scope_type" varchar(50) NOT NULL DEFAULT 'PRIVATE',
        "scope_users" jsonb NOT NULL DEFAULT '[]',
        "scope_teams" jsonb NOT NULL DEFAULT '[]',
        "attachments" jsonb NOT NULL DEFAULT '[]',
        "config" jsonb NOT NULL DEFAULT '{}',
        "config__id" varchar(64),
        "config_api_key" varchar(255),
        "config_refresh_token" varchar(255),
        CONSTRAINT "PK_lp_integration" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_integration_tenant_ext" ON "lp_integration" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_integration_tenant_owner" ON "lp_integration" ("tenantId", "owner_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_integration_tenant_store" ON "lp_integration" ("tenantId", "store_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_flow_tag" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "creator_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "alias" varchar(255) NOT NULL,
        "total" integer NOT NULL DEFAULT 0,
        "is_delete" boolean NOT NULL DEFAULT false,
        "status" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_lp_flow_tag" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_flow_tag_tenant_ext" ON "lp_flow_tag" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_tag_tenant_owner" ON "lp_flow_tag" ("tenantId", "owner_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_flow_tag_tenant_store" ON "lp_flow_tag" ("tenantId", "store_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_page" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "store_id" varchar(64) NOT NULL,
        "owner_id" varchar(64) NOT NULL,
        "creator_id" varchar(64) NOT NULL,
        "name" varchar(255) NOT NULL,
        "alias" varchar(255) NOT NULL,
        "type" varchar(50) NOT NULL,
        "design_type" varchar(50) NOT NULL,
        "publish_platform" varchar(50),
        "origin_id" varchar(64),
        "domain" varchar(255),
        "path" varchar(255),
        "page_url" varchar(500),
        "url" varchar(500),
        "subdomain" varchar(255) NOT NULL DEFAULT '',
        "https" boolean NOT NULL DEFAULT false,
        "is_publish" boolean NOT NULL DEFAULT false,
        "is_delete" boolean NOT NULL DEFAULT false,
        "backup_count" integer NOT NULL DEFAULT 0,
        "last_update_source" TIMESTAMPTZ,
        "last_update_source_mobile" TIMESTAMPTZ,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "tag_ai" jsonb NOT NULL DEFAULT '[]',
        "content_versions" jsonb NOT NULL DEFAULT '[]',
        "scope_users" jsonb NOT NULL DEFAULT '[]',
        "scope_teams" jsonb NOT NULL DEFAULT '[]',
        "user_scopes" jsonb NOT NULL DEFAULT '[]',
        "form_inputs" jsonb NOT NULL DEFAULT '[]',
        "tracking" jsonb NOT NULL DEFAULT '{}',
        "tracking_total_visit" integer NOT NULL DEFAULT 0,
        "tracking_total_unique_visit" integer NOT NULL DEFAULT 0,
        "tracking_total_conversion" integer NOT NULL DEFAULT 0,
        "tracking_total_unique_conversion" integer NOT NULL DEFAULT 0,
        "tracking_cr" integer NOT NULL DEFAULT 0,
        "tracking_last_updated_at" TIMESTAMPTZ,
        "revenue" jsonb NOT NULL DEFAULT '{}',
        "revenue_total" integer NOT NULL DEFAULT 0,
        "revenue_currency" varchar(10) NOT NULL DEFAULT 'VND',
        "traking_data" text,
        "source" jsonb,
        CONSTRAINT "PK_lp_page" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_page_tenant_ext" ON "lp_page" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_page_tenant_store" ON "lp_page" ("tenantId", "store_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_page_tenant_owner" ON "lp_page" ("tenantId", "owner_id")`)

    await queryRunner.query(`
      CREATE TABLE "lp_domain" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "_id" varchar(64) NOT NULL,
        "domain" varchar(255) NOT NULL,
        "is_subdomain" boolean NOT NULL DEFAULT false,
        "subdomain_default" varchar(255) NOT NULL DEFAULT '',
        "status" boolean NOT NULL DEFAULT true,
        "is_preview" boolean NOT NULL DEFAULT false,
        "is_ssl" boolean NOT NULL DEFAULT false,
        "publish_platform" varchar(50) NOT NULL,
        "is_verified" boolean NOT NULL DEFAULT false,
        "is_delete" boolean NOT NULL DEFAULT false,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_hidden" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_lp_domain" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_domain_tenant_ext" ON "lp_domain" ("tenantId", "_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_domain_tenant_domain" ON "lp_domain" ("tenantId", "domain")`)

    await queryRunner.query(`
      CREATE TABLE "lp_analytics_report" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "report_type" varchar(50) NOT NULL DEFAULT 'top_product',
        "name" varchar(255) NOT NULL,
        "product_id" integer,
        "product_type" varchar(100),
        "quantity" integer NOT NULL DEFAULT 0,
        "total" integer NOT NULL DEFAULT 0,
        "num_order" integer NOT NULL DEFAULT 0,
        "source" varchar(100),
        "refund" varchar(100),
        "restock" integer NOT NULL DEFAULT 0,
        "up_sell_ids" varchar(500),
        "payload" jsonb,
        CONSTRAINT "PK_lp_analytics_report" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_report_tenant_type" ON "lp_analytics_report" ("tenantId", "report_type")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_report_tenant_product" ON "lp_analytics_report" ("tenantId", "product_id")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_analytics_report"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_domain"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_page"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_flow_tag"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_integration"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_broadcast"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_flow"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_ladiwork_dashboard"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_crm_filter"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_crm_deal"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_crm_pipeline"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_application"`)
  }
}
