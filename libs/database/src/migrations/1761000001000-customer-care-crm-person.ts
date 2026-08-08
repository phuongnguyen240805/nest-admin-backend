import { MigrationInterface, QueryRunner } from 'typeorm'

export class CustomerCareCrmPerson1761000001000 implements MigrationInterface {
  name = 'CustomerCareCrmPerson1761000001000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cc_contact_identity
      ADD COLUMN IF NOT EXISTS crm_person_id uuid NULL
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_cc_contact_identity_crm_person
      ON cc_contact_identity(tenant_id, crm_person_id)
      WHERE crm_person_id IS NOT NULL
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ix_cc_contact_identity_crm_person')
    await queryRunner.query(
      'ALTER TABLE cc_contact_identity DROP COLUMN IF EXISTS crm_person_id',
    )
  }
}
