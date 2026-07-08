import { Module } from '@nestjs/common'

import { join } from 'path'

import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ClsModule } from 'nestjs-cls'

import { DataSource, LoggerOptions } from 'typeorm'

import { EntityExistConstraint } from './constraints/entity-exist.constraint'
import { UniqueConstraint } from './constraints/unique.constraint'
import { TypeORMLogger } from './typeorm-logger'
import { IDatabaseConfig } from './config/database.config'

const providers = [EntityExistConstraint, UniqueConstraint]
@Module({
  imports: [
    ClsModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rawLogging = configService.get<string>('DB_LOGGING') ?? process.env.DB_LOGGING ?? 'false'
        let loggerOptions: LoggerOptions = rawLogging as LoggerOptions

        try {
          loggerOptions = JSON.parse(rawLogging)
        }
        catch {
          // ignore — use string value as-is
        }

        return {
          ...configService.get<IDatabaseConfig>('database', { infer: true }),
          // Override entities path with runtime-safe absolute glob.
          // The static 'dist/modules/**/*.entity.js' path in database.config.ts
          // is wrong when running from a bundled Nx app output directory.
          // Using __dirname ensures TypeORM finds all entities in the current bundle.
          entities: [join(__dirname, '**/*.entity.js')],
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
