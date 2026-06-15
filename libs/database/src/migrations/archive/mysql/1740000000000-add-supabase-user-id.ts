import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddSupabaseUserId1740000000000 implements MigrationInterface {
  name = 'AddSupabaseUserId1740000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('sys_user', 'supabase_user_id')
    if (hasColumn)
      return

    await queryRunner.addColumn(
      'sys_user',
      new TableColumn({
        name: 'supabase_user_id',
        type: 'uuid',
        isNullable: true,
        isUnique: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('sys_user', 'supabase_user_id')
    if (!hasColumn)
      return

    await queryRunner.dropColumn('sys_user', 'supabase_user_id')
  }
}