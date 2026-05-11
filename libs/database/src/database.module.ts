import { Module } from '@nestjs/common'

import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DataSource, LoggerOptions } from 'typeorm'

// import { ConfigKeyPaths, IDatabaseConfig } from '~/config'  
import { env } from '../src/global'

import { EntityExistConstraint } from './constraints/entity-exist.constraint'
import { UniqueConstraint } from './constraints/unique.constraint'
import { TypeORMLogger } from './typeorm-logger'
import { IDatabaseConfig } from './config/database.config'

const providers = [EntityExistConstraint, UniqueConstraint]
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        let loggerOptions: LoggerOptions = env('DB_LOGGING') as 'all'

        try {
          // 解析成 js 数组 ['error']
          loggerOptions = JSON.parse(loggerOptions)
        }
        catch {
          // ignore
        }

        return {
          ...configService.get<IDatabaseConfig>('database', { infer: true }),
          autoLoadEntities: true,
          logging: loggerOptions,
          logger: new TypeORMLogger(loggerOptions),
        }
      },
      // dataSource receives the configured DataSourceOptions
      // and returns a Promise<DataSource>.
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options).initialize()
        return dataSource
      },
    }),
  ],
  providers,
  exports: providers,
})
export class DatabaseModule { }
