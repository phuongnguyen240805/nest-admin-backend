import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 0: Bridge sys_organizations ↔ tenants via organizationId.
 */
export class Phase0TenantOrgBridge1752000000000 implements MigrationInterface {
  name = 'Phase0TenantOrgBridge1752000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "organizationId" uuid
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenants_organizationId"
      ON "tenants" ("organizationId")
      WHERE "organizationId" IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tenants_organizationId"`)
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "organizationId"
    `)
  }
}