import fs from 'node:fs'
import path from 'node:path'

import { MigrationInterface, QueryRunner } from 'typeorm'

const SEED_SQL = path.join(__dirname, '../../../../docker/deploy/sql/nest_admin.pg.sql')

export class SeedInitialData1741000001000 implements MigrationInterface {
  name = 'SeedInitialData1741000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "sys_user"`,
    )
    if (count > 0) {
      return
    }

    const sql = fs.readFileSync(SEED_SQL, 'utf8')
    const statements = sql
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('INSERT INTO') || line.startsWith('SELECT setval'))

    for (const statement of statements) {
      await queryRunner.query(statement)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "sys_user_roles"`)
    await queryRunner.query(`DELETE FROM "sys_role_menus"`)
    await queryRunner.query(`DELETE FROM "sys_user"`)
    await queryRunner.query(`DELETE FROM "sys_role"`)
    await queryRunner.query(`DELETE FROM "sys_menu"`)
    await queryRunner.query(`DELETE FROM "sys_dict_item"`)
    await queryRunner.query(`DELETE FROM "sys_dict_type"`)
    await queryRunner.query(`DELETE FROM "sys_dept"`)
    await queryRunner.query(`DELETE FROM "sys_config"`)
  }
}