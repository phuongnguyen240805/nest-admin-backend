import { MigrationInterface, QueryRunner } from 'typeorm'

export class CustomerCareOrderLinks1763400000000 implements MigrationInterface {
  name = 'CustomerCareOrderLinks1763400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cc_conversation_order_link" (
        "id" SERIAL NOT NULL,
        "tenant_id" integer NOT NULL,
        "conversation_link_id" integer NOT NULL,
        "contact_identity_id" integer,
        "order_id" integer NOT NULL,
        "relation_type" varchar(30) NOT NULL DEFAULT 'CREATED_FROM_CHAT',
        "source_message_id" varchar(220),
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_by_user_id" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cc_conversation_order_link" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cc_conversation_order_conversation" FOREIGN KEY ("conversation_link_id") REFERENCES "cc_conversation_link"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cc_conversation_order_contact" FOREIGN KEY ("contact_identity_id") REFERENCES "cc_contact_identity"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_cc_conversation_order_order" FOREIGN KEY ("order_id") REFERENCES "lp_order"("id") ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cc_conversation_order_unique" ON "cc_conversation_order_link" ("tenant_id", "conversation_link_id", "order_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_cc_conversation_order_order" ON "cc_conversation_order_link" ("tenant_id", "order_id")`)
    await queryRunner.query(`CREATE INDEX "IDX_cc_conversation_order_primary" ON "cc_conversation_order_link" ("tenant_id", "conversation_link_id", "is_primary")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cc_conversation_order_one_primary" ON "cc_conversation_order_link" ("tenant_id", "conversation_link_id") WHERE "is_primary" = true`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cc_conversation_order_link"`)
  }
}
