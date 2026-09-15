#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const failures = []
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const mustContain = (file, pattern, message) => {
  if (!pattern.test(read(file))) failures.push(`${file}: ${message}`)
}
const mustNotContain = (file, pattern, message) => {
  if (pattern.test(read(file))) failures.push(`${file}: ${message}`)
}

mustContain(
  'apps/ladipage-backend/src/modules/publish/entities/publish-job.entity.ts',
  /idempotencyKey/,
  'publish job persistence must carry the idempotency key',
)
mustContain(
  'apps/ladipage-backend/src/modules/publish/services/publish-job.service.ts',
  /requestHash/,
  'idempotency replay must protect against key reuse with a different payload',
)
mustContain(
  'apps/ladipage-backend/src/modules/publish/processors/publish-job.processor.ts',
  /PublishQueueReconciler/,
  'DB-backed queue reconciliation is required so a Redis outage cannot lose a committed job',
)
mustContain(
  'apps/ladipage-backend/src/modules/publish/processors/publish-job.processor.ts',
  /PUBLISH_SUPERSEDED/,
  'stale publish intent must not overwrite a newer publish',
)
mustNotContain(
  'apps/ladipage-backend/src/app/app.module.ts',
  /LandingAiWorkerModule|AutomationWorkerModule|PublishWorkerModule|AiSeoLighthouseWorkerModule/,
  'HTTP API must not mount worker processors',
)
mustContain(
  'apps/ladipage-backend/src/app/worker-app.module.ts',
  /PublishWorkerModule/,
  'general worker must consume async publish jobs',
)
mustNotContain(
  'apps/ladipage-backend/src/app/worker-app.module.ts',
  /AiSeoLighthouseWorkerModule/,
  'general worker must not load Chromium/Lighthouse processors',
)
mustContain(
  'apps/ladipage-backend/src/app/browser-worker-app.module.ts',
  /AiSeoLighthouseWorkerModule/,
  'browser-heavy processors must live in their own runtime',
)
mustContain(
  'apps/ladipage-backend/Dockerfile',
  /FROM production-runtime AS production-browser-runtime[\s\S]*apk add --no-cache[\s\S]*chromium/,
  'Chromium must only be installed in the browser-worker production runtime',
)
mustContain(
  'apps/ladipage-backend/Dockerfile',
  /FROM production-runtime AS production-api/,
  'API target must inherit the no-browser runtime',
)
mustContain(
  'libs/database/src/migrations/1765100000000-publish-job-pipeline.ts',
  /UQ_lp_publish_job_idempotency/,
  'database must enforce publish idempotency uniqueness',
)

if (failures.length) {
  console.error('Phase 7-8 backend guard failed:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('Phase 7-8 backend guard passed.')
