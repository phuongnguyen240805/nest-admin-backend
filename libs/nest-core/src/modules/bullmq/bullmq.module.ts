import { BullModule } from '@nestjs/bullmq'
import { DynamicModule, Global, Module } from '@nestjs/common'

import { BULLMQ_ROOT_OPTIONS } from './bullmq.constants'
import { buildBullMqConnection } from './bullmq-connection.factory'
import type { BullMqRootOptions, QueueRegisterOptions } from './bullmq.types'
import { BullMqEnqueueService } from './services/bullmq-enqueue.service'

@Global()
@Module({})
export class BullMqModule {
  static forRoot(options: BullMqRootOptions): DynamicModule {
    return {
      module: BullMqModule,
      imports: [
        BullModule.forRoot({
          connection: buildBullMqConnection(options.connection),
          prefix: options.prefix,
          defaultJobOptions: options.defaultJobOptions,
        }),
      ],
      providers: [
        { provide: BULLMQ_ROOT_OPTIONS, useValue: options },
        BullMqEnqueueService,
      ],
      exports: [BullModule, BullMqEnqueueService, BULLMQ_ROOT_OPTIONS],
    }
  }

  /**
   * Worker-only bootstrap: Redis connection + BullModule without enqueue helpers.
   * Use in dedicated worker processes (BULLMQ_RUN_WORKERS=true).
   */
  static forWorker(options: BullMqRootOptions): DynamicModule {
    return {
      module: BullMqModule,
      imports: [
        BullModule.forRoot({
          connection: buildBullMqConnection(options.connection),
          prefix: options.prefix,
          defaultJobOptions: options.defaultJobOptions,
        }),
      ],
      providers: [{ provide: BULLMQ_ROOT_OPTIONS, useValue: options }],
      exports: [BullModule, BULLMQ_ROOT_OPTIONS],
    }
  }

  static registerQueue(options: QueueRegisterOptions): DynamicModule {
    return {
      module: BullMqModule,
      imports: [
        BullModule.registerQueue({
          name: options.name,
          defaultJobOptions: options.defaultJobOptions,
        }),
      ],
      exports: [BullModule],
    }
  }
}