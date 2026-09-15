import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Low-risk Phase 6 indexes for the hottest tenant-scoped list queries.
 *
 * Services filter by tenantId and order by created_at/id. PostgreSQL can scan
 * these indexes backwards for DESC queries, so a single composite btree index
 * serves both recent-first and stable keyset-style access patterns.
 *
 * CONCURRENTLY avoids blocking writes on production tables. This migration is
 * explicitly non-transactional because PostgreSQL does not allow concurrent
 * index creation inside a transaction.
 */
export class TenantListQueryIndexes1765000000000 implements MigrationInterface {
  name = 'TenantListQueryIndexes1765000000000'
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_lp_customer_tenant_created_id"
      ON "lp_customer" ("tenantId", "created_at", "id")
    `)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_lp_order_tenant_created_id"
      ON "lp_order" ("tenantId", "created_at", "id")
    `)
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_lp_product_tenant_created_id"
      ON "lp_product" ("tenantId", "created_at", "id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_lp_product_tenant_created_id"`,
    )
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_lp_order_tenant_created_id"`,
    )
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_lp_customer_tenant_created_id"`,
    )
  }
}
