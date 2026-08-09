import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { AdsSecretEntity } from '../entities'

@Injectable()
export class AdsVaultService {
  constructor(
    @InjectRepository(AdsSecretEntity)
    private readonly secretRepository: Repository<AdsSecretEntity>,
    private readonly configService: ConfigService,
  ) {}

  async store(connectionId: string, credential: string): Promise<void> {
    const key = this.getKey()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(Buffer.from(connectionId, 'utf8'))
    const ciphertext = Buffer.concat([cipher.update(credential, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    await this.secretRepository.upsert(
      {
        connectionId,
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: this.configService.get<string>('ADS_VAULT_KEY_VERSION') ?? 'v1',
      },
      ['connectionId'],
    )
  }

  async read(connectionId: string): Promise<string> {
    const secret = await this.secretRepository.findOneByOrFail({ connectionId })
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(secret.iv, 'base64'),
    )
    decipher.setAAD(Buffer.from(connectionId, 'utf8'))
    decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  }

  async remove(connectionId: string): Promise<void> {
    await this.secretRepository.delete({ connectionId })
  }

  private getKey(): Buffer {
    const keyFile = this.configService.get<string>('ADS_VAULT_MASTER_KEY_FILE')
    const encoded = keyFile
      ? readFileSync(keyFile, 'utf8').trim()
      : this.configService.get<string>('ADS_VAULT_MASTER_KEY')
    if (!encoded) {
      throw new ServiceUnavailableException('ADS_VAULT_MASTER_KEY is not configured')
    }
    const key = Buffer.from(encoded, 'base64')
    if (key.byteLength !== 32) {
      throw new ServiceUnavailableException('ADS_VAULT_MASTER_KEY must be a 32-byte base64 key')
    }
    return key
  }
}
