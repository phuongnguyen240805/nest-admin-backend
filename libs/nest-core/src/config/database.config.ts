import { ConfigType, registerAs } from '@nestjs/config'

import { buildMysqlDataSourceOptions } from '@liora/database/utils/connection-url.util'
import { DataSource, DataSourceOptions } from 'typeorm'

export const dbRegToken = 'database'

export const DatabaseConfig = registerAs(
  dbRegToken,
  (): DataSourceOptions => buildMysqlDataSourceOptions(),
)

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>

const dataSource = new DataSource(buildMysqlDataSourceOptions())

export default dataSource
