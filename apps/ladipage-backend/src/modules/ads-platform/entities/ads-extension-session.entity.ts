import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('lp_ads_extension_session')
@Index('uq_lp_ads_extension_session_token_hash', ['tokenHash'], { unique: true })
@Index('idx_lp_ads_extension_session_expiry', ['expiresAt'])
export class AdsExtensionSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'actor_id', type: 'varchar', length: 128 })
  actorId: string

  @Column({ name: 'device_id', type: 'varchar', length: 160 })
  deviceId: string

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}

