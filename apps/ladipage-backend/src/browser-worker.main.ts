import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { BrowserWorkerAppModule } from './app/browser-worker-app.module'

async function bootstrap() {
  const logger = new Logger('LadipageBrowserWorker')
  const app = await NestFactory.createApplicationContext(BrowserWorkerAppModule, {
    bufferLogs: true,
  })
  app.enableShutdownHooks()

  logger.log(
    [
      'Ladipage browser worker ready',
      `BULLMQ_ENABLED=${process.env.BULLMQ_ENABLED !== 'false'}`,
      `BULLMQ_RUN_WORKERS=${process.env.BULLMQ_RUN_WORKERS !== 'false'}`,
      `REDIS_URL=${process.env.REDIS_URL ?? '(unset)'}`,
      `BULLMQ_PREFIX=${process.env.BULLMQ_PREFIX ?? 'liora:ladipage'}`,
      'queue=ai-seo-lighthouse',
    ].join(' | '),
  )
}

void bootstrap().catch((error) => {
  console.error('Ladipage browser worker failed to start', error)
  process.exit(1)
})
