import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ShippingCredentialVaultService {
  constructor(private readonly config: ConfigService) {}

  encrypt(scope: string, credentials: Record<string, string>) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv)
    cipher.setAAD(Buffer.from(scope, 'utf8'))
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final(),
    ])
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    }
  }

  decrypt(
    scope: string,
    value: { ciphertext: string; iv: string; authTag: string },
  ): Record<string, string> {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(value.iv, 'base64'),
    )
    decipher.setAAD(Buffer.from(scope, 'utf8'))
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'))
    const raw = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
    return JSON.parse(raw) as Record<string, string>
  }

  private getKey() {
    const encoded =
      this.config.get<string>('SHIPPING_VAULT_MASTER_KEY') ||
      this.config.get<string>('ADS_VAULT_MASTER_KEY')
    if (!encoded) {
      throw new ServiceUnavailableException(
        'SHIPPING_VAULT_MASTER_KEY is not configured',
      )
    }
    const key = Buffer.from(encoded, 'base64')
    if (key.byteLength !== 32) {
      throw new ServiceUnavailableException(
        'SHIPPING_VAULT_MASTER_KEY must be a 32-byte base64 key',
      )
    }
    return key
  }
}
