import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 2: CRM core tables (crm_person, crm_company, crm_person_company).
 * Twenty-inspired hybrid schema — runs parallel to lp_* until cutover.
 */
export class CrmV2Core1753000002000 implements MigrationInterface {
  name = 'CrmV2Core1753000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crm_person" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" text NOT NULL,
        "first_name" varchar(255),
        "last_name" varchar(255),
        "emails" jsonb NOT NULL DEFAULT '[]',
        "phones" jsonb NOT NULL DEFAULT '[]',
        "primary_email" varchar(255),
        "primary_phone" varchar(30),
        "job_title" varchar(255),
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "search_vector" tsvector,
        CONSTRAINT "PK_crm_person" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_person_tenantId" ON "crm_person" ("tenantId")`)
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_person_tenant_phone" ON "crm_person" ("tenantId", "primary_phone") WHERE "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_person_tenant_email" ON "crm_person" ("tenantId", "primary_email") WHERE "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_person_search_vector" ON "crm_person" USING GIN ("search_vector")`,
    )

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION crm_person_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.first_name, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.last_name, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.primary_email, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(NEW.primary_phone, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(NEW.job_title, '')), 'D');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `)
    await queryRunner.query(`
      CREATE TRIGGER crm_person_search_vector_update
      BEFORE INSERT OR UPDATE ON "crm_person"
      FOR EACH ROW EXECUTE PROCEDURE crm_person_search_vector_trigger()
    `)

    await queryRunner.query(`
      CREATE TABLE "crm_company" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "domain" varchar(255),
        "links" jsonb NOT NULL DEFAULT '{}',
        "search_vector" tsvector,
        CONSTRAINT "PK_crm_company" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_crm_company_tenantId" ON "crm_company" ("tenantId")`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_company_tenant_domain" ON "crm_company" ("tenantId", "domain") WHERE "domain" IS NOT NULL AND "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_crm_company_search_vector" ON "crm_company" USING GIN ("search_vector")`,
    )

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION crm_company_search_vector_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.domain, '')), 'B');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `)
    await queryRunner.query(`
      CREATE TRIGGER crm_company_search_vector_update
      BEFORE INSERT OR UPDATE ON "crm_company"
      FOR EACH ROW EXECUTE PROCEDURE crm_company_search_vector_trigger()
    `)

    await queryRunner.query(`
      CREATE TABLE "crm_person_company" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "person_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        CONSTRAINT "PK_crm_person_company" PRIMARY KEY ("id"),
        CONSTRAINT "FK_crm_person_company_person" FOREIGN KEY ("person_id") REFERENCES "crm_person"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_crm_person_company_company" FOREIGN KEY ("company_id") REFERENCES "crm_company"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_crm_person_company_unique" ON "crm_person_company" ("person_id", "company_id")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_person_company"`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_company_search_vector_update ON "crm_company"`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS crm_company_search_vector_trigger()`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_company"`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_person_search_vector_update ON "crm_person"`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS crm_person_search_vector_trigger()`)
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_person"`)
  }
}