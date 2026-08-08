import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import type { AdsSnapshotEnvelope } from '@liora/ads-contracts'

import { AdsSnapshotEntity } from '../entities'

@Injectable()
export class AdsSnapshotService {
  constructor(
    @InjectRepository(AdsSnapshotEntity)
    private readonly snapshotRepository: Repository<AdsSnapshotEntity>,
  ) {}

  async persist(snapshot: AdsSnapshotEnvelope): Promise<boolean> {
    const result = await this.snapshotRepository
      .createQueryBuilder()
      .insert()
      .values({
        tenantId: snapshot.tenantId,
        connectionId: snapshot.connectionId ?? null,
        provider: snapshot.provider,
        source: snapshot.source,
        confidence: snapshot.confidence,
        externalAccountId: snapshot.externalAccountId,
        schemaVersion: snapshot.schemaVersion,
        fingerprint: snapshot.fingerprint,
        observedAt: new Date(snapshot.observedAt),
        staleAt: snapshot.staleAt ? new Date(snapshot.staleAt) : null,
        completeness: snapshot.completeness as unknown as Record<string, unknown>,
        payload: snapshot.payload,
      })
      .orIgnore()
      .execute()
    return (result.identifiers?.length ?? 0) > 0
  }

  listLatest(tenantId: number, provider: string, externalAccountId: string, limit = 20) {
    return this.snapshotRepository.find({
      where: { tenantId, provider: provider as never, externalAccountId },
      order: { observedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    })
  }
}
