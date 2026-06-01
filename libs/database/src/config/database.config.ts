import { ConfigType, registerAs } from '@nestjs/config'

import { DataSource, DataSourceOptions } from 'typeorm'

import { buildMysqlDataSourceOptions } from '../utils/connection-url.util'

export const dbRegToken = 'database'

export const DatabaseConfig = registerAs(
  dbRegToken,
  (): DataSourceOptions => buildMysqlDataSourceOptions(),
)

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>

const dataSource = new DataSource(buildMysqlDataSourceOptions())

export default dataSource
