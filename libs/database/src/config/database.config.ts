import { ConfigType, registerAs } from '@nestjs/config'

import { DataSource, DataSourceOptions } from 'typeorm'

import { buildDataSourceOptions } from '../utils/connection-url.util'

export const dbRegToken = 'database'

export const DatabaseConfig = registerAs(
  dbRegToken,
  (): DataSourceOptions => buildDataSourceOptions(),
)

export type IDatabaseConfig = ConfigType<typeof DatabaseConfig>

const dataSource = new DataSource(buildDataSourceOptions())

export default dataSource
