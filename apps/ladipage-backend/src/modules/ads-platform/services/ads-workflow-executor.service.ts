import { Injectable } from '@nestjs/common'

import type {
  AdsOperationContext,
  AdsPublishRequest,
  AdsProviderPlugin,
  AdsSyncRequest,
} from '@liora/ads-contracts'

import { AdsAuditService } from '../core/ads-audit.service'
import { AdsOperationContextFactory } from '../core/ads-operation-context.factory'
import { AdsProviderRegistry } from '../core/ads-provider-registry.service'
import { AdsJobEntity } from '../entities'
import { AdsJobStoreService } from './ads-job-store.service'
import { AdsSnapshotService } from './ads-snapshot.service'

const MAX_SYNC_PAGES = 100

@Injectable()
export class AdsWorkflowExecutorService {
  constructor(
    private readonly registry: AdsProviderRegistry,
    private readonly jobs: AdsJobStoreService,
    private readonly snapshots: AdsSnapshotService,
    private readonly contextFactory: AdsOperationContextFactory,
    private readonly audit: AdsAuditService,
  ) {}

  async execute(jobId: string): Promise<void> {
    let job = await this.jobs.findById(jobId)
    if (job.state === 'FAILED') job = await this.jobs.transition(job, 'QUEUED', { completedAt: null })
    if (job.state !== 'QUEUED') return
    job = await this.jobs.transition(job, 'RUNNING', { error: null, completedAt: null })
    const plugin = this.registry.get(job.provider)
    const context = this.createContext(job, plugin)

    await this.audit.record(context, `ADS.${job.type}.STARTED`, 'STARTED', {
      targetType: 'ADS_ACCOUNT',
      targetId: job.externalAccountId ?? undefined,
    })

    try {
      if (job.type === 'SYNC') job = await this.executeSync(job, plugin, context)
      else if (job.type === 'PUBLISH') job = await this.executePublish(job, plugin, context)
      else throw new Error(`Ads job type ${job.type} is not implemented`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const latestJob = await this.jobs.findById(jobId)
      if (['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(latestJob.state)) {
        throw error
      }
      await this.jobs.transition(latestJob, 'FAILED', {
        error: { message },
        result: Object.keys(latestJob.checkpoint ?? {}).length
          ? { partial: true, checkpoint: latestJob.checkpoint }
          : null,
      })
      await this.audit.record(context, `ADS.${job.type}.FAILED`, 'FAILED', {
        metadata: { message, checkpoint: latestJob.checkpoint },
      })
      throw error
    }
  }

  private async executeSync(
    job: AdsJobEntity,
    plugin: AdsProviderPlugin,
    context: AdsOperationContext,
  ): Promise<AdsJobEntity> {
    if (!plugin.sync) throw new Error(`${job.provider} sync is not implemented`)
    const resource = String(job.payload.resource) as AdsSyncRequest['resource']
    let cursor = (job.checkpoint.cursor as string | undefined) ?? undefined
    let page = Number(job.checkpoint.page ?? 0)
    let inserted = Number(job.checkpoint.inserted ?? 0)

    while (page < MAX_SYNC_PAGES) {
      const result = await plugin.sync.sync(
        {
          connectionId: job.connectionId!,
          externalAccountId: job.externalAccountId!,
          resource,
          cursor,
          since: job.payload.since as string | undefined,
          until: job.payload.until as string | undefined,
        },
        context,
      )
      for (const snapshot of result.snapshots) {
        if (await this.snapshots.persist(snapshot)) inserted += 1
      }
      page += 1
      cursor = result.nextCursor
      job = await this.jobs.saveCheckpoint(job, { page, cursor: cursor ?? null, inserted })
      if (result.complete) break
      if (!cursor) throw new Error(`${job.provider} sync returned incomplete data without a cursor`)
    }
    if (page >= MAX_SYNC_PAGES && cursor) throw new Error('Ads sync exceeded the maximum page limit')

    job = await this.jobs.transition(job, 'SUCCEEDED', {
      result: { pages: page, snapshotsInserted: inserted },
      error: null,
    })
    await this.audit.record(context, 'ADS.SYNC.SUCCEEDED', 'SUCCEEDED', {
      metadata: { pages: page, snapshotsInserted: inserted },
    })
    return job
  }

  private async executePublish(
    job: AdsJobEntity,
    plugin: AdsProviderPlugin,
    context: AdsOperationContext,
  ): Promise<AdsJobEntity> {
    if (!plugin.publish) throw new Error(`${job.provider} publish is not implemented`)
    const draft = job.payload.draft as Record<string, unknown>
    const validation = await plugin.publish.validate(draft, context)
    if (!validation.valid) {
      throw new Error(`Ads draft validation failed: ${JSON.stringify(validation.issues)}`)
    }

    const request: AdsPublishRequest = {
      connectionId: job.connectionId!,
      externalAccountId: job.externalAccountId!,
      idempotencyKey: job.idempotencyKey,
      revision: Number(job.payload.revision),
      draftHash: String(job.payload.draftHash),
      draft,
    }
    const checkpointDraftHash = job.checkpoint.draftHash
    if (checkpointDraftHash && checkpointDraftHash !== request.draftHash) {
      throw new Error('Publish draft changed after the first external checkpoint')
    }
    const plan = await plugin.publish.plan(draft, context)
    const externalIds = { ...((job.checkpoint.externalIds as Record<string, string> | undefined) ?? {}) }
    const completedSteps = new Set<string>(
      (job.checkpoint.completedSteps as string[] | undefined) ?? [],
    )

    for (const step of plan.steps) {
      if (completedSteps.has(step.key)) continue
      const missingDependency = step.dependsOn.find((dependency) => !externalIds[dependency])
      if (missingDependency) throw new Error(`Publish step ${step.key} is missing ${missingDependency}`)
      const result = await plugin.publish.executeStep(
        { request, step, externalIds },
        context,
      )
      if (result.externalId) externalIds[step.key] = result.externalId
      completedSteps.add(step.key)
      job = await this.jobs.saveCheckpoint(job, {
        draftHash: request.draftHash,
        externalIds,
        completedSteps: Array.from(completedSteps),
        lastStep: step.key,
      })
      await this.audit.record(context, 'ADS.PUBLISH.CHECKPOINT_SAVED', 'SUCCEEDED', {
        targetType: step.kind,
        targetId: result.externalId,
        metadata: { step: step.key },
      })
    }

    job = await this.jobs.transition(job, 'RECONCILING')
    const reconciled = await plugin.publish.reconcile(request, externalIds, context)
    job = await this.jobs.transition(job, reconciled.state, {
      result: (reconciled.data ?? { externalIds }) as unknown as Record<string, unknown>,
      error: reconciled.errors.length ? { errors: reconciled.errors } : null,
    })
    await this.audit.record(
      context,
      'ADS.PUBLISH.RECONCILED',
      reconciled.state === 'SUCCEEDED' ? 'SUCCEEDED' : 'PARTIAL',
      { metadata: { externalIds, errors: reconciled.errors } },
    )
    return job
  }

  private createContext(job: AdsJobEntity, plugin: AdsProviderPlugin): AdsOperationContext {
    return this.contextFactory.create({
      tenantId: job.tenantId,
      actorId: job.actorId,
      provider: job.provider,
      providerVersion: plugin.manifest.version,
      connectionId: job.connectionId ?? undefined,
      externalAccountId: job.externalAccountId ?? undefined,
      jobId: job.id,
      traceId: job.id,
      source: 'BULLMQ_WORKER',
    })
  }
}
