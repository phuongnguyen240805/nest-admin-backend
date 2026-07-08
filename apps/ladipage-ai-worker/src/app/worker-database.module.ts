import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

import type { IDatabaseConfig } from '@liora/database/config/database.config'

/**
 * TypeORM bootstrap for the AI worker only — no class-validator constraints (UniqueConstraint / ClsService).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get<IDatabaseConfig>('database', { infer: true }),
        autoLoadEntities: true,
      }),
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options!).initialize()
        return dataSource
      },
    }),
  ],
})
export class WorkerDatabaseModule {}