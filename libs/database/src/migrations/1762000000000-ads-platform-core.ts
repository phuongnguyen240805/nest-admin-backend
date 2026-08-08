import { MigrationInterface, QueryRunner } from 'typeorm'

const ADS_PERMISSIONS = [
  ['View ads data', 'ads:read'],
  ['Manage ads connections', 'ads:connection:manage'],
  ['Synchronize ads data', 'ads:sync'],
  ['Publish ads campaigns', 'ads:publish'],
  ['Manage ads status and budget', 'ads:action'],
] as const

export class AdsPlatformCore1762000000000 implements MigrationInterface {
  name = 'AdsPlatformCore1762000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lp_ads_connection (
        id uuid PRIMARY KEY,
        tenant_id integer NOT NULL,
        provider varchar(16) NOT NULL,
        external_user_id varchar(128) NOT NULL,
        display_name varchar(255),
        status varchar(32) NOT NULL DEFAULT 'CONNECTED',
        scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
        token_expires_at timestamptz,
        last_synced_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_lp_ads_connection_provider CHECK (provider IN ('META', 'TIKTOK', 'SHOPEE')),
        CONSTRAINT uq_lp_ads_connection_tenant_provider_user UNIQUE (tenant_id, provider, external_user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_connection_tenant_status
        ON lp_ads_connection(tenant_id, status);

      CREATE TABLE IF NOT EXISTS lp_ads_secret (
        id uuid PRIMARY KEY,
        connection_id uuid NOT NULL UNIQUE,
        ciphertext text NOT NULL,
        iv varchar(64) NOT NULL,
        auth_tag varchar(64) NOT NULL,
        key_version varchar(32) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_lp_ads_secret_connection FOREIGN KEY (connection_id)
          REFERENCES lp_ads_connection(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lp_ads_account (
        id uuid PRIMARY KEY,
        tenant_id integer NOT NULL,
        connection_id uuid NOT NULL,
        provider varchar(16) NOT NULL,
        external_id varchar(128) NOT NULL,
        name varchar(255) NOT NULL,
        currency varchar(16),
        timezone varchar(128),
        status varchar(64),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_lp_ads_account_connection FOREIGN KEY (connection_id)
          REFERENCES lp_ads_connection(id) ON DELETE CASCADE,
        CONSTRAINT chk_lp_ads_account_provider CHECK (provider IN ('META', 'TIKTOK', 'SHOPEE')),
        CONSTRAINT uq_lp_ads_account_tenant_provider_external UNIQUE (tenant_id, provider, external_id)
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_account_connection
        ON lp_ads_account(tenant_id, connection_id);

      CREATE TABLE IF NOT EXISTS lp_ads_oauth_state (
        id uuid PRIMARY KEY,
        state_hash varchar(64) NOT NULL UNIQUE,
        tenant_id integer NOT NULL,
        actor_id varchar(128) NOT NULL,
        provider varchar(16) NOT NULL,
        return_to text,
        code_verifier_ciphertext text,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_lp_ads_oauth_state_provider CHECK (provider IN ('META', 'TIKTOK', 'SHOPEE'))
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_oauth_state_expiry ON lp_ads_oauth_state(expires_at);

      CREATE TABLE IF NOT EXISTS lp_ads_extension_session (
        id uuid PRIMARY KEY,
        tenant_id integer NOT NULL,
        actor_id varchar(128) NOT NULL,
        device_id varchar(160) NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        last_seen_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_lp_ads_extension_session_token_hash UNIQUE (token_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_extension_session_expiry
        ON lp_ads_extension_session(expires_at);

      CREATE TABLE IF NOT EXISTS lp_ads_snapshot (
        id uuid PRIMARY KEY,
        tenant_id integer NOT NULL,
        connection_id uuid,
        provider varchar(16) NOT NULL,
        source varchar(32) NOT NULL,
        confidence varchar(24) NOT NULL,
        external_account_id varchar(128) NOT NULL,
        schema_version integer NOT NULL,
        fingerprint varchar(64) NOT NULL,
        observed_at timestamptz NOT NULL,
        stale_at timestamptz,
        completeness jsonb NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_lp_ads_snapshot_connection FOREIGN KEY (connection_id)
          REFERENCES lp_ads_connection(id) ON DELETE SET NULL,
        CONSTRAINT chk_lp_ads_snapshot_provider CHECK (provider IN ('META', 'TIKTOK', 'SHOPEE')),
        CONSTRAINT uq_lp_ads_snapshot_fingerprint UNIQUE (
          tenant_id, provider, external_account_id, source, fingerprint
        )
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_snapshot_account_time
        ON lp_ads_snapshot(tenant_id, provider, external_account_id, observed_at DESC);

      CREATE TABLE IF NOT EXISTS lp_ads_job (
        id uuid PRIMARY KEY,
        tenant_id integer NOT NULL,
        actor_id varchar(128) NOT NULL,
        provider varchar(16) NOT NULL,
        type varchar(16) NOT NULL,
        state varchar(24) NOT NULL DEFAULT 'CREATED',
        idempotency_key varchar(160) NOT NULL,
        connection_id uuid,
        external_account_id varchar(128),
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
        result jsonb,
        error jsonb,
        bull_job_id varchar(128),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        CONSTRAINT fk_lp_ads_job_connection FOREIGN KEY (connection_id)
          REFERENCES lp_ads_connection(id) ON DELETE SET NULL,
        CONSTRAINT chk_lp_ads_job_provider CHECK (provider IN ('META', 'TIKTOK', 'SHOPEE')),
        CONSTRAINT chk_lp_ads_job_type CHECK (type IN ('SYNC', 'PUBLISH', 'ACTION', 'RECONCILE')),
        CONSTRAINT uq_lp_ads_job_idempotency UNIQUE (tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_job_tenant_state
        ON lp_ads_job(tenant_id, state, created_at DESC);

      CREATE TABLE IF NOT EXISTS lp_ads_audit_event (
        id uuid PRIMARY KEY,
        tenant_id integer NOT NULL,
        operation_id uuid NOT NULL,
        trace_id varchar(128) NOT NULL,
        actor_id varchar(128) NOT NULL,
        provider varchar(16) NOT NULL,
        event_code varchar(96) NOT NULL,
        outcome varchar(24) NOT NULL,
        target_type varchar(64),
        target_id varchar(160),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_lp_ads_audit_provider CHECK (provider IN ('META', 'TIKTOK', 'SHOPEE'))
      );
      CREATE INDEX IF NOT EXISTS idx_lp_ads_audit_tenant_time
        ON lp_ads_audit_event(tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_lp_ads_audit_operation
        ON lp_ads_audit_event(tenant_id, operation_id);
    `)

    for (const [name, permission] of ADS_PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "sys_menu" ("name", "permission", "type", "show", "status", "order_no")
          SELECT $1::varchar, $2::varchar, 2, 0, 1, 920
          WHERE NOT EXISTS (SELECT 1 FROM "sys_menu" WHERE "permission" = $2::varchar)
        `,
        [name, permission],
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "sys_menu"
      WHERE "permission" IN (
        'ads:read',
        'ads:connection:manage',
        'ads:sync',
        'ads:publish',
        'ads:action'
      );
      DROP TABLE IF EXISTS lp_ads_audit_event;
      DROP TABLE IF EXISTS lp_ads_job;
      DROP TABLE IF EXISTS lp_ads_snapshot;
      DROP TABLE IF EXISTS lp_ads_extension_session;
      DROP TABLE IF EXISTS lp_ads_oauth_state;
      DROP TABLE IF EXISTS lp_ads_account;
      DROP TABLE IF EXISTS lp_ads_secret;
      DROP TABLE IF EXISTS lp_ads_connection;
    `)
  }
}
