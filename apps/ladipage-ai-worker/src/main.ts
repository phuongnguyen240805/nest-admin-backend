import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { WorkerAppModule } from './app/worker-app.module'

async function bootstrap() {
  const logger = new Logger('LadipageAiWorker')
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  })

  app.enableShutdownHooks()

  const bullEnabled = process.env.BULLMQ_ENABLED !== 'false'
  const workerEnabled = process.env.BULLMQ_RUN_WORKERS !== 'false'
  const mockGenerate = process.env.LANDING_AI_MOCK_GENERATE === 'true'
  const redisUrl = process.env.REDIS_URL ?? '(unset)'
  const prefix = process.env.BULLMQ_PREFIX ?? 'liora:ladipage'

  logger.log(
    [
      'Landing AI worker ready',
      `BULLMQ_ENABLED=${bullEnabled}`,
      `BULLMQ_RUN_WORKERS=${workerEnabled}`,
      `LANDING_AI_MOCK_GENERATE=${mockGenerate}`,
      `REDIS_URL=${redisUrl}`,
      `BULLMQ_PREFIX=${prefix}`,
      'queue=landing-ai-generate',
    ].join(' | '),
  )
}

void bootstrap().catch((error) => {
  console.error('Landing AI worker failed to start', error)
  process.exit(1)
})