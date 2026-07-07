import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * App-scoped user workspace: sys_app registry + per-app membership.
 * Additive only — backfills ladipage + nest-admin memberships from existing sys_user/tenants.
 */
export class AppScopedMembership1755000000000 implements MigrationInterface {
  name = 'AppScopedMembership1755000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_app" (
        "code" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sys_app" PRIMARY KEY ("code")
      )
    `)

    await queryRunner.query(`
      INSERT INTO "sys_app" ("code", "name", "status")
      VALUES
        ('ladipage', 'LadiPage Builder', 'active'),
        ('nest-admin', 'Nest Admin Control Plane', 'active')
      ON CONFLICT ("code") DO NOTHING
    `)

    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "appCode" varchar(50) NOT NULL DEFAULT 'ladipage'
    `)

    await queryRunner.query(`
      UPDATE "tenants"
      SET "appCode" = 'ladipage'
      WHERE "appCode" IS NULL OR TRIM("appCode") = ''
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sys_user_app_membership" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" integer NOT NULL,
        "appCode" varchar(50) NOT NULL,
        "organizationId" uuid NOT NULL,
        "tenantId" integer NOT NULL,
        "role" varchar(50) NOT NULL DEFAULT 'owner',
        "status" smallint NOT NULL DEFAULT 1,
        CONSTRAINT "PK_sys_user_app_membership" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sys_user_app_membership_user_app" UNIQUE ("userId", "appCode")
      )
    `)

    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership"
      ADD CONSTRAINT "FK_sys_user_app_membership_user"
      FOREIGN KEY ("userId") REFERENCES "sys_user"("id") ON DELETE CASCADE
    `).catch(() => undefined)

    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership"
      ADD CONSTRAINT "FK_sys_user_app_membership_app"
      FOREIGN KEY ("appCode") REFERENCES "sys_app"("code")
    `).catch(() => undefined)

    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership"
      ADD CONSTRAINT "FK_sys_user_app_membership_org"
      FOREIGN KEY ("organizationId") REFERENCES "sys_organizations"("id") ON DELETE CASCADE
    `).catch(() => undefined)

    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership"
      ADD CONSTRAINT "FK_sys_user_app_membership_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    `).catch(() => undefined)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_app_membership_app"
      ON "sys_user_app_membership" ("appCode")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sys_user_app_membership_org"
      ON "sys_user_app_membership" ("organizationId")
    `)

    await queryRunner.query(`
      INSERT INTO "sys_user_app_membership" ("userId", "appCode", "organizationId", "tenantId", "role", "status")
      SELECT u.id, 'ladipage', u."organizationId", t.id, 'owner', 1
      FROM "sys_user" u
      INNER JOIN "tenants" t ON t."organizationId" = u."organizationId"
      WHERE u."organizationId" IS NOT NULL
      ON CONFLICT ("userId", "appCode") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "sys_user_app_membership" ("userId", "appCode", "organizationId", "tenantId", "role", "status")
      SELECT u.id, 'nest-admin', u."organizationId", t.id, 'owner', 1
      FROM "sys_user" u
      INNER JOIN "tenants" t ON t."organizationId" = u."organizationId"
      WHERE u."organizationId" IS NOT NULL
      ON CONFLICT ("userId", "appCode") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_user_app_membership_org"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sys_user_app_membership_app"`)
    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership" DROP CONSTRAINT IF EXISTS "FK_sys_user_app_membership_tenant"
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership" DROP CONSTRAINT IF EXISTS "FK_sys_user_app_membership_org"
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership" DROP CONSTRAINT IF EXISTS "FK_sys_user_app_membership_app"
    `)
    await queryRunner.query(`
      ALTER TABLE "sys_user_app_membership" DROP CONSTRAINT IF EXISTS "FK_sys_user_app_membership_user"
    `)
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_user_app_membership"`)
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "appCode"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "sys_app"`)
  }
}