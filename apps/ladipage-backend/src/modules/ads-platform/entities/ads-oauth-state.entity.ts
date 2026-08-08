import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

@Entity('lp_ads_oauth_state')
@Index('uq_lp_ads_oauth_state_hash', ['stateHash'], { unique: true })
@Index('idx_lp_ads_oauth_state_expiry', ['expiresAt'])
export class AdsOAuthStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'state_hash', type: 'varchar', length: 64 })
  stateHash: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'actor_id', type: 'varchar', length: 128 })
  actorId: string

  @Column({ type: 'varchar', length: 16 })
  provider: AdsProvider

  @Column({ name: 'return_to', type: 'text', nullable: true })
  returnTo: string | null

  @Column({ name: 'code_verifier_ciphertext', type: 'text', nullable: true })
  codeVerifierCiphertext: string | null

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
