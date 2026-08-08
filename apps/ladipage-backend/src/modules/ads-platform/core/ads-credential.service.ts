import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import type { AdsOperationContext } from '@liora/ads-contracts'

import { AdsConnectionEntity } from '../entities'
import { AdsVaultService } from './ads-vault.service'

@Injectable()
export class AdsCredentialService {
  constructor(
    @InjectRepository(AdsConnectionEntity)
    private readonly connectionRepository: Repository<AdsConnectionEntity>,
    private readonly vault: AdsVaultService,
  ) {}

  async read(context: AdsOperationContext): Promise<string> {
    if (!context.connectionId) throw new NotFoundException('Ads connection is required')
    const connection = await this.connectionRepository.findOneBy({
      id: context.connectionId,
      tenantId: context.tenantId,
      provider: context.provider,
      status: 'CONNECTED',
    })
    if (!connection) throw new NotFoundException('Active ads connection was not found')
    return this.vault.read(connection.id)
  }
}
