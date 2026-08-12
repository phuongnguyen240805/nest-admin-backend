import { MigrationInterface, QueryRunner } from 'typeorm'

export class CustomerCareOrderIdempotency1763700000000 implements MigrationInterface {
  name = 'CustomerCareOrderIdempotency1763700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cc_conversation_order_link"
      ADD COLUMN IF NOT EXISTS "creation_key" varchar(120)
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cc_conversation_order_creation_key"
      ON "cc_conversation_order_link" ("tenant_id", "conversation_link_id", "creation_key")
      WHERE "creation_key" IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cc_conversation_order_creation_key"`)
    await queryRunner.query(`ALTER TABLE "cc_conversation_order_link" DROP COLUMN IF EXISTS "creation_key"`)
  }
}
