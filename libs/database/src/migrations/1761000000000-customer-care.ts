import { MigrationInterface, QueryRunner } from 'typeorm'

const CUSTOMER_CARE_PERMISSIONS = [
  ['View Customer Care conversations', 'customer-care:conversation:read'],
  ['Manage Customer Care conversations', 'customer-care:conversation:write'],
  ['Send Customer Care messages', 'customer-care:message:send'],
  ['Assign Customer Care conversations', 'customer-care:assign'],
  ['Update Customer Care contacts', 'customer-care:contact:update'],
  ['View Customer Care channels', 'customer-care:channel:read'],
  ['Manage Customer Care channels', 'customer-care:channel:manage'],
] as const

export class CustomerCare1761000000000 implements MigrationInterface {
  name = 'CustomerCare1761000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cc_channel_account (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, provider varchar(40) NOT NULL DEFAULT 'zalo_personal',
        external_account_id varchar(160) NOT NULL, name varchar(255) NOT NULL DEFAULT 'Zalo cá nhân', enabled boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_channel_account UNIQUE (tenant_id, provider, external_account_id)
      );
      CREATE INDEX IF NOT EXISTS ix_cc_channel_account_tenant ON cc_channel_account(tenant_id);

      CREATE TABLE IF NOT EXISTS cc_contact_identity (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, provider varchar(40) NOT NULL, external_id varchar(200) NOT NULL,
        display_name varchar(255) NOT NULL DEFAULT '', avatar_url text, phone varchar(50), email varchar(255), note text, crm_customer_id integer,
        tags jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_contact_identity UNIQUE (tenant_id, provider, external_id)
      );
      CREATE INDEX IF NOT EXISTS ix_cc_contact_identity_tenant ON cc_contact_identity(tenant_id);

      CREATE TABLE IF NOT EXISTS cc_conversation_link (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, channel_account_id integer NOT NULL, contact_identity_id integer,
        provider varchar(40) NOT NULL, external_thread_id varchar(220) NOT NULL, thread_type varchar(20) NOT NULL DEFAULT 'user',
        libredesk_conversation_uuid uuid NOT NULL, last_external_message_id varchar(220), last_message_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_conversation_external UNIQUE (tenant_id, provider, external_thread_id),
        CONSTRAINT uq_cc_conversation_libredesk UNIQUE (tenant_id, libredesk_conversation_uuid),
        CONSTRAINT fk_cc_conversation_channel FOREIGN KEY (channel_account_id) REFERENCES cc_channel_account(id) ON DELETE CASCADE,
        CONSTRAINT fk_cc_conversation_contact FOREIGN KEY (contact_identity_id) REFERENCES cc_contact_identity(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS cc_message_link (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, conversation_link_id integer, provider varchar(40) NOT NULL DEFAULT 'zalo_personal',
        external_message_id varchar(220), client_message_id uuid, libredesk_message_uuid uuid, status varchar(30) NOT NULL DEFAULT 'sent',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_cc_message_conversation FOREIGN KEY (conversation_link_id) REFERENCES cc_conversation_link(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_message_external ON cc_message_link(tenant_id, provider, external_message_id) WHERE external_message_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_message_client ON cc_message_link(tenant_id, client_message_id) WHERE client_message_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_message_libredesk ON cc_message_link(tenant_id, libredesk_message_uuid) WHERE libredesk_message_uuid IS NOT NULL;

      CREATE TABLE IF NOT EXISTS cc_conversation_preference (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, user_id integer NOT NULL, conversation_uuid uuid NOT NULL,
        pinned boolean NOT NULL DEFAULT false, muted boolean NOT NULL DEFAULT false, archived boolean NOT NULL DEFAULT false,
        draft_content text, draft_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_conversation_preference UNIQUE (tenant_id, user_id, conversation_uuid)
      );

      CREATE TABLE IF NOT EXISTS cc_inbound_event (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, event_id varchar(260) NOT NULL, provider varchar(40) NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'received', payload jsonb NOT NULL, last_error text, processed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_inbound_event UNIQUE (tenant_id, provider, event_id)
      );

      CREATE TABLE IF NOT EXISTS cc_outbox_event (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, type varchar(80) NOT NULL, aggregate_id varchar(220) NOT NULL,
        payload jsonb NOT NULL, status varchar(30) NOT NULL DEFAULT 'pending', attempt_count integer NOT NULL DEFAULT 0,
        next_retry_at timestamptz NOT NULL DEFAULT now(), last_error text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_cc_outbox_due ON cc_outbox_event(tenant_id, status, next_retry_at);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_outbox_aggregate ON cc_outbox_event(tenant_id, type, aggregate_id);

      CREATE TABLE IF NOT EXISTS cc_sync_event (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, sequence integer NOT NULL, event_id uuid NOT NULL UNIQUE, type varchar(80) NOT NULL,
        aggregate_id varchar(220), payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_sync_tenant_sequence UNIQUE (tenant_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS ix_cc_sync_sequence ON cc_sync_event(tenant_id, sequence);

      CREATE TABLE IF NOT EXISTS cc_message_reaction (
        id SERIAL PRIMARY KEY, tenant_id integer NOT NULL, message_uuid uuid NOT NULL, user_id integer NOT NULL, emoji varchar(32) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_cc_message_reaction UNIQUE (tenant_id, message_uuid, user_id, emoji)
      );
    `)

    for (const [name, permission] of CUSTOMER_CARE_PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "sys_menu"
            ("name", "permission", "type", "show", "status", "order_no")
          SELECT $1::varchar, $2::varchar, 2, 0, 1, 910
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
          'customer-care:conversation:read',
          'customer-care:conversation:write',
          'customer-care:message:send',
          'customer-care:assign',
          'customer-care:contact:update',
          'customer-care:channel:read',
          'customer-care:channel:manage'
        )
      ON CONFLICT ("role_id", "menu_id") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "sys_menu"
      WHERE "permission" IN (
        'customer-care:conversation:read',
        'customer-care:conversation:write',
        'customer-care:message:send',
        'customer-care:assign',
        'customer-care:contact:update',
        'customer-care:channel:read',
        'customer-care:channel:manage'
      )
    `)
    await queryRunner.query(`
      DROP TABLE IF EXISTS cc_message_reaction;
      DROP TABLE IF EXISTS cc_sync_event;
      DROP TABLE IF EXISTS cc_outbox_event;
      DROP TABLE IF EXISTS cc_inbound_event;
      DROP TABLE IF EXISTS cc_conversation_preference;
      DROP TABLE IF EXISTS cc_message_link;
      DROP TABLE IF EXISTS cc_conversation_link;
      DROP TABLE IF EXISTS cc_contact_identity;
      DROP TABLE IF EXISTS cc_channel_account;
    `)
  }
}
