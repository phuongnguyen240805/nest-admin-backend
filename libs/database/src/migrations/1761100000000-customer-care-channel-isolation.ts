import { MigrationInterface, QueryRunner } from 'typeorm'

export class CustomerCareChannelIsolation1761100000000 implements MigrationInterface {
  name = 'CustomerCareChannelIsolation1761100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cc_channel_account ADD COLUMN IF NOT EXISTS connection_key uuid DEFAULT gen_random_uuid();
      UPDATE cc_channel_account SET connection_key = gen_random_uuid() WHERE connection_key IS NULL;
      ALTER TABLE cc_channel_account ALTER COLUMN connection_key SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_channel_connection_key ON cc_channel_account(connection_key);

      ALTER TABLE cc_contact_identity ADD COLUMN IF NOT EXISTS channel_account_id integer;
      ALTER TABLE cc_message_link ADD COLUMN IF NOT EXISTS channel_account_id integer;
      ALTER TABLE cc_inbound_event ADD COLUMN IF NOT EXISTS channel_account_id integer;

      UPDATE cc_contact_identity contact SET channel_account_id = source.channel_account_id
      FROM (
        SELECT contact_identity_id, min(channel_account_id) AS channel_account_id
        FROM cc_conversation_link WHERE contact_identity_id IS NOT NULL GROUP BY contact_identity_id
      ) source WHERE source.contact_identity_id = contact.id AND contact.channel_account_id IS NULL;
      UPDATE cc_message_link message SET channel_account_id = conversation.channel_account_id
      FROM cc_conversation_link conversation
      WHERE conversation.id = message.conversation_link_id AND message.channel_account_id IS NULL;
      UPDATE cc_inbound_event event SET channel_account_id = channel.id
      FROM cc_channel_account channel
      WHERE event.channel_account_id IS NULL
        AND channel.tenant_id = event.tenant_id
        AND channel.provider = event.provider
        AND channel.external_account_id = event.payload->>'account_id';

      ALTER TABLE cc_contact_identity DROP CONSTRAINT IF EXISTS uq_cc_contact_identity;
      DROP INDEX IF EXISTS uq_cc_contact_identity;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_contact_channel_external
        ON cc_contact_identity(tenant_id, channel_account_id, provider, external_id);

      ALTER TABLE cc_conversation_link DROP CONSTRAINT IF EXISTS uq_cc_conversation_external;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_conversation_channel_external
        ON cc_conversation_link(tenant_id, channel_account_id, provider, external_thread_id);

      DROP INDEX IF EXISTS uq_cc_message_external;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_message_channel_external
        ON cc_message_link(tenant_id, channel_account_id, provider, external_message_id)
        WHERE external_message_id IS NOT NULL;

      ALTER TABLE cc_inbound_event DROP CONSTRAINT IF EXISTS uq_cc_inbound_event;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_inbound_channel_event
        ON cc_inbound_event(tenant_id, channel_account_id, provider, event_id);

      ALTER TABLE cc_contact_identity ADD CONSTRAINT fk_cc_contact_channel
        FOREIGN KEY (channel_account_id) REFERENCES cc_channel_account(id) ON DELETE CASCADE;
      ALTER TABLE cc_message_link ADD CONSTRAINT fk_cc_message_channel
        FOREIGN KEY (channel_account_id) REFERENCES cc_channel_account(id) ON DELETE CASCADE;
      ALTER TABLE cc_inbound_event ADD CONSTRAINT fk_cc_inbound_channel
        FOREIGN KEY (channel_account_id) REFERENCES cc_channel_account(id) ON DELETE CASCADE;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cc_inbound_event DROP CONSTRAINT IF EXISTS fk_cc_inbound_channel;
      ALTER TABLE cc_message_link DROP CONSTRAINT IF EXISTS fk_cc_message_channel;
      ALTER TABLE cc_contact_identity DROP CONSTRAINT IF EXISTS fk_cc_contact_channel;
      DROP INDEX IF EXISTS uq_cc_inbound_channel_event;
      DROP INDEX IF EXISTS uq_cc_message_channel_external;
      DROP INDEX IF EXISTS uq_cc_conversation_channel_external;
      DROP INDEX IF EXISTS uq_cc_contact_channel_external;
      DROP INDEX IF EXISTS uq_cc_channel_connection_key;
      ALTER TABLE cc_inbound_event DROP COLUMN IF EXISTS channel_account_id;
      ALTER TABLE cc_message_link DROP COLUMN IF EXISTS channel_account_id;
      ALTER TABLE cc_contact_identity DROP COLUMN IF EXISTS channel_account_id;
      ALTER TABLE cc_channel_account DROP COLUMN IF EXISTS connection_key;
    `)
  }
}
