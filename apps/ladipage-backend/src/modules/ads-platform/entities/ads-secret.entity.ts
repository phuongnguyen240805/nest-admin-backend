import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { AdsConnectionEntity } from './ads-connection.entity'

@Entity('lp_ads_secret')
export class AdsSecretEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'connection_id', type: 'uuid', unique: true })
  connectionId: string

  @Column({ type: 'text' })
  ciphertext: string

  @Column({ type: 'varchar', length: 64 })
  iv: string

  @Column({ name: 'auth_tag', type: 'varchar', length: 64 })
  authTag: string

  @Column({ name: 'key_version', type: 'varchar', length: 32 })
  keyVersion: string

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @OneToOne(() => AdsConnectionEntity, (connection) => connection.secret, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'connection_id' })
  connection: AdsConnectionEntity
}
