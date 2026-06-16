import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 3: Ecom Store tables (products, orders, tags, reviews, custom fields...).
 */
export class EcomStore1752000001000 implements MigrationInterface {
  name = 'EcomStore1752000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lp_product" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "sku" varchar(100) NOT NULL,
        "price" decimal(14,2) NOT NULL DEFAULT 0,
        "stock" integer NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "description" text,
        "categoryId" integer,
        "imageUrl" varchar(500),
        CONSTRAINT "PK_lp_product" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_product_tenantId" ON "lp_product" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_product_tenant_sku" ON "lp_product" ("tenantId", "sku")`)

    await queryRunner.query(`
      CREATE TABLE "lp_product_category" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "parentId" integer,
        CONSTRAINT "PK_lp_product_category" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_product_category_tenantId" ON "lp_product_category" ("tenantId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_product_tag" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        CONSTRAINT "PK_lp_product_tag" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_product_tag_tenantId" ON "lp_product_tag" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_product_tag_tenant_name" ON "lp_product_tag" ("tenantId", "name")`)

    await queryRunner.query(`
      CREATE TABLE "lp_product_tag_map" (
        "id" SERIAL NOT NULL,
        "productId" integer NOT NULL,
        "tagId" integer NOT NULL,
        CONSTRAINT "PK_lp_product_tag_map" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_product_tag_map_unique" ON "lp_product_tag_map" ("productId", "tagId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_order" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "code" varchar(50) NOT NULL,
        "customerId" integer,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "total" decimal(14,2) NOT NULL DEFAULT 0,
        "paymentMethod" varchar(50),
        "customerName" varchar(255) NOT NULL,
        "customerPhone" varchar(30) NOT NULL,
        "customerEmail" varchar(255),
        "notes" text,
        "isIncomplete" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_lp_order" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_order_tenantId" ON "lp_order" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_tenant_code" ON "lp_order" ("tenantId", "code")`)

    await queryRunner.query(`
      CREATE TABLE "lp_order_item" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "orderId" integer NOT NULL,
        "productId" integer,
        "productName" varchar(255) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "unitPrice" decimal(14,2) NOT NULL DEFAULT 0,
        "totalPrice" decimal(14,2) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_lp_order_item" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_order_item_orderId" ON "lp_order_item" ("orderId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_order_tag" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        CONSTRAINT "PK_lp_order_tag" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_order_tag_tenantId" ON "lp_order_tag" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_tag_tenant_name" ON "lp_order_tag" ("tenantId", "name")`)

    await queryRunner.query(`
      CREATE TABLE "lp_order_tag_map" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "tagId" integer NOT NULL,
        CONSTRAINT "PK_lp_order_tag_map" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_order_tag_map_unique" ON "lp_order_tag_map" ("orderId", "tagId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_delivery_note" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "orderId" integer NOT NULL,
        "content" text,
        "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "shippedAt" TIMESTAMP,
        CONSTRAINT "PK_lp_delivery_note" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_delivery_note_tenantId" ON "lp_delivery_note" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_delivery_note_orderId" ON "lp_delivery_note" ("orderId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_product_review" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "productId" integer NOT NULL,
        "rating" integer NOT NULL,
        "content" text,
        "reviewerName" varchar(255),
        CONSTRAINT "PK_lp_product_review" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_product_review_tenantId" ON "lp_product_review" ("tenantId")`)
    await queryRunner.query(`CREATE INDEX "IDX_lp_product_review_productId" ON "lp_product_review" ("productId")`)

    await queryRunner.query(`
      CREATE TABLE "lp_custom_field" (
        "id" SERIAL NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "create_by" integer,
        "update_by" integer,
        "tenantId" integer NOT NULL,
        "entityType" varchar(20) NOT NULL,
        "fieldName" varchar(100) NOT NULL,
        "displayName" varchar(255) NOT NULL,
        "dataType" varchar(30) NOT NULL DEFAULT 'TEXT',
        "description" text,
        "options" jsonb,
        CONSTRAINT "PK_lp_custom_field" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`CREATE INDEX "IDX_lp_custom_field_tenantId" ON "lp_custom_field" ("tenantId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_lp_custom_field_unique" ON "lp_custom_field" ("tenantId", "entityType", "fieldName")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_custom_field"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_product_review"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_delivery_note"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_order_tag_map"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_order_tag"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_order_item"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_order"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_product_tag_map"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_product_tag"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_product_category"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_product"`)
  }
}