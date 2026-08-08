import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AdsAuditService } from './core/ads-audit.service'
import { AdsCredentialService } from './core/ads-credential.service'
import { AdsFingerprintService } from './core/ads-fingerprint.service'
import { AdsOAuthStateService } from './core/ads-oauth-state.service'
import { AdsOperationContextFactory } from './core/ads-operation-context.factory'
import { AdsProviderRegistry } from './core/ads-provider-registry.service'
import { AdsRedactionService } from './core/ads-redaction.service'
import { AdsVaultService } from './core/ads-vault.service'
import {
  AdsAccountEntity,
  AdsAuditEventEntity,
  AdsConnectionEntity,
  AdsExtensionSessionEntity,
  AdsJobEntity,
  AdsOAuthStateEntity,
  AdsSecretEntity,
  AdsSnapshotEntity,
} from './entities'
import { AdsJobStoreService } from './services/ads-job-store.service'
import { AdsExtensionSessionService } from './services/ads-extension-session.service'
import { AdsSnapshotService } from './services/ads-snapshot.service'
import { AdsWorkflowExecutorService } from './services/ads-workflow-executor.service'

const entities = [
  AdsAccountEntity,
  AdsAuditEventEntity,
  AdsConnectionEntity,
  AdsExtensionSessionEntity,
  AdsJobEntity,
  AdsOAuthStateEntity,
  AdsSecretEntity,
  AdsSnapshotEntity,
]

const services = [
  AdsAuditService,
  AdsCredentialService,
  AdsFingerprintService,
  AdsOAuthStateService,
  AdsOperationContextFactory,
  AdsProviderRegistry,
  AdsRedactionService,
  AdsVaultService,
  AdsExtensionSessionService,
  AdsJobStoreService,
  AdsSnapshotService,
  AdsWorkflowExecutorService,
]

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  providers: services,
  exports: [TypeOrmModule, ...services],
})
export class AdsPlatformSharedModule {}
