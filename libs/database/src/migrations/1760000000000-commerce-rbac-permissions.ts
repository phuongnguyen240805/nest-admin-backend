import { MigrationInterface, QueryRunner } from 'typeorm'

const COMMERCE_PERMISSIONS = [
  ['View Commerce products', 'commerce:product:read'],
  ['Manage Commerce products', 'commerce:product:write'],
  ['View Commerce orders', 'commerce:order:read'],
  ['Refund Commerce orders', 'commerce:order:refund'],
  ['Bind Commerce products to pages', 'commerce:page:bind'],
  ['Manage Commerce store', 'commerce:store:manage'],
] as const

/**
 * Registers Commerce capabilities in the existing sys_menu-backed RBAC.
 * TenantGuard and resource ownership remain the data-isolation boundary.
 */
export class CommerceRbacPermissions1760000000000 implements MigrationInterface {
  name = 'CommerceRbacPermissions1760000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, permission] of COMMERCE_PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "sys_menu"
            ("name", "permission", "type", "show", "status", "order_no")
          SELECT $1::varchar, $2::varchar, 2, 0, 1, 900
          WHERE NOT EXISTS (
            SELECT 1 FROM "sys_menu" WHERE "permission" = $2::varchar
          )
        `,
        [name, permission],
      )
    }

    await queryRunner.query(`
      INSERT INTO "sys_role_menus" ("role_id", "menu_id")
      SELECT role.id, menu.id
      FROM "sys_role" role
      CROSS JOIN "sys_menu" menu
      WHERE role.value = 'user'
        AND menu.permission IN (
          'commerce:product:read',
          'commerce:product:write',
          'commerce:order:read',
          'commerce:order:refund',
          'commerce:page:bind',
          'commerce:store:manage'
        )
      ON CONFLICT ("role_id", "menu_id") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "sys_menu"
      WHERE "permission" IN (
        'commerce:product:read',
        'commerce:product:write',
        'commerce:order:read',
        'commerce:order:refund',
        'commerce:page:bind',
        'commerce:store:manage'
      )
    `)
  }
}
