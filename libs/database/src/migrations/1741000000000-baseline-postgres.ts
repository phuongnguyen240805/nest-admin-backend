import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * PostgreSQL baseline schema — generated from TypeORM entities (nest-core).
 * Replaces legacy MySQL migrations archived under migrations/archive/mysql/.
 */
export class BaselinePostgres1741000000000 implements MigrationInterface {
  name = 'BaselinePostgres1741000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

    await queryRunner.query(`
      CREATE TYPE "subscription_tier_enum" AS ENUM ('free', 'pro', 'enterprise', 'lifetime')
    `)
    await queryRunner.query(`
      CREATE TYPE "period_enum" AS ENUM ('monthly', 'yearly', 'lifetime')
    `)
    await queryRunner.query(`
      CREATE TYPE "short_link_preference_enum" AS ENUM ('ASK', 'ALWAYS', 'NEVER')
    `)
    await queryRunner.query(`
      CREATE TYPE "agent_category_enum" AS ENUM ('content', 'video', 'social', 'analysis', 'automation')
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "apiKey" varchar(255),
        "paymentId" varchar(255),
        "streakSince" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "allowTrial" boolean NOT NULL DEFAULT false,
        "isTrailing" boolean NOT NULL DEFAULT false,
        "shortlink" "short_link_preference_enum" NOT NULL DEFAULT 'ASK',
        CONSTRAINT "PK_sys_organizations" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_sys_organizations_apiKey" ON "sys_organizations" ("apiKey")`)
    await queryRunner.query(`CREATE INDEX "IDX_sys_organizations_streakSince" ON "sys_organizations" ("streakSince")`)
    await queryRunner.query(`CREATE INDEX "IDX_sys_organizations_paymentId" ON "sys_organizations" ("paymentId")`)

    await queryRunner.query(`
      CREATE TABLE "sys_dept" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "name" varchar NOT NULL,
        "orderNo" integer DEFAULT 0,
        "mpath" varchar DEFAULT '',
        "parentId" integer,
        CONSTRAINT "PK_sys_dept" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_role" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "name" varchar(50) NOT NULL,
        "value" varchar NOT NULL,
        "remark" varchar,
        "status" smallint DEFAULT 1,
        "default" boolean,
        CONSTRAINT "UQ_sys_role_name" UNIQUE ("name"),
        CONSTRAINT "UQ_sys_role_value" UNIQUE ("value"),
        CONSTRAINT "PK_sys_role" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_menu" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "parent_id" integer,
        "name" varchar NOT NULL,
        "path" varchar,
        "permission" varchar,
        "type" smallint NOT NULL DEFAULT 0,
        "icon" varchar DEFAULT '',
        "order_no" integer DEFAULT 0,
        "component" varchar,
        "is_ext" boolean NOT NULL DEFAULT false,
        "ext_open_mode" smallint NOT NULL DEFAULT 1,
        "keep_alive" smallint NOT NULL DEFAULT 1,
        "show" smallint NOT NULL DEFAULT 1,
        "active_menu" varchar,
        "status" smallint NOT NULL DEFAULT 1,
        CONSTRAINT "PK_sys_menu" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_dict_type" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "name" varchar(50) NOT NULL,
        "code" varchar(50) NOT NULL,
        "status" smallint NOT NULL DEFAULT 1,
        "remark" varchar,
        CONSTRAINT "UQ_sys_dict_type_code" UNIQUE ("code"),
        CONSTRAINT "PK_sys_dict_type" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_config" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar(50) NOT NULL,
        "key" varchar(50) NOT NULL,
        "value" varchar,
        "remark" varchar,
        CONSTRAINT "UQ_sys_config_key" UNIQUE ("key"),
        CONSTRAINT "PK_sys_config" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_task" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar(50) NOT NULL,
        "service" varchar NOT NULL,
        "type" smallint NOT NULL DEFAULT 0,
        "status" smallint NOT NULL DEFAULT 1,
        "start_time" TIMESTAMP,
        "end_time" TIMESTAMP,
        "limit" integer DEFAULT 0,
        "cron" varchar,
        "every" integer,
        "data" text,
        "job_opts" text,
        "remark" varchar,
        CONSTRAINT "UQ_sys_task_name" UNIQUE ("name"),
        CONSTRAINT "PK_sys_task" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_user" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "username" varchar NOT NULL,
        "isSuperAdmin" boolean NOT NULL DEFAULT false,
        "organizationId" uuid,
        "password" varchar NOT NULL,
        "psalt" varchar(32) NOT NULL,
        "nickname" varchar,
        "avatar" varchar,
        "qq" varchar,
        "email" varchar,
        "supabase_user_id" uuid,
        "phone" varchar,
        "remark" varchar,
        "status" smallint DEFAULT 1,
        "dept_id" integer,
        CONSTRAINT "UQ_sys_user_username" UNIQUE ("username"),
        CONSTRAINT "UQ_sys_user_supabase_user_id" UNIQUE ("supabase_user_id"),
        CONSTRAINT "PK_sys_user" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_dict_item" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "type_id" integer,
        "label" varchar(50) NOT NULL,
        "value" varchar(50) NOT NULL,
        "orderNo" integer,
        "status" smallint NOT NULL DEFAULT 1,
        "remark" varchar,
        CONSTRAINT "PK_sys_dict_item" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_user_roles" (
        "user_id" integer NOT NULL,
        "role_id" integer NOT NULL,
        CONSTRAINT "PK_sys_user_roles" PRIMARY KEY ("user_id", "role_id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_role_menus" (
        "role_id" integer NOT NULL,
        "menu_id" integer NOT NULL,
        CONSTRAINT "PK_sys_role_menus" PRIMARY KEY ("role_id", "menu_id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_login_log" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "ip" varchar,
        "address" varchar,
        "provider" varchar,
        "ua" varchar(500),
        "user_id" integer,
        CONSTRAINT "PK_sys_login_log" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_captcha_log" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" integer,
        "account" varchar,
        "code" varchar,
        "provider" varchar,
        CONSTRAINT "PK_sys_captcha_log" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_task_log" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "status" smallint NOT NULL DEFAULT 0,
        "detail" text,
        "consume_time" integer DEFAULT 0,
        "task_id" integer,
        CONSTRAINT "PK_sys_task_log" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "todo" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "value" varchar NOT NULL,
        "status" boolean NOT NULL DEFAULT false,
        "user_id" integer,
        CONSTRAINT "PK_todo" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "tool_storage" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar(200) NOT NULL,
        "fileName" varchar(200),
        "ext_name" varchar,
        "path" varchar NOT NULL,
        "type" varchar,
        "size" varchar,
        "user_id" integer,
        CONSTRAINT "PK_tool_storage" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "user_access_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "value" varchar(500) NOT NULL,
        "expired_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" integer,
        CONSTRAINT "PK_user_access_tokens" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "user_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "value" varchar(500) NOT NULL,
        "expired_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "accessTokenId" uuid,
        CONSTRAINT "PK_user_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_refresh_tokens_accessTokenId" UNIQUE ("accessTokenId")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_subscription" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "subscriptionTier" "subscription_tier_enum" NOT NULL DEFAULT 'free',
        "identifier" varchar,
        "cancelAt" TIMESTAMP,
        "period" "period_enum" NOT NULL DEFAULT 'monthly',
        "totalChannels" integer NOT NULL DEFAULT 0,
        "isLifetime" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "UQ_sys_subscription_organizationId" UNIQUE ("organizationId"),
        CONSTRAINT "PK_sys_subscription" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_sys_subscription_deletedAt" ON "sys_subscription" ("deletedAt")`)

    await queryRunner.query(`
      CREATE TABLE "sys_credit_wallet" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "balance" numeric(12,2) NOT NULL DEFAULT 0,
        "totalSpent" numeric(12,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_credit_wallet" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sys_agent" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "category" "agent_category_enum" NOT NULL,
        "topics" text,
        "graphJson" json,
        "description" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "organizationId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_sys_agent" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "handle" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "logo" varchar,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "settings" json,
        CONSTRAINT "UQ_tenants_handle" UNIQUE ("handle"),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "tenant_users" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "email" varchar(100) NOT NULL,
        "role" varchar(50) NOT NULL DEFAULT 'owner',
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_tenant_users" PRIMARY KEY ("id")
      )
    `)

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD CONSTRAINT "FK_sys_user_organization"
      FOREIGN KEY ("organizationId") REFERENCES "sys_organizations"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user"
      ADD CONSTRAINT "FK_sys_user_dept"
      FOREIGN KEY ("dept_id") REFERENCES "sys_dept"("id") ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_dict_item"
      ADD CONSTRAINT "FK_sys_dict_item_type"
      FOREIGN KEY ("type_id") REFERENCES "sys_dict_type"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user_roles"
      ADD CONSTRAINT "FK_sys_user_roles_user"
      FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user_roles"
      ADD CONSTRAINT "FK_sys_user_roles_role"
      FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_role_menus"
      ADD CONSTRAINT "FK_sys_role_menus_role"
      FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_role_menus"
      ADD CONSTRAINT "FK_sys_role_menus_menu"
      FOREIGN KEY ("menu_id") REFERENCES "sys_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_login_log"
      ADD CONSTRAINT "FK_sys_login_log_user"
      FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_task_log"
      ADD CONSTRAINT "FK_sys_task_log_task"
      FOREIGN KEY ("task_id") REFERENCES "sys_task"("id") ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "todo"
      ADD CONSTRAINT "FK_todo_user"
      FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE SET NULL
    `)
    await queryRunner.query(`
      ALTER TABLE "user_access_tokens"
      ADD CONSTRAINT "FK_user_access_tokens_user"
      FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "user_refresh_tokens"
      ADD CONSTRAINT "FK_user_refresh_tokens_access_token"
      FOREIGN KEY ("accessTokenId") REFERENCES "user_access_tokens"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_subscription"
      ADD CONSTRAINT "FK_sys_subscription_organization"
      FOREIGN KEY ("organizationId") REFERENCES "sys_organizations"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_agent"
      ADD CONSTRAINT "FK_sys_agent_organization"
      FOREIGN KEY ("organizationId") REFERENCES "sys_organizations"("id") ON DELETE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE "tenant_users"
      ADD CONSTRAINT "FK_tenant_users_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_users" DROP CONSTRAINT IF EXISTS "FK_tenant_users_tenant"`)
    await queryRunner.query(`ALTER TABLE "sys_agent" DROP CONSTRAINT IF EXISTS "FK_sys_agent_organization"`)
    await queryRunner.query(`ALTER TABLE "sys_subscription" DROP CONSTRAINT IF EXISTS "FK_sys_subscription_organization"`)
    await queryRunner.query(`ALTER TABLE "user_refresh_tokens" DROP CONSTRAINT IF EXISTS "FK_user_refresh_tokens_access_token"`)
    await queryRunner.query(`ALTER TABLE "user_access_tokens" DROP CONSTRAINT IF EXISTS "FK_user_access_tokens_user"`)
    await queryRunner.query(`ALTER TABLE "todo" DROP CONSTRAINT IF EXISTS "FK_todo_user"`)
    await queryRunner.query(`ALTER TABLE "sys_task_log" DROP CONSTRAINT IF EXISTS "FK_sys_task_log_task"`)
    await queryRunner.query(`ALTER TABLE "sys_login_log" DROP CONSTRAINT IF EXISTS "FK_sys_login_log_user"`)
    await queryRunner.query(`ALTER TABLE "sys_role_menus" DROP CONSTRAINT IF EXISTS "FK_sys_role_menus_menu"`)
    await queryRunner.query(`ALTER TABLE "sys_role_menus" DROP CONSTRAINT IF EXISTS "FK_sys_role_menus_role"`)
    await queryRunner.query(`ALTER TABLE "sys_user_roles" DROP CONSTRAINT IF EXISTS "FK_sys_user_roles_role"`)
    await queryRunner.query(`ALTER TABLE "sys_user_roles" DROP CONSTRAINT IF EXISTS "FK_sys_user_roles_user"`)
    await queryRunner.query(`ALTER TABLE "sys_dict_item" DROP CONSTRAINT IF EXISTS "FK_sys_dict_item_type"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP CONSTRAINT IF EXISTS "FK_sys_user_dept"`)
    await queryRunner.query(`ALTER TABLE "sys_user" DROP CONSTRAINT IF EXISTS "FK_sys_user_organization"`)

    const tables = [
      'tenant_users', 'tenants', 'sys_agent', 'sys_credit_wallet', 'sys_subscription',
      'user_refresh_tokens', 'user_access_tokens', 'tool_storage', 'todo',
      'sys_task_log', 'sys_captcha_log', 'sys_login_log', 'sys_role_menus', 'sys_user_roles',
      'sys_dict_item', 'sys_user', 'sys_task', 'sys_config', 'sys_dict_type', 'sys_menu',
      'sys_role', 'sys_dept', 'sys_organizations',
    ]
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
    }

    const enums = [
      'agent_category_enum', 'short_link_preference_enum', 'period_enum', 'subscription_tier_enum',
    ]
    for (const enumName of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${enumName}"`)
    }
  }
}